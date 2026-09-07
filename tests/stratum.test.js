import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STRATUM_LAYOUT as L, stratumRampPose, stratumRampFloor } from '../src/stratum-layout.js';
import { createStratumSystems, createStratumInspectionState, validateStratumAsset } from '../src/stratum-systems.js';
import { createStratum } from '../src/stratum.js';
import { STRATUM_FLIGHT_PARTS, STRATUM_FLIGHT_PARTS_ASSET } from '../src/stratum-flight-parts.js';

const bytes = fs.readFileSync(new URL('../public/models/stratum.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binStart = 28 + jsonLength;
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/stratum/manifest.json', import.meta.url)));
const loader = new GLTFLoader();
// Real decoded geometry, indices, hierarchy, normals and UVs. Browser validation
// remains responsible for actual WebP decoding and shader/material appearance.
loader.register(parser => {
  parser.loadTextureImage = async index => { const t = new THREE.Texture(); parser.associations.set(t, { textures: index }); return t; };
  return { name: 'StratumNodeGeometryInspection' };
});
const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const close = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const vec = p => new THREE.Vector3(...p);
function fresh() { const model = gltf.scene.clone(true); return { model, systems: createStratumSystems(model) }; }
function vertices(model, visit) {
  model.updateMatrixWorld(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) visit(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld), o);
  });
}
function bounds(model) { const b = new THREE.Box3(); vertices(model, v => b.expandByPoint(v)); return b; }
function intrusions(model, box, worldToProbe = null) {
  const found = [], triangle = new THREE.Triangle();
  model.updateMatrixWorld(true);
  model.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, idx = o.geometry.index;
    for (let i = 0, n = idx?.count ?? p.count; i < n; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v=triangle[['a','b','c'][k]].fromBufferAttribute(p, idx ? idx.getX(i+k) : i+k).applyMatrix4(o.matrixWorld);
        if(worldToProbe)v.applyMatrix4(worldToProbe);
      }
      if (box.intersectsTriangle(triangle)) { found.push({ name: o.name, triangle: i / 3 }); break; }
    }
  });
  return found;
}

test('Stratum real export respects its measured triangle, byte and embedded WebP contract', () => {
  assert.equal(bytes.length, manifest.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  assert.ok(bytes.length <= 4_000_000);
  const triangles = document.meshes.reduce((n, m) => n + m.primitives.reduce((v, p) => v + document.accessors[p.indices].count / 3, 0), 0);
  assert.equal(triangles, manifest.triangles); assert.ok(triangles <= 60_000);
  assert.equal(document.images.length, 3);
  assert.ok(document.extensionsRequired.includes('EXT_texture_webp'));
  for (const image of document.images) {
    assert.equal(image.mimeType, 'image/webp');
    const view = document.bufferViews[image.bufferView], data = bytes.subarray(binStart + view.byteOffset, binStart + view.byteOffset + view.byteLength);
    assert.equal(data.toString('ascii', 0, 4), 'RIFF'); assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    // Lossless WebP dimensions are encoded in the VP8L image header.
    assert.equal(data.toString('ascii', 12, 16), 'VP8L');
    const bits = data.readUInt32LE(21); assert.equal((bits & 0x3fff) + 1, 1024); assert.equal(((bits >>> 14) & 0x3fff) + 1, 1024);
  }
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
    assert.ok(primitive.attributes.NORMAL !== undefined);
    assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
  }
});

test('all gear and boom limits fit the closed envelope with real ground contact', () => {
  const { model, systems } = fresh(), envelope = new THREE.Box3(vec(L.flightBounds.min), vec(L.flightBounds.max)).expandByScalar(2e-5);
  close(bounds(model).min.y, 0, 2e-6);
  for (let step = 0; step <= 12; step++) for (const yaw of [-.2, 0, .2]) for (const pitch of [-.12, .14]) {
    systems.applyPose({ gearProgress: step / 12, rampProgress: 0, aim: [{yaw,pitch}, {yaw:-yaw,pitch}] });
    const b = bounds(model);
    assert.ok(envelope.containsBox(b), `gear ${step / 12} aim ${yaw}/${pitch}: ${JSON.stringify({min:b.min.toArray(),max:b.max.toArray()})}`);
  }
  systems.applyPose({ gearProgress: 0 });
  for (const leg of L.gear.legs) assert.ok(bounds(model.getObjectByName(leg.node)).min.y > .75);
});

