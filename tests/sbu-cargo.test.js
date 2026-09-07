import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import { SBU_SIZES,crateSize,capacitySBU,placeCrate,validGrid,canRemoveCrate,crateBounds } from '../src/cargo/grid.js';
import { emptyCommerce,ensureAccount,commerceCommand,validCommerce,shipKey } from '../src/trading/model.js';
import { SHIP_LAYOUT,constrainShipStep } from '../src/boarding.js';
import { FREIGHTER_LAYOUT,LIFTS } from '../src/freighter-layout.js';
import { constrainShipAttachments } from '../src/ship-attachment-collision.js';
import { readGLBGeometry } from './helpers/gltf-geometry.js';
import { aimedGrid } from '../src/cargo/access.js';
const context={terminal:()=>true,docked:()=>true,crate:()=>true,grid:()=>true,loot:()=>true,haul:()=>true,resources:()=>1024};
function setup(){const s=emptyCommerce();ensureAccount(s,'alice',100000);ensureAccount(s,'bob',100000);return s;}
let id=0;function command(s,owner,m,ctx=context){return commerceCommand(s,owner,{commandId:`test-${++id}`,revision:s.revision,ship:shipKey(owner,'nomad'),terminal:'station:1',resource:'basalt',sbu:1,...m},ctx);}
test('SBU crate volume doubles with size; 64SBU is1.2×2.4×4.8m',()=>{for(const n of SBU_SIZES)assert.ok(Math.abs(crateSize(n).reduce((a,b)=>a*b,1)-n*.216)<1e-10);assert.deepEqual(crateSize(64),[1.2,2.4,4.8]);});
test('Nomad fits six1SBU crates; Atlas eight64SBU crates with no overlap or floating support',()=>{for(const [hull,n,size]of [['nomad',6,1],['atlas',8,64]]){const c=[];for(let i=0;i<n;i++){const p=placeCrate(hull,c,{id:`c-${i}`,sbu:size});assert.ok(p);c.push(p);}assert.equal(placeCrate(hull,c,{id:'overflow',sbu:1}),null);assert.equal(validGrid(hull,c),true);assert.equal(capacitySBU(hull),n*size);}});
for(const hullName of ['nomad','atlas'])test(`full ${hullName} cargo clears the complete rendered hull and deck details`,async()=>{
 const gltf=await readGLBGeometry(new URL(`../public/models/${hullName}.glb`,import.meta.url));let hull=gltf.scene;
 if(hullName==='nomad'){
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{createWalkableShip}=await import('../src/ship-walkable.js');
  const original=GLTFLoader.prototype.loadAsync,documentBefore=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};GLTFLoader.prototype.loadAsync=async()=>gltf;
  try{hull=createWalkableShip({assetURL:'node-geometry-fixture'});await hull.readyPromise;}finally{GLTFLoader.prototype.loadAsync=original;globalThis.document=documentBefore;}
 }
 const {scene:crate}=await readGLBGeometry(new URL(`../public/models/cargo/${hullName==='nomad'?1:64}-sbu.glb`,import.meta.url));
 const raw=new THREE.Box3().setFromObject(crate),crates=[],boxes=[];
 for(let i=0;i<(hullName==='nomad'?6:8);i++){
  const c=placeCrate(hullName,crates,{id:`mesh-${i}`,sbu:hullName==='nomad'?1:64});crates.push(c);
  const b=crateBounds(hullName,c),offset=new THREE.Vector3((b.min[0]+b.max[0])/2,b.min[1]+.01,(b.min[2]+b.max[2])/2);
  boxes.push(raw.clone().translate(offset).expandByScalar(-.0001));
 }
 hull.updateMatrixWorld(true);const triangle=new THREE.Triangle();let intersections=0;
 hull.traverseVisible(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  for(let i=0;i<(index?.count??p.count);i+=3){
   for(const [j,v]of [triangle.a,triangle.b,triangle.c].entries())v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);
   for(const box of boxes)if(box.intersectsTriangle(triangle))intersections++;
  }
 });assert.equal(intersections,0,'no crate bounds intersect the authored hull/furniture triangles');
});
test('full cargo keeps Nomad centreline and Atlas belly/side lifts physically clear',()=>{
 for(const hull of ['nomad','atlas']){const crates=[];while(true){const p=placeCrate(hull,crates,{sbu:hull==='nomad'?1:64});if(!p)break;crates.push(p);}const boxes=crates.map(c=>crateBounds(hull,c));
  for(let z=-1.2;z<3.8;z+=.1){const a=new THREE.Vector3(0,2.75,z),b=a.clone().add(new THREE.Vector3(0,0,.1));assert.deepEqual(constrainShipAttachments(a,b,boxes).toArray(),b.toArray());if(hull==='nomad')assert.deepEqual(constrainShipStep(a,b,true).toArray(),b.toArray());}
  if(hull==='atlas')for(const b of boxes){assert.ok(b.min[1]>=FREIGHTER_LAYOUT.floorY&&b.max[1]<9.3);for(const l of LIFTS)assert.ok(b.max[0]<=l.minX||b.min[0]>=l.maxX||b.max[2]<=l.minZ||b.min[2]>=l.maxZ);}
 }
});
test('buy validates physical fit and saves no partial oversized delivery',()=>{const s=setup();assert.throws(()=>command(s,'alice',{op:'buy',sbu:8}),/space/);assert.equal(s.accounts.alice.credits,100000);const r=command(s,'alice',{op:'buy',sbu:4});assert.equal(r.state.ships['alice:nomad'].crates.length,1);assert.equal(r.state.accounts.alice.credits,99920);assert.equal(validCommerce(r.state),true);});
test('take allows1SBU only and no unsupported stack; larger salvage conserves identity',()=>{let s=command(setup(),'alice',{op:'buy',sbu:2}).state;const c=s.ships['alice:nomad'].crates[0];assert.throws(()=>command(s,'bob',{op:'take',ship:'alice:nomad',crate:c.id}),/Only a 1/);s=command(s,'bob',{op:'haul',ship:'alice:nomad',destination:'bob:atlas',crate:c.id}).state;assert.equal(s.ships['alice:nomad'].crates.length,0);assert.equal(s.ships['bob:atlas'].crates[0].id,c.id);
 s=command(s,'alice',{op:'buy'}).state;const one=s.ships['alice:nomad'].crates[0];s=command(s,'bob',{op:'take',ship:'alice:nomad',crate:one.id}).state;assert.equal(s.accounts.bob.carried.id,one.id);s=command(s,'bob',{op:'stow'}).state;assert.equal(s.accounts.bob.carried,null);assert.equal(s.ships['bob:nomad'].crates[0].id,one.id);
});
test('stale, replayed, unreachable and unauthorised transactions cannot duplicate or steal',()=>{const s=setup(),m={commandId:'repeat',revision:0,op:'buy',ship:'alice:nomad',terminal:'station:1',resource:'copper',sbu:1};const r=commerceCommand(s,'alice',m,context);assert.equal(commerceCommand(r.state,'alice',m,context).state,r.state);assert.throws(()=>commerceCommand(r.state,'alice',{...m,commandId:'other'},context),/changed/);assert.throws(()=>command(r.state,'bob',{op:'take',ship:'alice:nomad',crate:r.state.ships['alice:nomad'].crates[0].id},{...context,loot:()=>false}),/Board/);assert.throws(()=>command(s,'alice',{op:'buy'},{...context,docked:()=>false}),/docked/);});
test('player stock settles both wallets exactly once and cannot be oversold',()=>{let s=setup();s.terminals['trade-1']={id:'trade-1',owner:'alice',position:[0,0,0],stock:{basalt:1},prices:{basalt:37}};s=command(s,'bob',{op:'buy',terminal:'trade-1'}).state;assert.equal(s.accounts.bob.credits,99963);assert.equal(s.accounts.alice.credits,100037);assert.equal(s.terminals['trade-1'].stock.basalt,0);assert.throws(()=>command(s,'bob',{op:'buy',terminal:'trade-1'}),/stock/);});
test('packing debits16kg perSBU and never imports insufficient loose ore',()=>{const s=setup();const r=command(s,'alice',{op:'pack',sbu:2});assert.equal(r.resourceDelta,-32);assert.throws(()=>command(s,'alice',{op:'pack',sbu:2},{...context,resources:()=>31}),/loose resources/);});

