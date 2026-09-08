import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Scene,Vector3,Quaternion,Matrix4,Box3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BuildSystem} from '../src/build/system.js';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {SELENE,bodySurfacePoint,bodySurfaceNormal,bodyAltitude} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION,LANDING_FRAME} from '../src/moon-world.js';
import {PIECES,getLocalColliders} from '../src/build/definitions.js';
import {validBuild,addBuildContainer} from '../src/build/state.js';
import {planRemoval} from '../src/build/removal.js';
import {cliffBraces,foundationDepth} from '../src/build/foundations.js';
import {configureFoundationVisual,disposeBuildVisual} from '../src/build/visuals.js';
import {getPlacementBounds,constrainBuildStep} from '../src/build/collision.js';
import {BasePower} from '../src/build/power-system.js';
import {updateBaseSites} from '../server/base-sites.js';
const v=a=>new Vector3(...a);
function fixture(){
 const diskMap=new Map(),disk={getItem:k=>diskMap.get(k)??null,setItem:(k,s)=>diskMap.set(k,s)},store=new MiningStore(disk);
 const target=bodySurfacePoint(v(MOON_LANDING_DIRECTION),SELENE),normal=bodySurfaceNormal(target,SELENE),position=target.clone().addScaledVector(v(LANDING_FRAME.east),6).addScaledVector(normal,1.65);
 const nav={position,normal,orientation:new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,target,normal)),mode:'walk',insideShip:false,altitude:1.65,body:SELENE,stationDistance:10000,keys:new Set(),gamepad:{suspend(){}},layout:{eyeHeight:1.65},notify(){}};
 const build=new BuildSystem({scene:new Scene(),nav,store,render:false});build.target=()=>target.clone();
 const fund=type=>{assert.ok(store.write(store.withItems(store.state,'pack',PIECES[type].cost)));};
 const aim=point=>{const c=build.claims[0];target.copy(build.toWorld(v(point),c));nav.position.copy(build.toWorld(v([point[0]+5,point[1]+1.65,point[2]+4]),c));};
 function place(type,point){fund(type);if(point)aim(point);build.begin(type);const r=build.place();assert.ok(r.ok,r.message);return build.claims[0].pieces.find(p=>p.id===r.pieceId);}
 return {build,store,disk,nav,target,fund,aim,place};
}
test('paid foundation-first site builds a door, secures it with a deck mainframe, reloads and reopens on removal',()=>{
 const f=fixture(),slab=f.place('foundation'),site=f.build.claims[0];
 assert.equal(site.pieces.length,1);assert.equal(f.store.container('build-core-1'),null);assert.equal(f.build.data.nextId,3);assert.ok(validBuild(f.build.data));assert.equal(f.store.container('pack').items.concrete,0);
 const door=f.place('doorway',[0,slab.position[1],-2]);assert.equal(f.build.doorFraction(door),1);
 const open=constrainBuildStep([0,slab.position[1]+1.65,0],[0,slab.position[1]+1.65,-4],f.build.livePieces(f.build.claims[0]));assert.ok(open.point[2]<-3.9);
 const c=f.build.claims[0],anchor=structuredClone(c.anchor),nextId=f.build.data.nextId;
 const core=f.place('mainframe',[0,slab.position[1],0]);assert.equal(core.position[1],slab.position[1]);assert.equal(f.build.claims.length,1);assert.deepEqual(f.build.claims[0].anchor,anchor);assert.equal(f.build.data.nextId,nextId+1);assert.ok(f.store.container('build-core-1'));
 assert.equal(planRemoval(f.build.data,f.store.state.remote,c.id,slab.id).ok,false,'cannot remove the floor under the mainframe');
 const before=f.store.state;assert.equal(f.build.place().ok,false);assert.equal(f.store.state,before);
 const saved=new MiningStore(f.disk),reloaded=new BuildSystem({scene:new Scene(),nav:f.nav,store:saved,render:false});assert.equal(reloaded.blocked,false);assert.equal(reloaded.doorFraction(door),0);
 const removed=planRemoval(reloaded.data,saved.state.remote,c.id,core.id);assert.ok(removed.ok);assert.equal(removed.build.claims[0].pieces.length,2);assert.equal(removed.build.claims[0].useBuffer,false);
 assert.ok(saved.write({...saved.state,build:removed.build}));assert.equal(reloaded.doorFraction(door),1);
});
test('new-site and later mainframe writes both roll back exact materials and IDs on disk failure',()=>{
 for(const startFoundation of [false,true]){
  const f=fixture();if(startFoundation){const slab=f.place('foundation');f.aim([0,slab.position[1],0]);}
  const type=startFoundation?'mainframe':'foundation';f.fund(type);f.build.begin(type);assert.ok(f.build.preview.valid,f.build.preview.reason);
  const before=f.store.state,raw=f.disk.getItem(MINING_KEY);f.disk.setItem=()=>{throw Error('quota');};assert.equal(f.build.place().ok,false);assert.equal(f.store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);
 }
});
test('height reaches eight metres with matching saved collision and rejects floating/invalid depths',()=>{
 const f=fixture();f.fund('foundation');f.build.begin('foundation');f.build.adjustHeight(5);
 assert.ok(f.build.preview.valid,f.build.preview.reason);const p=f.build.preview.piece;assert.ok(p.supportDepth>5);assert.ok(p.supportDepth<=8);assert.equal(getLocalColliders(p)[0].min[1],-p.supportDepth);
 assert.ok(f.build.place().ok);assert.ok(validBuild(f.build.data));
 for(const depth of [NaN,Infinity,-1,0,8.01,'6']){const bad=structuredClone(f.build.data);bad.claims[0].pieces[0].supportDepth=depth;assert.equal(validBuild(bad),false);}
 const bad=structuredClone(f.build.data);bad.claims[0].useBuffer=true;assert.equal(validBuild(bad),false);
 const c=f.build.claims[0];f.aim([8,0,0]);f.build.select('foundation');f.build.adjustHeight(9);assert.equal(f.build.preview.valid,false);
 assert.equal(f.build.setBufferEnabled(c.id,true).ok,false,'missing core never dereferences its position');
 const power=new BasePower({store:f.store,build:f.build});assert.equal(power.action(c.id,'fuel','uranium-ore').ok,false);
});
test('cliff braces seat both feet on canonical terrain at 45 degrees; rotation and missing support are checked',()=>{
 const f=fixture();f.fund('foundation-strut');f.build.begin('foundation-strut');f.build.adjustHeight(4);
 assert.ok(f.build.preview.valid,f.build.preview.reason);const {piece:p,claim:c}=f.build.preview;
 assert.ok(f.build.cliffGrounded(c,p));for(const {top,foot} of cliffBraces(p)){assert.ok(Math.abs(top[1]-foot[1]-(foot[2]-top[2]))<1e-9);assert.ok(bodyAltitude(f.build.toWorld(v(foot).applyAxisAngle(v([0,1,0]),p.rotation).add(v(p.position)),c),SELENE)<=.05);}
 assert.ok(getLocalColliders(p).filter(b=>['brace','footing'].includes(b.kind)).every(b=>b.support===false));
 assert.equal(f.build.cliffGrounded(c,{...p,position:[0,20,0]}),false);assert.ok(getPlacementBounds({...p,rotation:Math.PI/2}).max[0]>2);
 assert.ok(f.build.place().ok);const reload=new BuildSystem({scene:new Scene(),nav:f.nav,store:new MiningStore(f.disk),render:false});assert.equal(reload.blocked,false);
});
test('actual authored concrete extends to collision depth and cliff meshes follow measured brace endpoints',async()=>{
 for(const type of ['foundation','foundation-triangle','foundation-quarter','foundation-strut']){
  const bytes=await fs.readFile(new URL(`../public/models/base/${type}.glb`,import.meta.url)),scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const p={type,position:[0,0,0],rotation:0,supportDepth:6};configureFoundationVisual(scene,p);scene.updateMatrixWorld(true);
  const box=new Box3().setFromObject(scene);assert.ok(Math.abs(box.min.y+(type==='foundation-strut'?6.1:6))<.03,`${type} ${box.min.y}`);assert.ok(box.max.y<.02,'top hardware is not stretched');
  if(type==='foundation-strut')for(const [i,{top,foot}]of cliffBraces(p).entries()){
   const mesh=scene.getObjectByName(`CliffBrace${i}`),a=mesh.localToWorld(v([0,.5,0])),b=mesh.localToWorld(v([0,-.5,0]));assert.ok(a.distanceTo(v(top))<.001);assert.ok(b.distanceTo(v(foot))<.001);
  }
  disposeBuildVisual(scene);
 }
});
test('account save preserves foundation-only sites, dimensions and deck mainframes and prevents stale resizing',()=>{
 const f=fixture();const slab=f.place('foundation');
 const snapshot=revision=>({action:'save',revision,build:structuredClone(f.build.data),storage:Object.fromEntries(Object.entries(f.store.state.remote).map(([id,c])=>[id,{...c,boxes:f.store.state.boxes[id]}]))});
 let server=updateBaseSites(null,snapshot(0),0);assert.equal(server.build.claims[0].pieces.length,1);assert.deepEqual(server.storage,{});
 const core=f.place('mainframe',[0,slab.position[1],0]);server=updateBaseSites(server,snapshot(server.revision),0);assert.ok(server.storage['build-core-1']);
 const resize=snapshot(server.revision);resize.build.claims[0].pieces[0].supportDepth=7;assert.throws(()=>updateBaseSites(server,resize,0),/cannot be removed or moved/);
 server=updateBaseSites(server,{action:'remove',revision:server.revision,claimId:server.build.claims[0].id,item:core.id},0);assert.equal(server.build.claims[0].pieces.length,1);assert.equal(server.storage['build-core-1'],undefined);assert.equal(server.buffers['build-claim-1'],undefined);
 assert.throws(()=>updateBaseSites(server,{action:'repair',revision:server.revision,claimId:server.build.claims[0].id},0),/Install a mainframe/);
});

test('a real lunar cliff with 4.86 m relief supports the braced deck and a tall concrete alternative',async()=>{
 const {claim,spread}=JSON.parse(await fs.readFile(new URL('./fixtures/terrain-foundations-slope.json',import.meta.url))),f=fixture(),p=claim.pieces[0];
 f.nav.position.copy(f.build.toWorld(v([6,p.position[1]+1.65,3]),claim));assert.ok(spread>4.8);assert.equal(f.build.validate({...claim,pieces:[]},p),null);
 const heights=f.build.foundationSamples(p).map(([x,z])=>bodyAltitude(f.build.toWorld(v([x,p.position[1],z]),claim),SELENE));assert.ok(Math.max(...heights)-Math.min(...heights)>4.8);assert.ok(f.build.cliffGrounded(claim,p));
 const solid={...p,type:'foundation'};f.build.fitFoundation(claim,solid);assert.ok(solid.supportDepth>5);assert.equal(f.build.validate({...claim,pieces:[]},solid),null);
});