test('measured separate flight solids conservatively cover intermediate real poses', () => {
  assert.equal(STRATUM_FLIGHT_PARTS_ASSET,manifest.sha256);
  assert.equal(STRATUM_FLIGHT_PARTS.length,14);
  assert.deepEqual(STRATUM_FLIGHT_PARTS.filter(p=>p.min[1]===0).map(p=>p.id).sort(),L.gear.legs.map(p=>p.node).sort());
  const {model,systems}=fresh(),boxes=STRATUM_FLIGHT_PARTS.map(p=>new THREE.Box3(vec(p.min),vec(p.max)));
  // These intermediate values are different from the 13x13 authoring samples.
  for(let i=0;i<=20;i++){
    const gearProgress=i/20,yaw=.2*Math.sin(i*1.72),pitch=.01+.13*Math.cos(i*.91);
    systems.applyPose({gearProgress,rampProgress:0,aim:[{yaw,pitch},{yaw:-yaw,pitch:.02-pitch}]});
    vertices(model,(point,object)=>assert.ok(boxes.some(box=>box.containsPoint(point)),`${object.name} outside parts at ${i}: ${point.toArray()}`));
  }
});

test('actual cabin aisle, rear portal and both net freight volumes stay empty', () => {
  const { model, systems } = fresh(); systems.applyPose({ rampProgress: 1 });
  const spaces = [
    ['aisle', new THREE.Box3(vec([-.55,1.365,-4.80]), vec([.55,3.15,7.001]))],
    ['central ceiling', new THREE.Box3(vec([-.55,3.15,-4.80]), vec([.55,3.649,6.89]))],
    ['portal', new THREE.Box3(vec([-.945,1.365,6.90]), vec([.945,3.549,7.28]))],
    ...L.storage.freight.banks.map(b => [b.id, new THREE.Box3(vec(b.min).addScalar(.001),vec(b.max).addScalar(-.001))]),
  ];
  for (const [name, volume] of spaces) assert.deepEqual(intrusions(model, volume), [], name);
});

test('folding landing feet clear the actual fixed hull through the gear cycle', () => {
  const {model,systems}=fresh(),staticHull=model.getObjectByName('Stratum_Static');
  for(let step=0;step<=12;step++){
    systems.applyPose({gearProgress:step/12});
    for(const leg of L.gear.legs){
      const object=model.getObjectByName(leg.node);
      // Conservative un-beveled foot OBB, transformed into the real pivot frame.
      const x=leg.side*.42,y=.1-leg.pivot[1];
      const foot=new THREE.Box3(vec([x-.448,y-.099,-.448]),vec([x+.448,y+.099,.448]));
      assert.deepEqual(intrusions(staticHull,foot,object.matrixWorld.clone().invert()),[],`${leg.node} at${step/12}`);
    }
  }
});

