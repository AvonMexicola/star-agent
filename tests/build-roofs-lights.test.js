import test from 'node:test';import assert from 'node:assert/strict';
import {Scene,Group,MeshStandardMaterial,Vector3,Quaternion,Matrix4,Raycaster} from 'three';import fs from 'node:fs';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {constrainBuildStep} from '../src/build/collision.js';
import {BuildSystem} from '../src/build/system.js';import {BasePower} from '../src/build/power-system.js';import {initialPower,powerDemand} from '../src/build/power.js';import {PIECES,roofProfile,getLocalColliders} from '../src/build/definitions.js';import {mountHeight,mountReason} from '../src/build/mounts.js';import {validBuild} from '../src/build/state.js';import {planRemoval} from '../src/build/removal.js';
import {MiningStore} from '../src/mining/store.js';import {SELENE,bodySurfacePoint,bodySurfaceNormal} from '../src/celestial.js';import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
const p=(id,type,position,rotation=0)=>({id:`build-piece-${id}`,type,position,rotation,doorOpen:false});
function fixture(){
 const disk=new Map(),storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)},store=new MiningStore(storage),origin=bodySurfacePoint(new Vector3(...MOON_LANDING_DIRECTION),SELENE),normal=bodySurfaceNormal(origin,SELENE);
 const nav={mode:'walk',insideShip:false,body:SELENE,altitude:2,position:origin.clone(),normal,orientation:new Quaternion(),keys:new Set(),gamepad:{suspend(){}},notify(){},stationDistance:10000};
 const build=new BuildSystem({scene:new Scene(),nav,store,render:false}),c=build.newClaim(origin);c.pieces=[p(2,'mainframe',[8,0,0]),p(3,'foundation',[0,.3,0]),p(4,'wall',[2,.3,0],Math.PI/2),p(5,'floor',[0,3.3,0])];c.power=initialPower(0);
 store.registerContainer({id:'build-core-1',name:'Supplies',kind:'base',boxes:2});store.write({...store.state,build:{version:1,nextId:6,claims:[c]}});nav.position.copy(build.toWorld(new Vector3(0,1.95,1),c));build.power=new BasePower({store,build,now:()=>0});
 const aim=point=>{const target=build.toWorld(new Vector3(...point),c);build.target=()=>target;nav.orientation.setFromRotationMatrix(new Matrix4().lookAt(nav.position,target,normal));};
 const place=(type,point)=>{aim(point);store.write(store.withItems(store.state,'pack',PIECES[type].cost));build.begin(type);const result=build.place();assert.ok(result.ok,result.message);build.cancel();return build.claims[0].pieces.at(-1);};return {build,nav,store,c,aim,place,storage};
}
test('roof skins match each ceiling footprint and ceiling lights require underside support',()=>{
 for(const [roof,floor] of [['roof-flat','floor'],['roof-edge','floor'],['roof-corner','floor'],['roof-triangle','floor-triangle'],['roof-quarter','floor-quarter']]){
  const f=p(3,floor,[0,3,0],Math.PI/2),r=p(4,roof,[0,mountHeight(f,'roof'),0],Math.PI/2);assert.equal(mountReason(r,[f]),null,roof);assert.ok(mountReason({...r,position:[8,r.position[1],0]},[f]));
 }
 const f=p(3,'floor',[0,3,0]),light=p(4,'ceiling-light',[0,2.82,0]);assert.equal(mountReason(light,[f]),null);assert.ok(mountReason({...light,position:[0,0,0]},[f]));assert.ok(mountReason(light,[{...f,type:'foundation'}]));
});
test('actual placement stacks roof above and light below the same ceiling and protects both on removal',()=>{
 const f=fixture(),lamp=f.place('ceiling-light',[0,3.12,0]),roof=f.place('roof-edge',[0,3.3,0]);assert.ok(Math.abs(lamp.position[1]-3.12)<1e-9);assert.ok(Math.abs(roof.position[1]-3.306)<1e-9);assert.ok(validBuild(f.build.data));
 assert.match(planRemoval(f.build.data,f.store.state.remote,f.c.id,'build-piece-5').message,/attached/);assert.equal(new MiningStore(f.storage).state.build.claims[0].pieces.at(-1).type,'roof-edge');f.build.dispose();
});
test('ceiling light switch persists, costs 50W only while on, and uses bounded actual light sources',()=>{
 const f=fixture(),lamp=f.place('ceiling-light',[0,3.12,0]);f.aim([0,3.06,0]);f.build.update(1/60,f.nav.position);const demand=powerDemand(f.build.claims[0]);assert.ok(f.build.visualDiagnostics.lights.fixtures.some(a=>a.id===lamp.id));
 assert.ok(f.build.interact());assert.equal(f.build.claims[0].pieces.find(p=>p.id===lamp.id).lightOn,false);f.build.update(1/60,f.nav.position);assert.ok(Math.abs(demand-powerDemand(f.build.claims[0])-.05)<1e-9);assert.ok(!f.build.visualDiagnostics.lights.fixtures.some(a=>a.id===lamp.id));
 assert.equal(new MiningStore(f.storage).state.build.claims[0].pieces.find(p=>p.id===lamp.id).lightOn,false);assert.ok(f.build.interact());f.store.write({...f.store.state,build:{...f.build.data,claims:f.build.claims.map(c=>({...c,power:{...c.power,charge:0}}))}});f.build.update(1/60,f.nav.position);assert.ok(!f.build.visualDiagnostics.lights.fixtures.some(a=>a.id===lamp.id));assert.ok(f.build.visualDiagnostics.lights.active<=4);f.build.dispose();
});
test('authored rounded caps follow their profile and conservative walking steps stay below 16cm',async()=>{
 for(const [id,shape]of [['roof-edge','edge'],['roof-corner','corner']]){
  const bytes=fs.readFileSync(new URL(`../public/models/base/${id}.glb`,import.meta.url)),scene=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;scene.updateMatrixWorld(true);
  for(const x of [0,1.5,1.7,1.9,1.99])for(const z of [0,1.5,1.7,1.9,1.99]){
   const hits=new Raycaster(new Vector3(x,2,z),new Vector3(0,-1,0)).intersectObject(scene,true);assert.ok(hits.length,id);const h=Math.max(.012,roofProfile(shape,x,z));assert.ok(Math.abs(hits[0].point.y-h)<.015,`${id} rendered profile`);
   const top=Math.max(...getLocalColliders(id).filter(b=>x>=b.min[0]&&x<=b.max[0]&&z>=b.min[2]&&z<=b.max[2]).map(b=>b.max[1]));assert.ok(top>=h-1e-7&&top-h<.16,`${id} collision ${top-h}`);
  }
 }
});

