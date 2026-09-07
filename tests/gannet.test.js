import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GANNET_LAYOUT as L, GANNET_LIFT as P, gannetMechanismPose, gannetCollisionParts} from '../src/gannet-layout.js';
import {GannetSystems} from '../src/gannet-systems.js';
import {roverSweptBounds, roverFitsPlatform} from '../src/rover-physics.js';
import {GEAR_FLIGHT} from '../src/gear-flight.js';

const root=resolve(import.meta.dirname,'..');
const roverRoot=process.env.GANNET_ROVER_ROOT??root;
const point=p=>new THREE.Vector3(...p),up=new THREE.Vector3(0,1,0);
const hash=b=>createHash('sha256').update(b).digest('hex');
const close=(a,b,epsilon=.0011)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} differs from ${b}`);
const advance=(system,seconds)=>{for(let t=0;t<seconds;t+=.01)system.update(Math.min(.01,seconds-t));};

/** CPU geometry intake only. Embedded textures/materials are omitted explicitly;
 * shader compilation and WebP decoding belong to the later browser check. */
async function geometry(path){
  const bytes=await readFile(path),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size));
  const binary=bytes.subarray(28+size);
  delete doc.images;delete doc.textures;delete doc.samplers;delete doc.materials;
  for(const mesh of doc.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  for(const key of ['extensionsUsed','extensionsRequired'])doc[key]=(doc[key]??[]).filter(x=>x!=='EXT_texture_webp');
  const json=Buffer.from(JSON.stringify(doc));const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const rebuilt=Buffer.concat([header,padded,binHeader,binary]);
  const gltf=await new GLTFLoader().parseAsync(rebuilt.buffer.slice(rebuilt.byteOffset,rebuilt.byteOffset+rebuilt.byteLength),'');
  gltf.scene.updateMatrixWorld(true);return {scene:gltf.scene,sha256:hash(bytes),doc};
}
/** Preserve actual glTF material sides/opacity for first-visible-hit checks.
 * Only image decoding is replaced; this does not compile shaders or render. */
async function materialGeometry(path){
  const bytes=await readFile(path),loader=new GLTFLoader();
  loader.register(parser=>{
    parser.loadTextureImage=async index=>{const texture=new THREE.Texture();parser.associations.set(texture,{textures:index});return texture;};
    return {name:'CpuGeometryWithAuthoredMaterialSides'};
  });
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  gltf.scene.updateMatrixWorld(true);return gltf.scene;
}
let assetPromise;
const asset=()=>assetPromise??=geometry(resolve(root,'public/models/gannet.glb'));
function pose(scene,values){
  const p=gannetMechanismPose(values);
  for(const d of L.gear.nodes)scene.getObjectByName(d.node).position.y=d.position[1]+p.gearOffset;
  scene.getObjectByName(P.node).position.y=p.liftY;
  scene.updateMatrixWorld(true);
  for(const s of p.slats){const n=scene.getObjectByName(s.node);n.position.copy(n.parent.worldToLocal(point([0,s.y,s.z])));}
  scene.updateMatrixWorld(true);
}
function hasAncestor(node,names){for(let p=node;p;p=p.parent)if(names.has(p.name))return true;return false;}
function soup(scene,skip=new Set()){
  const output=[];scene.updateMatrixWorld(true);
  scene.traverse(node=>{
    if(!node.isMesh||hasAncestor(node,skip))return;
    const p=node.geometry.attributes.position,index=node.geometry.index;
    const at=i=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(node.matrixWorld);
    for(let i=0;i<(index?.count??p.count);i+=3){const triangle=new THREE.Triangle(at(i),at(i+1),at(i+2));output.push({triangle,bounds:new THREE.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]),name:node.name});}
  });return output;
}
function intersects(triangles,box){return triangles.find(t=>t.bounds.intersectsBox(box)&&box.intersectsTriangle(t.triangle));}
function clear(triangles,box,label){const hit=intersects(triangles,box);assert.equal(hit,undefined,`${label} intersects ${hit?.name}`);}
function interpolatedRoute(route,spacing=.09){
  const points=[];
  for(let i=1;i<route.length;i++){const a=point(route[i-1]),b=point(route[i]);const count=Math.ceil(a.distanceTo(b)/spacing);for(let j=0;j<=count;j++)points.push(a.clone().lerp(b,j/count));}
  return points;
}

test('lift/hatch ordering, securing, mid-motion obstruction and power guards are real',()=>{
  const s=new GannetSystems();assert.equal(s.secured,true);assert.equal(s.command('lower').ok,false);
  assert.equal(s.command('open').ok,true);advance(s,L.hatch.seconds+.02);close(s.hatch.progress,1,1e-10);
  assert.equal(s.command('lower').ok,true);advance(s,1);assert.ok(s.lift.y<P.high);assert.equal(s.command('close').ok,false);
  const y=s.lift.y;s.canMove=()=>false;advance(s,1);assert.equal(s.lift.y,y);
  s.canMove=()=>true;s.powered=false;advance(s,1);assert.equal(s.lift.y,y);s.powered=true;advance(s,4);assert.equal(s.lift.y,0);
  assert.equal(s.floorAt(point([0,L.eyeHeight,7.5])).source,'gannet-lift:vehicle');
  assert.equal(s.floorAt(point([0,P.high+L.eyeHeight,7.5])),null,'no invisible raised floor over the open shaft');
  assert.equal(s.command('raise').ok,true);advance(s,3.6);assert.equal(s.command('close').ok,true);advance(s,3.3);assert.equal(s.secured,true);
  assert.equal(s.command('teleport').ok,false);assert.equal(s.toggle('main'),false);
  assert.equal(L.gear.seconds,GEAR_FLIGHT.seconds,'shared canonical gear duration');
});

test('canonical geometry intake, rig nodes, four actual MFDs and budgets',async()=>{
  const {scene,sha256}=await asset();const manifest=JSON.parse(await readFile(resolve(root,'assets/gannet/manifest.json')));
  assert.equal(manifest.sha256,sha256);assert.ok(manifest.bytes<=L.budgets.glbBytes);assert.ok(manifest.triangles<=L.budgets.triangles);
  assert.equal(manifest.layoutSha256,hash(await readFile(resolve(root,'assets/gannet/layout.json'))));
  for(const name of [...L.requiredNodes,...L.gear.nodes.map(g=>g.node)])assert.ok(scene.getObjectByName(name),name);
  for(const [name,expected] of [['PilotEye',L.seatEye],['StandEye',L.stand],['RoverPark',L.rover.park],...L.engines.map(e=>[e.node,e.position]),...L.controls.map(c=>[c.node,c.position])]){
    const actual=scene.getObjectByName(name).getWorldPosition(new THREE.Vector3());expected.forEach((n,i)=>close(actual.getComponent(i),n));
  }
  for(const d of L.mfdMounts){
    const m=scene.getObjectByName(d.node),triangles=soup(m);assert.equal(triangles.length,2);
    const box=new THREE.Box3().setFromObject(m);close(box.getSize(new THREE.Vector3()).x,d.width);
    const anchor=scene.getObjectByName(d.anchor),q=anchor.getWorldQuaternion(new THREE.Quaternion());
    close(q.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(...d.rotation))),0);
  }
});

test('actual complete hull fits the closed envelope throughout the full gear cycle',async()=>{
  const {scene}=await asset();
  for(let i=0;i<=20;i++){
    pose(scene,{gearProgress:i/20,hatchProgress:0,liftY:P.high});
    const box=new THREE.Box3().setFromObject(scene);
    for(let k=0;k<3;k++){assert.ok(box.min.getComponent(k)>=L.flightBounds.min[k]-.0011,`minimum axis ${k}: ${box.min.getComponent(k)}`);assert.ok(box.max.getComponent(k)<=L.flightBounds.max[k]+.0011,`maximum axis ${k}: ${box.max.getComponent(k)}`);}
  }
});

test('exported open bay and both full 64 SBU banks retain their actual clear volumes',async()=>{
  const {scene}=await asset();pose(scene,{gearProgress:1,hatchProgress:1,liftY:P.high});const triangles=soup(scene);
  clear(triangles,new THREE.Box3(point([P.minX+.002,P.high+.003,P.minZ+.002]),point([P.maxX-.002,P.ceiling-.002,P.maxZ-.09])),'5.8 × 6.5 × 3.2 m bay');
  for(const grid of L.cargo.grids){const max=grid.min.map((n,i)=>n+grid.cells[i]*L.cargo.cellMetres);
    clear(triangles,new THREE.Box3(point(grid.min.map(n=>n+.003)),point(max.map(n=>n-.003))),`${grid.id} complete 64 SBU bank`);
  }
  assert.equal(L.cargo.grids.reduce((sum,g)=>sum+g.cells.reduce((a,b)=>a*b,1),0),128);
});

test('actual pressure skins close the stepped cabin roof and all fixed hatch-cassette faces',async()=>{
  const {scene}=await asset();pose(scene,{gearProgress:1,hatchProgress:1,liftY:P.high});
  const moving=new Set(Array.from({length:L.hatch.slats},(_,i)=>`HatchSlat_${i+1}`));
  const triangles=soup(scene,moving),misses=[];
  function skin(origin,direction,maximum,label){
    const ray=new THREE.Ray(point(origin),point(direction)),hit=new THREE.Vector3();
    const found=triangles.some(({triangle:t})=>ray.intersectTriangle(t.a,t.b,t.c,false,hit)&&hit.distanceTo(ray.origin)<=maximum);
    if(!found)misses.push(label);
  }
  // Short rays cross the expected pressure boundary, so a distant outer panel
  // or a moving hatch leaf cannot hide a hole in the actual local skin.
  for(const x of [-2.7,-1.8,0,1.8,2.7]){
    for(const y of [3.86,4.535,4.56,4.585])skin([x,y,3.15],[0,0,1],.45,`roof step x=${x}, y=${y}`);
    for(const z of [9.7,10.1,10.34,10.47])skin([x,4.3,z],[0,1,0],.53,`bay ceiling x=${x}, z=${z}`);
    for(const y of [4.65,4.85,5.02,5.12]){
      skin([x,y,10.72],[0,0,-1],.32,`cassette front x=${x}, y=${y}`);
      skin([x,y,10.72],[0,0,1],.32,`cassette rear x=${x}, y=${y}`);
    }
    for(const z of [10.4,10.55,10.9])skin([x,5.154,z],[0,1,0],.15,`cassette cap x=${x}, z=${z}`);
  }
  for(const side of [-1,1])for(const y of [4.66,4.9,5.12])for(const z of [10.38,10.7,10.91])skin([side*2.7,y,z],[side,0,0],.4,`cassette side ${side}, y=${y}, z=${z}`);
  assert.deepEqual(misses,[],'local pressure-skin rays escaped through authored enclosure');
});

test('actual hatch leaves clear all fixed geometry and each other throughout the full cycle',async t=>{
  const {scene}=await asset();
  const names=Array.from({length:L.hatch.slats},(_,i)=>`HatchSlat_${i+1}`);
  pose(scene,{gearProgress:1,hatchProgress:0,liftY:P.high});
  const fixed=soup(scene,new Set(names)),failures=[];
  for(let step=0;step<=100;step++){
    pose(scene,{gearProgress:1,hatchProgress:step/100,liftY:P.high});
    const leaves=names.map(name=>({name,box:new THREE.Box3().setFromObject(scene.getObjectByName(name))}));
    for(let i=0;i<leaves.length;i++){
      const leaf=leaves[i],hit=intersects(fixed,leaf.box);
      if(hit)failures.push(`${step}/100 ${leaf.name} intersects fixed ${hit.name}`);
      for(let j=i+1;j<leaves.length;j++)if(leaf.box.intersectsBox(leaves[j].box))failures.push(`${step}/100 ${leaf.name} intersects ${leaves[j].name}`);
    }
  }
  assert.deepEqual(failures,[],'actual exported hatch motion has self-collision');
  let overhead=Infinity;
  for(const name of names){
    const box=new THREE.Box3().setFromObject(scene.getObjectByName(name));
    const origin=point([0,box.max.y,(box.min.z+box.max.z)/2]),ray=new THREE.Ray(origin,up),hit=new THREE.Vector3();
    const distances=fixed.flatMap(({triangle:p})=>ray.intersectTriangle(p.a,p.b,p.c,false,hit)?[hit.distanceTo(origin)]:[]);
    assert.ok(distances.length,`${name} has no real cassette cap overhead`);
    overhead=Math.min(overhead,...distances);
  }
  assert.ok(overhead>=.020,`fully open leaves have only ${overhead} m below the actual cap`);
  t.diagnostic(`Minimum exported open-leaf/cap clearance: ${(overhead*1000).toFixed(2)} mm`);
});

test('current Burrow full steering/suspension and actual door sweep clear new hull through all lift heights',async()=>{
  const {scene}=await asset();
  const roverLayout=JSON.parse(await readFile(resolve(roverRoot,'assets/mining-rover/layout.json')));
  const rover=await geometry(resolve(roverRoot,'public/models/mining-rover.glb'));
  const rotation=new THREE.Quaternion().setFromAxisAngle(up,L.rover.heading),position=point(L.rover.park);
  assert.equal(roverFitsPlatform(position,rotation,{...P,position:new THREE.Vector3(),quaternion:new THREE.Quaternion()},{layout:roverLayout,margin:.35}),true);
  const bounds=roverSweptBounds(roverLayout),roverGroup=rover.scene;
  roverGroup.position.copy(position);roverGroup.quaternion.copy(rotation);roverGroup.updateMatrixWorld(true);
  const door=roverGroup.getObjectByName('CabinDoor');assert.ok(door);
  for(let i=0;i<=14;i++){
    const y=P.low+(P.high-P.low)*i/14;pose(scene,{gearProgress:1,hatchProgress:1,liftY:y});
    const triangles=soup(scene,new Set([P.node]));
    const full=new THREE.Box3();
    for(const x of [bounds.min[0],bounds.max[0]])for(const yy of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])full.expandByPoint(point([x,yy,z]).applyQuaternion(rotation).add(point([position.x,y,position.z])));
    clear(triangles,full,`complete rover, lift ${y}`);
    roverGroup.position.y=y;
    for(let step=0;step<=16;step++){
      door.rotation.y=step/16*1.65;roverGroup.updateMatrixWorld(true);
      clear(triangles,new THREE.Box3().setFromObject(door),`actual rover door ${step}/16, lift ${y}`);
    }
  }
});

test('conservative full-player sweeps cover cabin, side approach and every physical rover entry waypoint',async()=>{
  const {scene}=await asset();pose(scene,{gearProgress:1,hatchProgress:1,liftY:P.high});const triangles=soup(scene);
  const roverLayout=JSON.parse(await readFile(resolve(roverRoot,'assets/mining-rover/layout.json')));
  const rotation=new THREE.Quaternion().setFromAxisAngle(up,L.rover.heading),park=point(L.rover.park);
  const entry=[roverLayout.cabin.entryGround,...roverLayout.cabin.entryRoute].map(p=>point(p).applyQuaternion(rotation).add(park).toArray());
  const route=[L.stand,...L.rover.approach,...entry];
  for(const eye of interpolatedRoute(route)){
    // This box contains the existing 0.25 m walking capsule; it is deliberately
    // conservative, with its soles just above the real support surface.
    const box=new THREE.Box3(eye.clone().add(point([-.25,-1.71,-.25])),eye.clone().add(point([.25,.05,.25])));
    clear(triangles,box,`player at ${eye.toArray().map(n=>n.toFixed(2))}`);
  }
  const s=new GannetSystems();
  for(const eye of interpolatedRoute([L.stand,...L.rover.approach]))assert.ok(s.floorAt(eye),`floor at ${eye.toArray()}`);
});

test('actual authored cabin, vestibule and lift floors support the clear walking route',async()=>{
  const {scene}=await asset();pose(scene,{gearProgress:1,hatchProgress:1,liftY:P.high});
  const floors=['CabinFloor','VestibuleFloor','LiftDeck'].map(n=>scene.getObjectByName(n));assert.ok(floors.every(Boolean));
  floors.forEach(n=>n.traverse(m=>{if(m.isMesh)m.material.side=THREE.DoubleSide;}));
  const ray=new THREE.Raycaster();let count=0;
  for(const eye of interpolatedRoute([L.stand,...L.rover.approach])){
    ray.set(eye,new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(floors,true)[0];assert.ok(hit,`missing actual floor at ${eye.toArray()}`);close(hit.point.y,L.floorY);count++;
  }
  assert.ok(count>130);
});

test('canonical pilot forward rays cross retained pressure glass without an opaque centre brace',async()=>{
  const {scene}=await asset();pose(scene,{gearProgress:1,hatchProgress:0,liftY:P.high});
  const glassNames=new Set();scene.traverse(n=>{if(n.isMesh&&/pressure.glazing/i.test(n.name))glassNames.add(n.name);});
  assert.ok(glassNames.size,'actual pressure-glazing mesh must be retained');
  const solid=soup(scene,glassNames),glass=[];
  scene.traverse(n=>{if(glassNames.has(n.name))glass.push(...soup(n));});
  const eye=point(L.seatEye),failures=[];
  function first(ray,triangles){
    const hit=new THREE.Vector3();let distance=Infinity;
    for(const {triangle:p} of triangles)if(ray.intersectTriangle(p.a,p.b,p.c,false,hit)){
      const d=hit.distanceTo(eye);if(d>.01&&d<20)distance=Math.min(distance,d);
    }
    return distance;
  }
  for(const pitch of [-5,0,10])for(const yaw of [-8,0,8]){
    const direction=point([Math.sin(yaw*Math.PI/180),Math.tan(pitch*Math.PI/180),-Math.cos(yaw*Math.PI/180)]).normalize();
    const ray=new THREE.Ray(eye,direction),pane=first(ray,glass),obstacle=first(ray,solid);
    if(!Number.isFinite(pane))failures.push(`missing actual glass at yaw ${yaw}, pitch ${pitch}`);
    if(Number.isFinite(obstacle))failures.push(`opaque obstacle ${obstacle.toFixed(6)} m ahead at yaw ${yaw}, pitch ${pitch}`);
  }
  assert.deepEqual(failures,[],'the main pilot sightline must remain free of central structure');
});

test('all four actual MFD faces are first visible from the canonical pilot eye with authored material sides',async()=>{
  const scene=await materialGeometry(resolve(root,'public/models/gannet.glb')),eye=point(L.seatEye),meshes=[];
  scene.traverse(n=>{if(n.isMesh)meshes.push(n);});
  const failures=[];let samples=0;
  for(const {node:name} of L.mfdMounts){
    const target=scene.getObjectByName(name),surfaces=[];target.traverse(n=>{if(n.isMesh)surfaces.push(n);});
    assert.equal(surfaces.length,1,`${name} actual surface`);
    const surface=surfaces[0],{position,uv}=surface.geometry.attributes,index=surface.geometry.index;
    function onFace(u,v){
      for(let k=0;k<index.count;k+=3){
        const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)],t=ids.map(i=>new THREE.Vector2().fromBufferAttribute(uv,i));
        const divisor=(t[1].y-t[2].y)*(t[0].x-t[2].x)+(t[2].x-t[1].x)*(t[0].y-t[2].y);
        const a=((t[1].y-t[2].y)*(u-t[2].x)+(t[2].x-t[1].x)*(v-t[2].y))/divisor;
        const b=((t[2].y-t[0].y)*(u-t[2].x)+(t[0].x-t[2].x)*(v-t[2].y))/divisor,c=1-a-b;
        if(Math.min(a,b,c)<-1e-6)continue;
        return ids.reduce((p,i,j)=>p.addScaledVector(new THREE.Vector3().fromBufferAttribute(position,i),[a,b,c][j]),new THREE.Vector3()).applyMatrix4(surface.matrixWorld);
      }
      assert.fail(`${name} is missing screen area at UV ${u},${v}`);
    }
    for(const u of [.08,.5,.92])for(const v of [.08,.5,.92]){
      const point=onFace(u,v),direction=point.clone().sub(eye);
      const ray=new THREE.Raycaster(eye,direction.clone().normalize(),.01,direction.length()+.01);
      const first=ray.intersectObjects(meshes,false).find(hit=>{
        const material=Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material;
        return !material.transparent;
      });
      if(first?.object!==surface)failures.push(`${name} UV ${u},${v}: first opaque hit ${first?.object.name??'none'}`);
      samples++;
    }
  }
  assert.equal(samples,36);
  assert.deepEqual(failures,[],'a bezel or other opaque part obscures an actual display face');
});

test('actual display backings join their shelf and hull support while remaining clear of the pressure glass',async t=>{
  const {scene}=await asset(),triangles=soup(scene),parts=gannetCollisionParts();
  const shelf=parts.find(p=>p.name==='Instrument support shelf');assert.ok(shelf);
  const shelfBox=new THREE.Box3(point(shelf.min),point(shelf.max));
  const glass=triangles.filter(p=>/pressure.glazing/i.test(p.name));assert.ok(glass.length);
  clear(glass,shelfBox.clone().expandByScalar(.001),'complete support shelf and 1 mm packing margin');
  const cabin=triangles.filter(p=>/^Cabin.*original_Meridian_PBR/.test(p.name));
  const hull=triangles.filter(p=>/^OuterHull.*original_Meridian_PBR/.test(p.name));
  function crossings(origin,geometry){
    const direction=point([0,0,-1]),ray=new THREE.Ray(point(origin),direction),hits=[],hit=new THREE.Vector3();
    for(const {triangle:p} of geometry)if(ray.intersectTriangle(p.a,p.b,p.c,false,hit)){
      const d=hit.distanceTo(ray.origin),dot=p.getNormal(new THREE.Vector3()).dot(direction);
      if(d>0&&d<1.5&&Math.abs(dot)>.01)hits.push({d,enter:dot<0,point:hit.clone()});
    }
    return hits.sort((a,b)=>a.d-b.d).filter((p,i,all)=>i===0||Math.abs(p.d-all[i-1].d)>1e-5||p.enter!==all[i-1].enter);
  }
  let overlap=Infinity;
  for(const [i,mount] of L.mfdMounts.entries()){
    const backing=parts.find(p=>p.name===`MFD bezel${i?'.'+String(i).padStart(3,'0'):''}`);assert.ok(backing);
    const backingBox=new THREE.Box3(point(backing.min),point(backing.max)).expandByScalar(.001);
    const hits=crossings([mount.position[0],2.36,-9.7],cabin);
    assert.deepEqual(hits.map(h=>h.enter),[true,true,false,false],`${mount.node} backing and shelf must overlap as two actual closed solids`);
    assert.ok(backingBox.containsPoint(hits[0].point));assert.ok(shelfBox.clone().expandByScalar(.001).containsPoint(hits[1].point));
    overlap=Math.min(overlap,hits[2].d-hits[1].d);
  }
  assert.ok(overlap>.001,`mount/shelf penetration is only ${overlap} m`);
  const shelfHits=crossings([0,2.28,-9.7],cabin),hullHits=crossings([0,2.28,-9.7],hull);
  const shelfEnd=shelfHits.find(h=>!h.enter),hullStart=hullHits.find(h=>h.enter);assert.ok(shelfEnd&&hullStart);
  const gap=Math.abs(shelfEnd.d-hullStart.d);assert.ok(gap<.001,`support shelf is separated from its hull mounting face by ${gap} m`);
  t.diagnostic(`Minimum actual backing/shelf overlap: ${(overlap*1000).toFixed(2)} mm; shelf/hull fitted-face gap: ${(gap*1000).toFixed(3)} mm`);
});
