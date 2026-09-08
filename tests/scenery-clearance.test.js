import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Quaternion,Group,Matrix4} from 'three';
import {SceneryClearance} from '../src/scenery-clearance.js';
import {pirateLayout} from '../src/pirate-compound/layout.js';
import {MIASMA_POSITION,MIASMA_RADIUS} from '../src/miasma-world.js';
import {FLORA_SPECIES,floraCandidates,floraCanopyRadius} from '../src/miasma-flora.js';
import {MineralFragments} from '../src/mineral-fragments.js';
const center=new Vector3(...MIASMA_POSITION),site=pirateLayout('pirate-veil'),claims=[site.claim,site.outerClaim],q=new Quaternion(...site.claim.quaternion),origin=new Vector3(...site.claim.origin),local=a=>new Vector3(...a).applyQuaternion(q).add(origin).sub(center);

test('real base footprints clear canopy and ramps without a whole claim-radius clearing',()=>{
 const clearance=new SceneryClearance(MIASMA_POSITION);assert.equal(clearance.update(claims),true);
 for(const point of [[0,0,0],[22,0,30],[6,0,-20],[17,0,40],[0,0,260],[17,0,300]])assert.equal(clearance.excludes(local(point),0),true,`Occupied footprint ${point}`);
 assert.equal(clearance.excludes(local([25,0,0]),0),false);assert.equal(clearance.excludes(local([25,0,0]),2),true);
 for(const point of [[40,0,0],[29,0,180],[70,0,260]])assert.equal(clearance.excludes(local(point),3),false,`Unoccupied nearby ground ${point}`);
 const cosmetic=structuredClone(claims);for(const claim of cosmetic)for(const p of claim.pieces){p.finish='petrol';p.graphic='helmet';p.doorOpen=true;}assert.equal(clearance.update(cosmetic),false);
 const added=structuredClone(claims);added[0].pieces.push({type:'foundation',position:[70,0,0],rotation:.5});assert.equal(clearance.update(added),true);assert.equal(clearance.excludes(local([70,0,0]),0),true);assert.equal(clearance.update(claims),true);assert.equal(clearance.excludes(local([70,0,0]),0),false);
 const moved=structuredClone(claims);moved[0].origin[0]+=100;assert.equal(clearance.update(moved),true);assert.equal(clearance.update([]),true);assert.equal(clearance.excludes(local([0,0,0]),50),false);
});

test('Veil clears intruding flora but preserves identical exterior colonies and ship clearance',()=>{
 const clearance=new SceneryClearance(MIASMA_POSITION);clearance.update(claims);const up=origin.clone().sub(center).normalize(),before=floraCandidates(up),after=floraCandidates(up,null,clearance.excludes);
 assert.ok(before.length>after.length);assert.ok(after.length>5);assert.deepEqual(after,before.filter(p=>!clearance.excludes(new Vector3(...p.point),floraCanopyRadius(p.species,p.size))));
 assert.deepEqual(floraCandidates(up),before);const ship=local([0,site.padDeck,260]);assert.ok(floraCandidates(up,ship,clearance.excludes).every(p=>new Vector3(...p.point).distanceTo(ship)>=22));
});

test('canopy margins enclose unchanged GLB geometry at accepted slope, yaw and wind extremes',()=>{
 for(const [species,name] of FLORA_SPECIES.entries()){
  const bytes=readFileSync(new URL(`../public/models/props/${name}.glb`,import.meta.url)),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length)),binStart=28+length,accessor=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION],view=gltf.bufferViews[accessor.bufferView];
  assert.equal(accessor.componentType,5126);const node=gltf.nodes.find(n=>n.mesh===0),transform=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3(...(node.translation??[0,0,0])),new Quaternion(...(node.rotation??[0,0,0,1])),new Vector3(...(node.scale??[1,1,1])));const height=accessor.max[1],slope=species<2?.18:.4,tilt=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.atan(slope));
  for(const size of [.55,1.25])for(const yaw of [0,.7,1.6,2.5])for(let i=0;i<accessor.count;i++){
   const offset=binStart+(view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??12),p=new Vector3(bytes.readFloatLE(offset),bytes.readFloatLE(offset+4),bytes.readFloatLE(offset+8));
   p.applyMatrix4(transform);p.x+=height*.012;p.z+=height*.008;p.applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw)).applyQuaternion(tilt).multiplyScalar(size);
   assert.ok(Math.hypot(p.x,p.z)<=floraCanopyRadius(species,size)+1e-6,name);
  }
 }
});

test('actual mineral instances honor changing footprints while stationary and restore outside them',()=>{
 const fragments=new MineralFragments(new Group()),clearance=new SceneryClearance(MIASMA_POSITION),position=origin.clone(),camera=position.clone();
 try{
  clearance.update([]);fragments.update(position,camera,2,null,clearance);const before=fragments.count;assert.ok(before>0);
  clearance.update(claims);fragments.update(position,camera,2,null,clearance);assert.ok(fragments.count>0&&fragments.count<before);
  const matrix=new Matrix4(),point=new Vector3();for(const mesh of fragments.meshes)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).add(fragments.anchor);assert.equal(clearance.excludes(point,.399),false);assert.ok(point.length()>MIASMA_RADIUS-5000);}
  clearance.update([]);fragments.update(position,camera,2,null,clearance);assert.equal(fragments.count,before);
 }finally{fragments.dispose();}
});
