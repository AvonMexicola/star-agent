import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAuthoredExterior } from '../src/station-exterior.js';
import { StationComplex } from '../src/station-complex.js';
import { POD_LAYOUT } from '../src/station-architecture.js';
import { buildStationColliders, constrainStationSweep, sweepBox, sweepTriangle } from '../src/station-collision.js';

const bytes = await readFile(new URL('../public/models/station-exterior.glb', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../assets/station/exterior/manifest.json', import.meta.url)));
const parse = data => new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
const load = async name => parse(await readFile(new URL(`../public/models/${name}.glb`, import.meta.url)));

test('continuous triangle collision rejects empty diagonal bounds but catches high-speed and edge contacts',()=>{
  const v=(x,y,z)=>new THREE.Vector3(x,y,z),lo=v(-.5,-.5,-.5),hi=v(.5,.5,.5);
  const triangle=new THREE.Triangle(v(0,0,0),v(0,100,0),v(0,0,100));
  const bounds=new THREE.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]);
  assert.notEqual(sweepBox(v(-1000,80,80),v(1000,80,80),bounds,lo,hi),null,'old triangle bounds falsely fill the empty half');
  assert.equal(sweepTriangle(v(-1000,80,80),v(1000,80,80),triangle,lo,hi),null);
  for(const [start,end] of [[v(-1000,40,40),v(1000,40,40)],[v(1000,40,40),v(-1000,40,40)]]){
    assert.ok(Math.abs(sweepTriangle(start,end,triangle,lo,hi)-.49975)<1e-12,'swept contact, even when both endpoints miss');
  }
  assert.notEqual(sweepTriangle(v(-10,50.4,50.4),v(10,50.4,50.4),triangle,lo,hi),null,'box corner can touch the diagonal edge while its centre ray misses');
  assert.equal(sweepTriangle(v(-10,50.6,50.6),v(10,50.6,50.6),triangle,lo,hi),null);
  assert.equal(sweepTriangle(v(.5,20,20),v(2,20,20),triangle,lo,hi),null,'separating from a contact is allowed');
  assert.equal(sweepTriangle(v(.5,20,20),v(-2,20,20),triangle,lo,hi),0,'moving into a touching face is blocked');
  assert.notEqual(sweepTriangle(v(0,-5,30),v(0,30,30),triangle,lo,hi),null,'motion parallel to the face still hits its edge');
  const door=new THREE.Box3(v(-1,-1,-1),v(1,1,1));
  assert.equal(constrainStationSweep(null,[door],v(-10,0,0),v(10,0,0),lo,hi).hit,true,'explicit solid door boxes retain their contract');
});

