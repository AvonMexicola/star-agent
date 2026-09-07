import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PIECES, getLocalColliders, sampleLocalSupport } from '../src/build/definitions.js';
import { constrainBuildStep, capsuleIntersectsBox } from '../src/build/collision.js';
function glb(id) {
 const bytes=fs.readFileSync(new URL(`../public/models/base/${id}.glb`,import.meta.url));
 assert.equal(bytes.readUInt32LE(0),0x46546c67);
 return {bytes,json:JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())};
}
test('authored GLB kit has measured geometry, bounded budgets and moving leaf hierarchy',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/models/base/manifest.json',import.meta.url)));
 for(const id of Object.keys(PIECES)) {
  const {bytes,json}=glb(id);let tris=0,primitives=0;
  for(const mesh of json.meshes) for(const p of mesh.primitives) {tris+=json.accessors[p.indices].count/3;primitives++;}
  assert.equal(tris,manifest.pieces[id].triangles,id);assert.equal(primitives,manifest.pieces[id].drawPrimitives,id);
  assert.equal(bytes.length,manifest.pieces[id].bytes,id);assert.ok(tris<10000);assert.ok(bytes.length<1e6);
  assert.ok(json.materials.length>=2,id);
 }
 assert.ok(glb('doorway').json.nodes.some(n=>n.name==='DoorPanel'&&n.children.length>=2));
});
test('door opening passes a full standing capsule only while the leaf is open',()=>{
 assert.ok(getLocalColliders('doorway',false).some(b=>capsuleIntersectsBox([0,0,0],.28,1.8,b)));
 assert.equal(getLocalColliders('doorway',true).some(b=>capsuleIntersectsBox([0,0,0],.28,1.8,b)),false);
 assert.ok(getLocalColliders('doorway',true).some(b=>capsuleIntersectsBox([.65,0,0],.28,1.8,b)));
});
test('thin walls stop a long frame sweep while open doorways permit travel',()=>{
 const piece={type:'wall',position:[0,0,0],rotation:0};
 const result=constrainBuildStep([0,1.65,2],[0,1.65,-2],[piece]);assert.ok(result.hit);assert.ok(result.point[2]>.4);
 const open=constrainBuildStep([0,1.65,2],[0,1.65,-2],[{...piece,type:'doorway',doorOpen:1}]);assert.equal(open.hit,false);assert.ok(open.point[2]<-1.99);
});
test('stair ascent and descent need no jump, with no teleport onto floors overhead',()=>{
 const pieces=[{type:'stairs',position:[0,0,0],rotation:0}];let p=[0,1.65,2.4];
 for(let i=0;i<87;i++)p=constrainBuildStep(p,[p[0],p[1]-.025,p[2]-.05],pieces).point;
 assert.ok(p[1]>4.64,JSON.stringify(p));assert.ok(p[2]<-1.9);
 for(let i=0;i<76;i++)p=constrainBuildStep(p,[p[0],p[1]-.08,p[2]+.05],pieces).point;
 assert.ok(p[1]<2.3,JSON.stringify(p));
 const overhead=constrainBuildStep([0,1.65,0],[.1,1.6,0],[{type:'floor',position:[0,3,0],rotation:0}]);assert.ok(overhead.point[1]<1.7);
 assert.equal(sampleLocalSupport('floor',3,0),null);
});
test('exported structural surfaces agree with support samples and door aperture',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const {Raycaster,Vector3}=await import('three');
 const load=async id=>{const {bytes}=glb(id);const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;scene.updateMatrixWorld(true);return scene;};
 for(const id of ['foundation','floor','stairs']) {
  const scene=await load(id);
  for(const z of [-1.8,-.9,.3,1.8]) {
   const ray=new Raycaster(new Vector3(.35,5,z),new Vector3(0,-1,0));
   const hits=ray.intersectObject(scene,true);assert.ok(hits.length,`${id} floor ray`);
   assert.ok(Math.abs(hits[0].point.y-sampleLocalSupport(id,.35,z))<.02,`${id} support at ${z}`);
  }
 }
 const door=await load('doorway');const {setDoorOpen}=await import('../src/build/visuals.js');setDoorOpen(door,1);door.updateMatrixWorld(true);
 const ray=new Raycaster(new Vector3(.2,1,2),new Vector3(0,0,-1));assert.equal(ray.intersectObject(door,true).length,0);
 setDoorOpen(door,0);door.updateMatrixWorld(true);assert.ok(ray.intersectObject(door,true).length>0);
});
test('stair rails stop sideways walking without becoming support surfaces',()=>{
 const stairs={type:'stairs',position:[0,0,0],rotation:0};
 const p=constrainBuildStep([0,3.4,0],[2,3.4,0],[stairs]);
 assert.equal(p.hit,true);assert.ok(p.point[0]<.7,JSON.stringify(p));
 const rails=getLocalColliders(stairs).filter(b=>b.kind==='rail');assert.ok(rails.length);assert.ok(rails.every(b=>b.support===false));
 assert.equal(sampleLocalSupport(stairs,.96,-1.8),3);
 assert.ok(Math.max(...rails.map(b=>b.max[1]))>=3.98);
});
test('placement reserves the complete door motion, including rotated sweep',async()=>{
 const {getPlacementBoxes}=await import('../src/build/collision.js');
 const sweeps=getPlacementBoxes({type:'doorway',position:[0,0,0],rotation:0}).filter(b=>b.kind==='doorSweep');
 assert.equal(sweeps.length,2);assert.ok(Math.abs(sweeps[0].min[0]+1.54)<1e-6);assert.ok(Math.abs(sweeps[1].max[0]-1.54)<1e-6);
 assert.ok(sweeps.every(b=>b.min[0]>-1.85&&b.max[0]<1.85),'pocket leaves leave clearance for adjoining walls');
 const rotated=getPlacementBoxes({type:'doorway',position:[4,3,8],rotation:Math.PI/2}).find(b=>b.kind==='doorSweep');
 assert.ok(Math.abs(rotated.min[2]-8)<1e-6);assert.ok(Math.abs(rotated.max[1]-5.24)<1e-6);
});
test('claim envelopes contain every measured authored assembly including rails and handles',async()=>{
 const {getPlacementBounds}=await import('../src/build/collision.js');
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/models/base/manifest.json',import.meta.url)));
 for(const [type,entry] of Object.entries(manifest.pieces)) {
  const bounds=getPlacementBounds({type,position:[0,0,0],rotation:0});
  for(let i=0;i<3;i++){assert.ok(bounds.min[i]<=entry.bounds.min[i]+1e-6,type);assert.ok(bounds.max[i]>=entry.bounds.max[i]-1e-6,type);}
 }
});
test('pocket-door reservation permits perpendicular and inline connected walls',async()=>{
 const {getPlacementBoxes,getWorldBoxes}=await import('../src/build/collision.js');
 const sweeps=getPlacementBoxes({type:'doorway',position:[0,0,0],rotation:0}).filter(b=>b.kind==='doorSweep');
 const neighbors=[{type:'wall',position:[2,0,-2],rotation:Math.PI/2},{type:'wall',position:[-2,0,-2],rotation:Math.PI/2},{type:'wall',position:[4,0,0],rotation:0}];
 const overlaps=(a,b)=>a.min.every((v,i)=>v<b.max[i]&&a.max[i]>b.min[i]);
 for(const neighbor of neighbors)for(const sweep of sweeps)assert.equal(getWorldBoxes(neighbor).some(b=>overlaps(sweep,b)),false);
});
test('curved-ground submillimetre offsets permit a nominal step but not a taller riser',()=>{
 const pieces=[{type:'foundation',position:[4,.3,0],rotation:0},{type:'stairs',position:[4,.3,0],rotation:0}];
 const options={eyeHeight:1.75,radius:.28,stepHeight:.3};
 const first=constrainBuildStep([4,1.74997555,2.29],[4,1.74997555,2.24],pieces,options);
 assert.ok(first.grounded,'24 micrometre curvature offset does not reject 0.3 m foundation');
 assert.ok(Math.abs(first.point[1]-2.05)<.001,'first resolve reaches foundation height');
 const second=constrainBuildStep(first.point,[first.point[0],first.point[1],2.24],pieces,options);
 assert.ok(second.point[2]<2.25,'next resolve advances onto the first tread');
 assert.ok(Math.abs(second.point[1]-2.3)<.001);
 const tooHigh=constrainBuildStep([4,1.75,2.29],[4,1.75,2.24],[{type:'foundation',position:[4,.305,0],rotation:0}],options);
 assert.equal(tooHigh.grounded,false);assert.equal(tooHigh.hit,true);assert.deepEqual(tooHigh.point,[4,1.75,2.29]);
});

