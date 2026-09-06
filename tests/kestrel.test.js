import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent??=class ProgressEvent{constructor(type,init={}){this.type=type;Object.assign(this,init);}};

const path=new URL('../assets/kestrel/kestrel.glb',import.meta.url),bytes=fs.readFileSync(path);
const length=bytes.readUInt32LE(12),document=JSON.parse(bytes.subarray(20,20+length));
const manifest=JSON.parse(fs.readFileSync(new URL('../assets/kestrel/manifest.json',import.meta.url)));
const contract=JSON.parse(fs.readFileSync(new URL('../assets/kestrel/contract.json',import.meta.url)));
// Node verifies real glTF geometry/animation with its binary buffers. Browser
// tests separately decode WebP and compile/render the actual PBR materials.
const data=structuredClone(document),binStart=20+length+8;
data.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(binStart).toString('base64');
for(const m of data.materials||[]){
 delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;
 if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}
}
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(data),'');
function close(a,b,t=.015){assert.ok(Math.abs(a-b)<t,`${a} differs from ${b}`);}
function bounds(tree,filter=()=>true){tree.updateMatrixWorld(true);const box=new THREE.Box3();tree.traverse(o=>{if(o.isMesh&&filter(o)){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return box;}
function pose(name,time){const root=gltf.scene.clone(true),mixer=new THREE.AnimationMixer(root),clip=THREE.AnimationClip.findByName(gltf.animations,name),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1).play();action.paused=true;action.time=time;mixer.update(0);root.updateMatrixWorld(true);return root;}

test('shipped Kestrel stays within the actual binary, triangle and texture budgets',()=>{
 assert.ok(bytes.length<=4_000_000);assert.equal(bytes.length,manifest.bytes);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
 const triangles=document.meshes.reduce((n,m)=>n+m.primitives.reduce((v,p)=>v+document.accessors[p.indices].count/3,0),0);
 assert.ok(triangles<=60_000);assert.equal(triangles,manifest.triangles);
 assert.ok(document.images.length>=3);
 for(const image of document.images){assert.equal(image.mimeType,'image/webp');const bv=document.bufferViews[image.bufferView],b=bytes.subarray(binStart+bv.byteOffset,binStart+bv.byteOffset+bv.byteLength);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');}
});
test('closed asset has metre-scale dimensions, a real ground datum and belly clearance',()=>{
 const b=bounds(gltf.scene),size=b.getSize(new THREE.Vector3());close(b.min.y,0);close(size.x,9);close(size.y,3.2);close(size.z,13.5);
 const belly=bounds(gltf.scene,o=>{for(let p=o;p;p=p.parent)if(p.name.startsWith('Gear_')||p.name.startsWith('Ladder'))return false;return !o.name.startsWith('AB_');});assert.ok(belly.min.y>=.885,`belly ${belly.min.y}`);
});
test('all pilot, hardpoint, drive and RCS nodes keep useful transforms',()=>{
 const root=gltf.scene;root.updateMatrixWorld(true);
 for(const name of ['PilotEye','HUD_Glass','Nozzle_L','Nozzle_R','AB_L','AB_R',...contract.hardpoints,...contract.rcs.map(r=>r.name)])assert.ok(root.getObjectByName(name),name);
 const eye=root.getObjectByName('PilotEye').getWorldPosition(new THREE.Vector3());contract.pilotEye.forEach((v,i)=>close(eye.getComponent(i),v,.001));
 for(const name of contract.hardpoints){const node=root.getObjectByName(name),q=node.getWorldQuaternion(new THREE.Quaternion()),forward=new THREE.Vector3(0,0,-1).applyQuaternion(q);assert.ok(forward.distanceTo(new THREE.Vector3(0,0,-1))<1e-5);}
 for(const r of contract.rcs){const node=root.getObjectByName(r.name),dir=new THREE.Vector3(0,0,-1).applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion()));assert.ok(dir.distanceTo(new THREE.Vector3(...r.direction))<1e-5,r.name);}
 for(const side of ['L','R'])assert.equal(root.getObjectByName('AB_'+side).userData.initiallyHidden,true);
 for(const x of [-1.26,1.26]){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,1.62,10),new THREE.Vector3(0,0,-1),0,5);
  const hits=ray.intersectObject(root,true).filter(h=>!h.object.material.transparent&&!h.object.name.startsWith('AB_'));
  assert.equal(hits[0]?.object.name,'EngineCores','The visible emissive throat must sit in front of the nacelle end cap.');
 }
});
test('canopy, three gear legs and three ladder sections animate with the specified timings',()=>{
 for(const [name,duration] of Object.entries(contract.animations)){const clip=THREE.AnimationClip.findByName(gltf.animations,name);assert.ok(clip,name);close(clip.duration,duration,1e-5);}
 for(const [clip,nodeName] of [['CanopyOpen','Canopy'],['GearDown','Gear_Nose'],['GearDown','Gear_L'],['GearDown','Gear_R'],['LadderDown','Ladder'],['LadderDown','Ladder_Upper'],['LadderDown','Ladder_Middle'],['LadderDown','Ladder_Lower']]){
  const closed=pose(clip,0).getObjectByName(nodeName),open=pose(clip,contract.animations[clip]).getObjectByName(nodeName);assert.ok(closed.quaternion.angleTo(open.quaternion)>.8,nodeName);
 }
 const gearUp=pose('GearDown',0),gearDown=pose('GearDown',1.2);
 const up=bounds(gearUp,o=>{for(let p=o;p;p=p.parent)if(/^Gear_(Nose|L|R)$/.test(p.name))return true;return false;});
 assert.ok(up.min.y>.88,`retracted gear min ${up.min.y}`);close(bounds(gearDown).min.y,0);
 const ladder=pose('LadderDown',1.8),lb=bounds(ladder,o=>{for(let p=o;p;p=p.parent)if(p.name==='Ladder')return true;return false;});close(lb.min.y,0);assert.ok(lb.max.y>2);assert.ok(lb.min.x< -1.3);
 // Once a descending section passes below the shoulder, it stays outboard.
 // The authoring sweep check additionally casts every edge against the hull.
 for(let frame=0;frame<=54;frame++){
  const moving=pose('LadderDown',frame/30);
  for(const name of ['Ladder_Upper','Ladder_Middle','Ladder_Lower']){
   const branch=moving.getObjectByName(name);
   branch.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y<2)assert.ok(v.x< -1.50,`${name} crosses shoulder at frame ${frame}: ${v.toArray()}`);}
   });
  }
 }
});
test('four display faces are 4:3 and visible from the authored seated eye',()=>{
 const root=gltf.scene;root.updateMatrixWorld(true);const eye=root.getObjectByName('PilotEye').getWorldPosition(new THREE.Vector3());
 for(let i=1;i<=4;i++){
  const screen=root.getObjectByName('MFD_'+i);assert.ok(screen?.isMesh);screen.geometry.computeBoundingBox();const size=screen.geometry.boundingBox.getSize(new THREE.Vector3());close(size.x/size.y,4/3,.002);
  assert.equal(screen.userData.textureWidth,512);assert.equal(screen.userData.textureHeight,384);
  // The runtime canvas material is one-sided. A double-sided source material
  // must not hide reversed geometry during the authoring contract check.
  screen.material=screen.material.clone();screen.material.side=THREE.FrontSide;
  const centre=screen.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(screen.matrixWorld),ray=new THREE.Raycaster(eye,centre.clone().sub(eye).normalize(),0,eye.distanceTo(centre)+.003);
  const hits=ray.intersectObject(root,true).filter(h=>!h.object.material.transparent&&!h.object.name.startsWith('AB_'));
  assert.equal(hits[0]?.object.name,'MFD_'+i,`screen ${i} blocked by ${hits[0]?.object.name}`);
 }
});