test('removing a supporting crate is denied without repacking its neighbours',()=>{const crates=[];for(let i=0;i<4;i++)crates.push(placeCrate('nomad',crates,{id:`support-${i}`,sbu:1}));assert.equal(canRemoveCrate('nomad',crates,crates[0].id),false);assert.equal(canRemoveCrate('nomad',crates,crates[2].id),true);});
test('looking at the side of Atlas cargo recognises it while looking down the Nomad aisle leaves hatch control free',()=>{
 const pose={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()},right=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0));
 assert.equal(aimedGrid(new THREE.Vector3(3.8,5.75,3),right,pose,'atlas'),true);
 assert.equal(aimedGrid(new THREE.Vector3(0,2.75,2.75),right,pose,'nomad'),true);
 assert.equal(aimedGrid(new THREE.Vector3(0,2.75,3),new THREE.Quaternion(),pose,'nomad'),false);
});

test('EVA respects closed foreign hulls, open ramps, Atlas elevator openings and cargo solids',async()=>{
 const {constrainCargoEVA}=await import('../src/cargo/physics.js');
 const pose={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()},ship={hull:'nomad',pose,crates:[],open:false};
 const from=new THREE.Vector3(0,2.75,4.8),to=new THREE.Vector3(0,2.75,3);
 assert.equal(constrainCargoEVA(from,to,[ship]).hit,true);
 ship.open=true;assert.equal(constrainCargoEVA(from,to,[ship]).hit,false);
 assert.equal(constrainCargoEVA(new THREE.Vector3(3,2.75,2),new THREE.Vector3(0,2.75,2),[ship]).hit,true,'side walls remain solid');
 ship.crates.push(placeCrate('nomad',[],{sbu:1}));assert.equal(constrainCargoEVA(new THREE.Vector3(0,1.4,2.45),new THREE.Vector3(1.2,1.4,2.45),[ship]).hit,true,'crate is a solid EVA obstacle');
 const {FreighterSystems}=await import('../src/freighter-layout.js'),atlas={hull:'atlas',pose,crates:[],systems:new FreighterSystems()};
 assert.equal(constrainCargoEVA(new THREE.Vector3(0,2,4),new THREE.Vector3(0,5.75,4),[atlas]).hit,true,'raised belly lift closes floor');
 atlas.systems.lifts[0].y=0;assert.equal(constrainCargoEVA(new THREE.Vector3(0,2,4),new THREE.Vector3(0,5.75,4),[atlas]).hit,false,'lowered lift leaves a real opening');
});
