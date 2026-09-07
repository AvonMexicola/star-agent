import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from '/tmp/star-agent-kestrel/node_modules/three/build/three.module.js';
import {GLTFLoader} from '/tmp/star-agent-kestrel/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

const ROOT='/tmp/star-agent-atlas-refresh';
const OUT=ROOT+'/docs/qa/atlas-fleet-refresh/baseline-review';
const EXPECTED='a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa';
const layout=JSON.parse(await fs.readFile(ROOT+'/assets/atlas-mark-ii/layout.json','utf8'));
const sourcePaths={
 "'three'":"'file:///tmp/star-agent-kestrel/node_modules/three/build/three.module.js'",
 "'../assets/atlas-mark-ii/layout.json'":`'file://${ROOT}/assets/atlas-mark-ii/layout.json'`,
 "'../assets/atlas-mark-ii/interior-colliders.json'":`'file://${ROOT}/assets/atlas-mark-ii/interior-colliders.json'`,
 "'../assets/atlas-mark-ii/mount-standard.json'":`'file://${ROOT}/assets/atlas-mark-ii/mount-standard.json'`,
 "'./boarding.js'":`'file://${ROOT}/src/boarding.js'`,
};
async function sourceModule(name){
 let source=await fs.readFile(ROOT+'/src/'+name,'utf8');
 for(const [from,to] of Object.entries(sourcePaths)) source=source.replaceAll(from,to);
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const {AtlasMarkIISystems}=await sourceModule('atlas-mark-ii-systems.js');
const mounts=await sourceModule('weapon-mounts.js');
const bytes=await fs.readFile(ROOT+'/public/models/atlas-mark-ii/atlas-mark-ii.glb');
const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256,EXPECTED);
const jsonLength=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const originalGltf=structuredClone(gltf);
const binary=bytes.subarray(28+jsonLength);
for(const mesh of gltf.meshes) for(const p of mesh.primitives) delete p.material;
for(const key of ['materials','textures','images','samplers']) delete gltf[key];
const json=Buffer.from(JSON.stringify(gltf)), jl=(json.length+3)&~3, bl=(binary.length+3)&~3;
const stripped=Buffer.alloc(28+jl+bl);
stripped.writeUInt32LE(0x46546c67,0);stripped.writeUInt32LE(2,4);stripped.writeUInt32LE(stripped.length,8);
stripped.writeUInt32LE(jl,12);stripped.writeUInt32LE(0x4e4f534a,16);stripped.fill(0x20,20,20+jl);json.copy(stripped,20);
stripped.writeUInt32LE(bl,20+jl);stripped.writeUInt32LE(0x004e4942,24+jl);binary.copy(stripped,28+jl);
globalThis.ProgressEvent??=class {constructor(type,init={}){this.type=type;Object.assign(this,init);}};
const {scene}=await new GLTFLoader().parseAsync(stripped.buffer.slice(stripped.byteOffset,stripped.byteOffset+stripped.byteLength),'');
scene.updateMatrixWorld(true);
const v=new THREE.Vector3();
function exactBounds(root,frame=null){
 const box=new THREE.Box3(),inverse=frame?.matrixWorld.clone().invert();let vertices=0;
 root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
  const m=inverse?inverse.clone().multiply(o.matrixWorld):o.matrixWorld;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);box.expandByPoint(v);vertices++;}
 });
 return {min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray(),vertices};
}
const baselineBounds=exactBounds(scene);
const cargoLaneProbe=[];
for(const [y,z] of [[3.0,-5.1],[3.92,-5.1],[3.93,-5.005]]){
 const ray=new THREE.Raycaster(new THREE.Vector3(0,y,z),new THREE.Vector3(1,0,0),0,4);
 const hit=ray.intersectObject(scene,true)[0];
 cargoLaneProbe.push({origin:[0,y,z],direction:[1,0,0],maxX:4,hit:hit?{position:hit.point.toArray(),mesh:hit.object.name,distance:hit.distance}:null});
}
const named=[];
for(const name of [...layout.ramps.flatMap(r=>[r.node,r.tipNode]),layout.elevator.node,...layout.elevator.gateNodes,...layout.mounts.map(m=>m.node),...layout.pilotMFDs.map(m=>m.node)]){
 const o=scene.getObjectByName(name);assert.ok(o&&!o.isMesh,name+' must remain an independent transform');
 named.push({name,parent:o.parent?.name,localPosition:o.position.toArray(),worldPosition:o.getWorldPosition(new THREE.Vector3()).toArray(),worldQuaternion:o.getWorldQuaternion(new THREE.Quaternion()).toArray(),scale:o.getWorldScale(new THREE.Vector3()).toArray(),localBounds:exactBounds(o,o),metadata:o.userData});
}
const socketFrames=layout.mounts.map(def=>{
 const o=scene.getObjectByName(def.node),q=o.getWorldQuaternion(new THREE.Quaternion());
 assert.ok(o.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...def.position))<1e-5);
 const expected=new THREE.Quaternion().setFromEuler(new THREE.Euler(...def.rotation));assert.ok(Math.abs(q.dot(expected))>1-1e-7);
 assert.equal(o.userData.mountSize,3);assert.ok(mounts.mountTransformFromAsset(scene,def,{size:3}).equals(o.matrixWorld));
 assert.equal(mounts.mountAccepts(def,{size:3}),true);assert.equal(mounts.mountAccepts(def,{size:1}),false);
 return {name:def.node,size:3,normal:new THREE.Vector3(0,1,0).applyQuaternion(q).toArray(),bore:new THREE.Vector3(0,0,-1).applyQuaternion(q).toArray(),metadata:o.userData};
});
const systems=new AtlasMarkIISystems().bind(scene);
const settle=(rider=null)=>{for(let i=0;i<300;i++){const dy=systems.update(.05,rider);if(rider)rider.y+=dy;}};
settle();
function rayFloor(root,x,z,expected){
 const ray=new THREE.Raycaster(new THREE.Vector3(x,expected+.12,z),new THREE.Vector3(0,-1,0),0,.3);
 const hit=ray.intersectObject(root,true).find(h=>h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.5);
 return {x,z,expected,visibleY:hit?.point.y??null,error:hit?hit.point.y-expected:null,node:hit?.object.name??null};
}
const cargoSamples=[];
for(const x of [-3.7,0,3.7])for(let z=-23;z<=23;z+=2) cargoSamples.push(rayFloor(scene,x,z,layout.cargo.floor));
const upperSamples=[];
for(const x of [-.7,0,.7])for(let z=-11;z<=17;z+=2) upperSamples.push(rayFloor(scene,x,z,layout.upper.floor));
const rampSamples=[];
for(const ramp of systems.ramps){
 assert.ok(systems.toggleRamp(ramp.id));settle();
 assert.equal(ramp.angle,ramp.openAngle);assert.equal(ramp.tipAngle,0);
 const length=ramp.length*Math.cos(ramp.openAngle);
 for(const x of [-3.7,0,3.7])for(const fraction of [.03,.15,.33,.5,.67,.82,.97]){
  const distance=length*fraction,z=ramp.pivot[2]+ramp.outward*distance;
  const floor=ramp.pivot[1]-ramp.outward*distance*Math.tan(ramp.openAngle);
  const floorAt=systems.floorAt(new THREE.Vector3(x,floor+layout.eyeHeight,z));
  assert.ok(Math.abs(floorAt-floor)<1e-9);
  rampSamples.push({ramp:ramp.id,fraction,...rayFloor(ramp.nodeObject,x,z,floor),runtimeFloor:floorAt});
 }
}
const rider=new THREE.Vector3(layout.elevator.centre[0],layout.elevator.low+layout.eyeHeight,layout.elevator.centre[1]);
assert.ok(systems.toggleElevator(rider));
const liftSamples=[];
for(let i=0;i<140;i++){
 const before=systems.elevator.y,dy=systems.update(.05,rider);rider.y+=dy;
 assert.ok(Math.abs(rider.y-layout.eyeHeight-systems.elevator.y)<1e-10);
 if(i%10===0||i===139)liftSamples.push({sample:i,y:systems.elevator.y,carry:dy,gateZ:systems.gates.map(g=>g.z),...rayFloor(systems.elevator.nodeObject,rider.x,rider.z,systems.elevator.y)});
 if(systems.elevator.waitingForGates)assert.equal(systems.elevator.y,before);
}
settle(rider);assert.equal(systems.elevator.y,layout.elevator.high);
const eye=layout.upper.floor+layout.eyeHeight;
const routes=[
 {name:'walking through lower lift call pedestal currently has no collider',from:[3.5,layout.cargo.floor+layout.eyeHeight,-6],to:[3.5,layout.cargo.floor+layout.eyeHeight,-4.5]},
 {name:'galley doorway',from:[0,eye,2.8],to:[2.5,eye,2.8]},
 {name:'galley to hygiene',from:[2.5,eye,2.8],to:[2.5,eye,12.2]},
 {name:'hygiene return to corridor',from:[2.5,eye,12.2],to:[0,eye,12.2]},
 {name:'crew doorway',from:[0,eye,2.8],to:[-2.5,eye,2.8]},
 {name:'crew desk blocks a straight line on its inboard side',from:[-2.5,eye,2.8],to:[-2.5,eye,15.5]},
 {name:'crew aisle past the desk',from:[-3.1,eye,3],to:[-3.1,eye,16.2]},
];
for(const r of routes){r.result=systems.constrain(new THREE.Vector3(...r.from),new THREE.Vector3(...r.to)).toArray();r.allowed=new THREE.Vector3(...r.result).distanceTo(new THREE.Vector3(...r.to))<1e-9;}
const summarize=samples=>({samples:samples.length,missing:samples.filter(s=>s.visibleY===null).length,minError:Math.min(...samples.filter(s=>s.error!==null).map(s=>s.error)),maxError:Math.max(...samples.filter(s=>s.error!==null).map(s=>s.error))});
const audit={sha256,bytes:bytes.length,scope:'Read-only exact world-vertex bounds, named transforms, actual runtime systems bound to original GLB, limited downward surface rays and selected authored collider routes. Materials omitted only for Node decoding; no geometry changed. Not complete collision or animation clearance certification.',moduleResolution:'Original source imported with absolute dependency specifiers; Three.js/GLTFLoader reused from installed Kestrel worktree. No Atlas source edits.',baselineBounds,nominalBounds:layout.hull,named,socketFrames,cargoLaneProbe,sharedMountSizes:mounts.WEAPON_MOUNT_SIZES,gearNamedNodes:originalGltf.nodes.filter(n=>/gear|landing.?leg|landing.?foot/i.test(n.name??'')).map(n=>n.name),animationClipCount:originalGltf.animations?.length??0,floorSamples:{cargo:cargoSamples,upperCorridor:upperSamples,ramps:rampSamples,lift:liftSamples},floorSummary:{cargo:summarize(cargoSamples),upperCorridor:summarize(upperSamples),ramps:summarize(rampSamples),lift:summarize(liftSamples)},selectedRoutes:routes,finalSystemsSnapshot:systems.snapshot};
await fs.writeFile(OUT+'/contract-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({sha256,baselineBounds,socketFrames,cargoLaneProbe,gearNamedNodes:audit.gearNamedNodes,floorSummary:audit.floorSummary,selectedRoutes:routes},null,2));