test('polished exports retain concrete vertex wear, shared status emitters and bounded material batches',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 for(const id of Object.keys(PIECES)){
  const {bytes,json}=glb(id),scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const materials=new Set();let min=1,max=0,concrete=false;
  scene.traverse(o=>{if(!o.isMesh)return;materials.add(o.material.name);if(o.material.name==='MineralConcrete'){
   concrete=true;assert.equal(o.material.vertexColors,true,id);const colors=o.geometry.getAttribute('color');assert.ok(colors,id);
   for(let i=0;i<colors.count;i++){min=Math.min(min,colors.getX(i));max=Math.max(max,colors.getX(i));}
  }});
  if(concrete){assert.ok(max-min>.05,`${id} spatial wear variation`);assert.ok(materials.has('WhiteArmour'));assert.ok(materials.has('MintStatus'));}
  if(['mainframe','doorway'].includes(id)){const status=json.materials.find(m=>m.name==='MintStatus');assert.ok(status.emissiveFactor.some(v=>v>0),`${id} authored light diffuser`);}
  assert.ok(json.materials.length<=6,id);assert.ok(json.meshes.length<=(id==='doorway'?10:5),id);
 }
});

test('rear service overlays and floor status layers have distinct visible depths',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const {Raycaster,Vector3}=await import('three');
 const load=async id=>{const {bytes}=glb(id);const scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;scene.updateMatrixWorld(true);return scene;};
 const stairs=await load('stairs'),hits=new Raycaster(new Vector3(0,1.08,-3),new Vector3(0,0,1)).intersectObject(stairs,true);
 const zFor=name=>hits.find(h=>h.object.material.name===name)?.point.z;
 assert.ok(zFor('EdgeSteel')<zFor('DarkPolymer')-.003,'vent clearly precedes plate');
 assert.ok(zFor('DarkPolymer')<zFor('MineralConcrete')-.01,'plate clearly precedes recessed concrete');
 for(const id of ['foundation','floor']){
  const scene=await load(id),hits=new Raycaster(new Vector3(1.72,1,1.72),new Vector3(0,-1,0)).intersectObject(scene,true);
  const yFor=name=>hits.find(h=>h.object.material.name===name)?.point.y;
  assert.ok(yFor('MintStatus')>yFor('WhiteArmour')+.0003,`${id} status above armour`);
  assert.ok(yFor('WhiteArmour')>yFor('MineralConcrete')+.001,`${id} armour above concrete`);
 }
});