test('deployed ramp provides the authored continuous incline and real nested storage', () => {
  const { model, systems } = fresh();
  const closed = stratumRampPose(0); assert.equal(closed.middle, 0); close(closed.middleLift, -.13); close(closed.endLift, -.26);
  const rotated = stratumRampPose(.4); assert.equal(rotated.middle, 0);
  const extended = stratumRampPose(.9); assert.ok(extended.middle > 1.7); close(extended.middleLift, -.13);
  const hinge=model.getObjectByName(L.ramp.hingeNode),inverse=hinge.matrixWorld.clone().invert();
  const layerBounds=object=>{const box=new THREE.Box3();vertices(object,v=>box.expandByPoint(v.applyMatrix4(inverse)));return box;};
  const middle=layerBounds(model.getObjectByName(L.ramp.slideNodes[0])),end=layerBounds(model.getObjectByName(L.ramp.slideNodes[1]));
  const base=new THREE.Box3(),armor=new THREE.Box3();
  for(const object of hinge.children.filter(o=>o.isMesh)){
    const b=layerBounds(object);(object.material.name.includes('petrol')?armor:base).union(b);
  }
  assert.ok(middle.max.y<base.min.y-.005,'middle deck clears base guides when nested');
  assert.ok(end.max.y<middle.min.y-.005,'end deck clears middle guides when nested');
  assert.ok(armor.max.y<end.min.y-.005,'hatch shell clears nested end-stage guides');
  systems.applyPose({ rampProgress: 1 });
  assert.ok(bounds(model).min.y>=-2e-6,'deployed end guides remain above the ground datum');
  for (let z = 7.04; z < 12.18; z += .073) for (const x of [-.75, 0, .75]) {
    const y = stratumRampFloor(z), ray = new THREE.Raycaster(vec([x,y+.5,z]),vec([0,-1,0]),0,1);
    const hits = ray.intersectObject(model.getObjectByName(L.ramp.hingeNode), true);
    assert.ok(hits.length, `missing ramp floor at ${x},${z}`);
    assert.ok(Math.abs(hits[0].point.y-y) <= .016, `ramp surface ${hits[0].point.y} vs ${y} at ${z}`);
  }
  close(stratumRampFloor(7), 1.35); close(stratumRampFloor(12.2), 0); assert.equal(stratumRampFloor(13), null);
  // Check centre passage above the ramp, including whole triangles, not vertices.
  for (let z = 7.28; z < 12; z += .22) {
    const floor = stratumRampFloor(z);
    const room = new THREE.Box3(vec([-.54,floor+.025,z]),vec([.54,floor+1.80,z+.01]));
    assert.deepEqual(intrusions(model,room),[],`ramp headroom at ${z}`);
  }
});

test('actual muzzle and nozzle transforms remain local and precise after rebasing', () => {
  const { model, systems } = fresh();
  for (let i = 0; i < 2; i++) {
    assert.ok(systems.muzzle(i).position.distanceTo(vec(L.mining.booms[i].muzzlePosition)) < 1e-5);
    assert.ok(systems.muzzle(i).direction.distanceTo(vec([0,0,-1])) < 1e-6);
    assert.ok(systems.nozzle(i).position.distanceTo(vec(L.nozzles[i].position)) < 1e-5);
    assert.ok(systems.nozzle(i).direction.distanceTo(vec([0,0,1])) < 1e-6);
    const tip=systems.muzzle(i);
    assert.equal(new THREE.Raycaster(tip.position,tip.direction,0,3).intersectObject(model,true).length,0,'mining ray leaves an unobstructed actual bore');
    const inward=new THREE.Raycaster(tip.position,tip.direction.clone().negate(),0,1.2).intersectObject(model,true);
    assert.ok(inward.length&&tip.position.distanceTo(inward[0].point)>.7,'emitter is recessed behind the mouth');
  }
  const aim = [{yaw:.19,pitch:.13},{yaw:-.17,pitch:-.11}]; systems.applyPose({aim});
  const initial = [systems.muzzle(0),systems.muzzle(1)];
  model.position.set(25_000_000_000,1_592_750,-900_000_000); model.quaternion.setFromEuler(new THREE.Euler(.7,-1.2,.3)); model.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) {
    const local=systems.muzzle(i), world=systems.muzzle(i,{local:false});
    assert.ok(local.position.distanceTo(initial[i].position)<1e-5);
    assert.ok(local.direction.distanceTo(initial[i].direction)<1e-7);
    assert.ok(world.position.distanceTo(initial[i].position.clone().applyMatrix4(model.matrixWorld))<1e-5);
  }
});