test('roof decks catch landings and allow continued walking across their rounded tops',()=>{
 for(const type of ['roof-flat','roof-edge','roof-corner']){
  const roof=p(1,type,[0,3.306,0]);let pos=[0,5.75,0],grounded=false;
  for(let i=0;i<12;i++){const result=constrainBuildStep(pos,[pos[0]+.05,pos[1]-.09,pos[2]],[roof]);pos=result.point;grounded ||= result.grounded;}
  assert.ok(grounded,type);assert.ok(pos[0]>.5,`${type} must not trap a landing player`);assert.ok(Math.abs(pos[1]-5.556)<.001,type);
  for(let i=0;i<20;i++){const result=constrainBuildStep(pos,[pos[0],pos[1]-.3,pos[2]+.1],[roof]);assert.ok(result.point[2]>pos[2]+.09,`${type} walkable curve`);pos=result.point;const skin=3.306+Math.max(.012,roofProfile(PIECES[type].roofShape,pos[0],Math.min(2,pos[2])));assert.ok(pos[1]-1.65-skin<.16,`${type} feet follow visible curve`);}
  let uphill=[...pos];for(let i=0;i<20;i++){const result=constrainBuildStep(uphill,[uphill[0],uphill[1]-.05,uphill[2]-.1],[roof]);assert.ok(result.point[2]<uphill[2]-.09,`${type} climb rounded shoulder`);assert.equal(result.grounded,true);uphill=result.point;}
  const over=constrainBuildStep(pos,[pos[0],pos[1]-.1,2.1],[roof]);assert.equal(over.grounded,false,`${type} no invisible eave support`);assert.ok(over.point[1]<pos[1]);
 }
});
test('square caps follow angled ceilings and retain quarter-turn trim choices',()=>{
 const f=fixture(),c={...f.c,pieces:[p(3,'floor',[0,3.3,0],Math.PI/3)]},target=f.build.toWorld(new Vector3(0,3.3,0),c);
 for(const type of ['roof-flat','roof-edge','roof-corner'])for(let turn=0;turn<4;turn++){f.build.pieceId=type;f.build.turn=turn;const candidate=f.build.candidates(c,target)[0];assert.equal(mountReason({...candidate,type},c.pieces),null);assert.ok(Math.abs(candidate.rotation-(Math.PI/3+turn*Math.PI/2))<1e-8);}
 f.build.pieceId='ceiling-light';assert.equal(f.build.candidates({...c,pieces:[...c.pieces,p(4,'floor',[4,3.3,0],Math.PI/3)]},target).length,1,'same-height lamp candidates are deduplicated');f.build.dispose();
});
test('live power changes update lamp material and illumination together without a store write',()=>{
 const f=fixture(),lamp=f.place('ceiling-light',[0,3.12,0]),model=new Group(),material=new MeshStandardMaterial({name:'WarmTaskLight',emissiveIntensity:3});model.userData.buildFinish={uniform:{value:1},materials:new Map([['WarmTaskLight',material]])};f.build.models.set(lamp.id,{group:model,ready:true});
 let powered=true;f.build.power={status:()=>({powered})};f.build.update(1/60,f.nav.position);const snapshot=f.build.data;assert.equal(material.emissiveIntensity,3);
 powered=false;f.build.update(1/60,f.nav.position);assert.equal(f.build.data,snapshot);assert.equal(material.emissiveIntensity,0);assert.ok(!f.build.visualDiagnostics.lights.fixtures.some(a=>a.id===lamp.id));
 powered=true;f.build.update(1/60,f.nav.position);assert.equal(material.emissiveIntensity,3);assert.ok(f.build.visualDiagnostics.lights.fixtures.some(a=>a.id===lamp.id));f.build.dispose();
});