test('real wheel gaps stay open beside diagonal spokes while solid structure and rotated frames still collide',async()=>{
  const [gltf,lod,exteriorGltf]=await Promise.all([load('station'),load('station_lod1'),parse(bytes)]);
  const station=new StationComplex(new THREE.Scene(),{gltf,lod,exteriorGltf});await station.readyPromise;
  const toWorld=p=>p.clone().applyQuaternion(station.baseQuaternion).add(station.centre);
  const lo=new THREE.Vector3(-10,-10,-10),hi=lo.clone().negate();
  for(const [i,ring] of station.exterior.rings.entries()){
    const tree=station.ringColliders[i];
    for(const rotation of [0,.31,-1.7]){
      ring.rotation.x=rotation;
      for(let gap=0;gap<6;gap++){
        const angle=(gap+.5)*Math.PI/3,y=800*Math.cos(angle),z=800*Math.sin(angle);
        const start=new THREE.Vector3(-160,y,z),end=new THREE.Vector3(160,y,z);
        const corridor=new THREE.Box3(new THREE.Vector3(-160,y-100,z-100),new THREE.Vector3(160,y+100,z+100));
        let overlaps=0,boundsOnlyHit=false;
        const inspect=node=>{if(node.boxes)for(const box of node.boxes){
          if(corridor.intersectsTriangle(box.triangle))overlaps++;
          if(sweepBox(start,end,box,lo,hi)!==null)boundsOnlyHit=true;
        }else{inspect(node.left);inspect(node.right);}};inspect(tree);
        assert.equal(overlaps,0,'a 200 m corridor independently misses all rendered physical triangles');
        if(gap===0)assert.equal(boundsOnlyHit,true,'reproduce invisible walls from the old broad-phase-only test');
        assert.equal(constrainStationSweep(tree,[],start,end,lo,hi).hit,false);
        for(const [a,b] of [[start,end],[end,start]]){
          const world=p=>toWorld(p.clone().applyQuaternion(ring.quaternion).add(ring.position));
          assert.equal(station.constrainStep(world(a),world(b),station.baseQuaternion).hit,false,`ring ${i}, rotation ${rotation}, gap ${gap}: actual Nomad path`);
        }
      }
      for(const [y,z] of [[224,0],[1450,0]]){
        const world=x=>toWorld(new THREE.Vector3(x,y,z).applyQuaternion(ring.quaternion).add(ring.position));
        assert.equal(station.constrainStep(world(-160),world(160),station.baseQuaternion).hit,true,'visible root armour and outer rim remain solid');
      }
    }
  }
  station.rebase(station.centre.clone().addScalar(1e9));
  const ring=station.exterior.rings[0],world=x=>toWorld(new THREE.Vector3(x,800*Math.cos(Math.PI/6),400).applyQuaternion(ring.quaternion).add(ring.position));
  assert.equal(station.constrainStep(world(-160),world(160),station.baseQuaternion).hit,false,'render-origin changes cannot move the clear corridor');
});

test('actual exterior export matches its manifest, batching and shared-ring budgets', async () => {
  const exterior = createAuthoredExterior(await parse(bytes));
  let triangles = 0, primitives = 0, shaded = 0;
  exterior.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    primitives++;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    assert.ok(mesh.geometry.hasAttribute('uv'), 'every physical finish has authored local UVs');
    if (!/Detail/.test(mesh.name)) {
      shaded++;
      assert.ok(mesh.geometry.hasAttribute('color'), 'opaque structure retains baked contact shading');
      assert.equal(mesh.material.vertexColors, true);
    }
  });
  assert.ok(shaded > 0);
  assert.equal(triangles, manifest.assembledTriangles);
  assert.equal(primitives, manifest.assembledPrimitives);
  assert.ok(triangles <= 100000, `${triangles} assembled triangles`);
  assert.ok(primitives <= 36);
  assert.ok(bytes.length <= 4000000);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  const left = [], right = [];
  exterior.rings[0].traverse(mesh => { if (mesh.isMesh) left.push(mesh); });
  exterior.rings[1].traverse(mesh => { if (mesh.isMesh) right.push(mesh); });
  for (let i = 0; i < left.length; i++) {
    assert.equal(left[i].geometry, right[i].geometry);
    assert.equal(left[i].material, right[i].material);
  }
  exterior.rings[0].rotation.x = .3;
  assert.ok(Math.abs(exterior.rings[1].rotation.x)<1e-12, 'shared geometry does not couple transforms');
});