test('canonical pilot forward view retains real glass and excludes opaque central structure', () => {
  const {model}=fresh(), eye=vec(L.interior.pilotEye), glass=[], opaque=[];
  model.updateMatrixWorld(true);
  model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const materials=[mesh.material].flat();
    assert.equal(materials.length,1,'asset batches have one material');
    mesh.material=materials[0].clone();mesh.material.side=THREE.DoubleSide;
    (mesh.material.transparent?glass:opaque).push(mesh);
  });
  assert.ok(glass.length,'the actual pressure glazing must remain present');
  for(const pitch of [-5,0,10])for(const yaw of [-8,0,8]){
    const direction=vec([Math.sin(yaw*Math.PI/180),Math.tan(pitch*Math.PI/180),-Math.cos(yaw*Math.PI/180)]).normalize();
    const ray=new THREE.Raycaster(eye,direction,.01,20);
    assert.ok(ray.intersectObjects(glass,false).length,`missing glass at yaw ${yaw}, pitch ${pitch}`);
    const hit=ray.intersectObjects(opaque,false)[0];
    assert.ok(!hit,`central view at yaw ${yaw}, pitch ${pitch} blocked by ${hit?.object.name}`);
  }
  for(const mesh of [...glass,...opaque])mesh.material.dispose();
});

test('all four real display faces are visible from the canonical pilot eye', () => {
  const { model }=fresh(), eye=vec(L.interior.pilotEye);
  for (const spec of L.displays) {
    const screen=model.getObjectByName(spec.node); assert.ok(screen.isMesh);
    screen.material=screen.material.clone();screen.material.side=THREE.FrontSide;
    screen.geometry.computeBoundingBox(); const center=screen.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(screen.matrixWorld);
    assert.ok(center.distanceTo(vec(spec.position))<.005,`${spec.node} centre ${center.toArray()}`);
    const ray=new THREE.Raycaster(eye,center.clone().sub(eye).normalize(),0,eye.distanceTo(center)+.01);
    const hits=ray.intersectObject(model,true).filter(h=>!h.object.material.transparent);
    assert.equal(hits[0]?.object.name,spec.node,`screen blocked by ${hits[0]?.object.name}`);
    const p=screen.geometry.attributes.uv; assert.ok(p && p.count>=4);
  }
});

test('inspection sequencing rejects unsafe order and canonical direct poses are independent', () => {
  const clock=createStratumInspectionState(); assert.equal(clock.command('ramp',true).ok,true);
  assert.equal(clock.command('gear',false).ok,false);
  for(let i=0;i<200;i++)clock.update(.016);
  close(clock.snapshot().rampProgress,1); clock.command('ramp',false);
  for(let i=0;i<200;i++)clock.update(.016);
  assert.equal(clock.command('gear',false).ok,true); assert.equal(clock.command('ramp',true).ok,false);
  const a=fresh(), b=fresh();a.systems.applyPose({gearProgress:.37,rampProgress:.21});
  assert.equal(a.systems.snapshot().gearProgress,.37);assert.equal(b.systems.snapshot().gearProgress,1);
});

test('missing, malformed and disposed loads never expose a partial ready hull', async () => {
  const missing=gltf.scene.clone(true);missing.getObjectByName('Muzzle_Mining_Port').removeFromParent();assert.throws(()=>validateStratumAsset(missing),/missing/);
  const empty=new THREE.Group();assert.throws(()=>validateStratumAsset(empty),/missing/);
  const failed=createStratum({loader:{loadAsync:async()=>({scene:missing})}});assert.equal(await failed.readyPromise,null);assert.equal(failed.snapshot().assetStatus,'error');assert.equal(failed.children.length,0);
  let resolve;const late=createStratum({loader:{loadAsync:()=>new Promise(r=>{resolve=r;})}});late.dispose();resolve({scene:gltf.scene.clone(true)});assert.equal(await late.readyPromise,null);assert.equal(late.snapshot().assetStatus,'disposed');assert.equal(late.children.length,0);
  assert.equal(late.muzzle(0),null);
});