test('authored fixed structure leaves every outward bay approach and occupied room clear', async () => {
  const exterior = createAuthoredExterior(await parse(bytes));
  const fixed = exterior.group.getObjectByName('FixedStructure');
  const tree = buildStationColliders(fixed);
  // 36 m wide / 18 m tall / 66 m long envelope: larger than the currently
  // playable fleet. Each path ends before the original bay itself is entered.
  const lo = new THREE.Vector3(-18,-9,-33), hi = new THREE.Vector3(18,9,33);
  for (const pod of POD_LAYOUT) {
    const side = pod.id <= 10 ? -1 : 1;
    const start = new THREE.Vector3(pod.offset[0],6,pod.offset[2]+side*300);
    const end = new THREE.Vector3(pod.offset[0],6,pod.offset[2]+side*60);
    assert.equal(constrainStationSweep(tree,[],start,end,lo,hi).hit,false,`berth ${pod.id} outward flight lane`);
  }
  fixed.updateMatrixWorld(true);
  // Exact triangle/box SAT catches a face spanning the room even when all its
  // vertices lie outside. Independent review found this on the hub supports.
  const rooms=[{name:'hub',box:new THREE.Box3(new THREE.Vector3(-22,-8,-19),new THREE.Vector3(22,1.5,19))},
    ...POD_LAYOUT.map(pod=>({name:`berth ${pod.id}`,box:new THREE.Box3(
      new THREE.Vector3(pod.offset[0]-21,-8,pod.offset[2]+(pod.id<=10?-22:-26)),
      new THREE.Vector3(pod.offset[0]+21,10,pod.offset[2]+(pod.id<=10?26:22)))}))];
  for(const room of rooms)room.box.expandByScalar(-.0001);
  const triangle=new THREE.Triangle();
  fixed.traverse(mesh => {
    if (!mesh.isMesh || /Detail/.test(mesh.name)) return;
    const positions=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for (let i=0; i<(index?.count??positions.count); i+=3) {
      [triangle.a,triangle.b,triangle.c].forEach((v,j)=>v.fromBufferAttribute(positions,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      for(const room of rooms)assert.equal(room.box.intersectsTriangle(triangle),false,`${room.name}: crossing triangle ${mesh.name} ${i/3}`);
    }
  });
  for (const pod of POD_LAYOUT) {
    const ray=new THREE.Raycaster(new THREE.Vector3(pod.offset[0],-6.25,pod.offset[2]),new THREE.Vector3(0,-1,0),0,1.76);
    assert.equal(ray.intersectObject(fixed,true).length,0,'new shell does not become a competing walking floor');
  }
});

test('installed exterior remains solid, rotates in local space and restores visibility after rebase', async () => {
  const [gltf,lod,exteriorGltf] = await Promise.all([load('station'),load('station_lod1'),parse(bytes)]);
  const s = new StationComplex(new THREE.Scene(),{gltf,lod,exteriorGltf});
  await s.readyPromise;
  assert.equal(s.exteriorStatus,'geometry-review');
  const origin=s.centre.clone().addScalar(5000),sun=new THREE.Vector3(1,0,0);
  s.update(origin,origin,sun,20);
  assert.ok(s.exterior.rings[0].rotation.x>0 && s.exterior.rings[1].rotation.x<0);
  assert.ok(s.exterior.group.position.distanceTo(s.centre.clone().sub(origin))<1e-8);
  const to=p=>s.centre.clone().add(new THREE.Vector3(...p).applyQuaternion(s.baseQuaternion));
  const hit=s.constrainStep(to([0,-120,-220]),to([0,-120,0]),s.baseQuaternion);
  assert.equal(hit.hit,true,'the visible lower core blocks a through-flight');
  for (const ring of s.exterior.rings) {
    const q=ring.quaternion;
    const a=new THREE.Vector3(0,1550,0).applyQuaternion(q).add(ring.position);
    const b=new THREE.Vector3(0,1450,0).applyQuaternion(q).add(ring.position);
    assert.equal(s.constrainStep(to(a.toArray()),to(b.toArray()),s.baseQuaternion).hit,true,'a rotated habitat sector remains solid');
  }
  const far=s.centre.clone().addScalar(700000);
  s.update(far,far,sun,0);
  assert.equal(s.exterior.group.visible,false);
  assert.equal(s.constrainStep(to([0,-120,-220]),to([0,-120,0]),s.baseQuaternion).hit,true,'visibility does not disable collision');
  s.update(origin,origin,sun,0);
  assert.equal(s.exterior.group.visible,true);
});

test('malformed optional exterior retains the complete legacy station', async () => {
  const [gltf,lod]=await Promise.all([load('station'),load('station_lod1')]);
  const s=new StationComplex(new THREE.Scene(),{gltf,lod,exteriorGltf:{scene:new THREE.Group()}});
  await s.readyPromise;
  assert.equal(s.ready,true);
  assert.equal(s.exteriorStatus,'legacy');
  assert.match(s.exteriorError,/missing an assembly/);
  assert.equal(s.pods.length,20);
  assert.equal(s.exterior.rings.length,2);
  assert.ok(s.spineColliders.bounds.isEmpty()===false);
});

test('named but empty exterior assemblies cannot replace the fallback or erase collision',async()=>{
  const empty=new THREE.Group();
  for(const name of ['FixedStructure','RingTemplate','HubShellDetail']){
    const group=new THREE.Group();group.name=name;empty.add(group);
  }
  const [gltf,lod]=await Promise.all([load('station'),load('station_lod1')]);
  const s=new StationComplex(new THREE.Scene(),{gltf,lod,exteriorGltf:{scene:empty}});
  await s.readyPromise;
  assert.equal(s.ready,true);assert.equal(s.exteriorStatus,'legacy');
  assert.match(s.exteriorError,/empty or incomplete/);
  assert.ok(!s.spineColliders.bounds.isEmpty());
  assert.ok(s.ringColliders.every(tree=>!tree.bounds.isEmpty()));
});

test('distant export reduces rendered triangles without changing collision, spin or switch stability',async()=>{
  const lodBytes=await readFile(new URL('../public/models/station-exterior-lod1.glb',import.meta.url));
  const lodManifest=JSON.parse(await readFile(new URL('../assets/station/exterior/lod1-manifest.json',import.meta.url)));
  assert.ok(bytes.length+lodBytes.length<=4000000,'complete two-level kit remains below4MB');
  assert.equal(createHash('sha256').update(lodBytes).digest('hex'),lodManifest.sha256);
  const [gltf,lod,exteriorGltf,exteriorLodGltf]=await Promise.all([load('station'),load('station_lod1'),parse(bytes),parse(lodBytes)]);
  const s=new StationComplex(new THREE.Scene(),{gltf,lod,exteriorGltf,exteriorLodGltf});await s.readyPromise;
  const trees=[s.spineColliders,...s.ringColliders],sun=new THREE.Vector3(1,0,0);
  const counts=()=>{let triangles=0,draws=0;s.exterior.group.traverseVisible(mesh=>{if(mesh.isMesh){draws++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;}});return {triangles,draws};};
  const update=distance=>{const origin=s.centre.clone().add(new THREE.Vector3(distance,0,0));s.update(origin,origin,sun,10);};
  update(4500);
  assert.equal(s.exterior.detailLevel,'lod1');
  assert.deepEqual(counts(),{triangles:lodManifest.assembledTriangles,draws:lodManifest.assembledPrimitives});
  assert.ok(lodManifest.assembledTriangles<56000);
  for(let i=0;i<2;i++)assert.ok(s.exterior.rings[i].quaternion.angleTo(s.exterior.lod.rings[i].quaternion)<1e-8);
  update(4000);assert.equal(s.exterior.detailLevel,'lod1');
  update(3700);assert.equal(s.exterior.detailLevel,'hero');
  assert.deepEqual(counts(),{triangles:manifest.assembledTriangles,draws:manifest.assembledPrimitives});
  update(4000);assert.equal(s.exterior.detailLevel,'hero');
  update(4300);assert.equal(s.exterior.detailLevel,'lod1');
  assert.deepEqual([s.spineColliders,...s.ringColliders],trees,'render switches never rebuild or replace collision');
  const actual=new THREE.Vector3(),expected=new THREE.Vector3();
  s.exterior.group.updateMatrixWorld(true);
  for(let i=0;i<2;i++){
    s.exterior.rings[i].getWorldPosition(expected);s.exterior.lod.rings[i].getWorldPosition(actual);
    assert.ok(actual.distanceTo(expected)<1e-8,'LOD and hero use the same rebased ring origins');
  }
});
