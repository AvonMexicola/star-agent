import test from 'node:test';import assert from 'node:assert/strict';
import {Scene,Vector3,Quaternion,Matrix4} from 'three';
import {planRemoval} from '../src/build/removal.js';import {BuildSystem} from '../src/build/system.js';
import {validBuild,MAX_PIECES} from '../src/build/state.js';import {initialPower,validPower} from '../src/build/power.js';
import {MiningStore} from '../src/mining/store.js';import {SELENE,bodySurfacePoint,bodySurfaceNormal} from '../src/celestial.js';import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
import {updateBaseSites} from '../server/base-sites.js';
const piece=(id,type,position)=>({id:`build-piece-${id}`,type,position,rotation:0,doorOpen:false});
function fixture(){
 const map=new Map(),disk={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},store=new MiningStore(disk),origin=bodySurfacePoint(new Vector3(...MOON_LANDING_DIRECTION),SELENE),normal=bodySurfaceNormal(origin,SELENE);
 const nav={mode:'walk',insideShip:false,body:SELENE,altitude:1.65,position:origin.clone(),normal,orientation:new Quaternion(),keys:new Set(),gamepad:{suspend(){}}};
 const build=new BuildSystem({scene:new Scene(),nav,store,render:false}),claim=build.newClaim(origin);claim.pieces=[piece(2,'mainframe',[0,0,0]),piece(3,'crate',[4,0,0]),piece(4,'foundation',[-4,.3,0]),piece(5,'wall',[-4,.3,-2])];claim.power=initialPower(Date.now());
 store.registerContainer({id:'build-core-1',name:'Core',kind:'base',boxes:2});store.registerContainer({id:'build-crate-3',name:'Crate',kind:'base',boxes:2});store.write({...store.state,build:{version:1,nextId:6,claims:[claim]}});
 function aim(p){nav.position.copy(build.toWorld(new Vector3(p.position[0],p.position[1]+1.65,p.position[2]+4),claim));const target=build.toWorld(new Vector3(...p.position).add(new Vector3(0,.7,0)),claim);nav.orientation.setFromRotationMatrix(new Matrix4().lookAt(nav.position,target,normal));}
 return {build,store,disk,claim,nav,aim};
}
test('removal protects occupied storage, mainframe and structural support',()=>{
 const f=fixture(),data=f.store.state.build,storage=f.store.state.remote;
 assert.match(planRemoval(data,storage,f.claim.id,'build-piece-2').message,/other pieces/);
 assert.match(planRemoval(data,storage,f.claim.id,'build-piece-4').message,/supports/);
 assert.match(planRemoval(data,{...storage,'build-crate-3':{items:{basalt:.1}}},f.claim.id,'build-piece-3').message,/Empty/);
 const removed=planRemoval(data,storage,f.claim.id,'build-piece-3');assert.ok(removed.ok);assert.equal(removed.build.nextId,6);assert.equal(removed.build.claims[0].pieces.length,3);
 const equipment={...f.claim,pieces:[...f.claim.pieces.filter(p=>p.type!=='wall'),piece(6,'battery',[-4,.3,0])]};assert.match(planRemoval({...data,nextId:7,claims:[equipment]},storage,f.claim.id,'build-piece-4').message,/equipment/);
});
test('actual aim selects one piece; removal persists and leaves no container or collision',async()=>{
 const f=fixture(),crate=f.claim.pieces[1];f.aim(crate);assert.ok(f.build.beginRemoval().ok);assert.equal(f.build.preview.piece.id,crate.id);assert.ok(f.build.preview.valid);
 const result=await f.build.place();assert.ok(result.ok,result.message);assert.equal(f.store.container('build-crate-3'),null);assert.equal(f.build.claims[0].pieces.length,3);assert.equal(new MiningStore(f.disk).state.build.claims[0].pieces.length,3);
 assert.notEqual(f.build.preview.piece?.id,crate.id);assert.equal(f.build.data.nextId,6);f.build.cancel();assert.equal(f.build.removing,false);f.build.dispose();
});
test('failed disk write leaves removal target and stored cargo intact',async()=>{
 const f=fixture();f.aim(f.claim.pieces[1]);f.build.beginRemoval();const before=f.store.state;f.disk.setItem=()=>{throw Error('quota');};assert.equal((await f.build.place()).ok,false);assert.equal(f.store.state,before);assert.ok(f.store.container('build-crate-3'));
});
test('server removal persists, rejects stale resurrection and protects filled containers',()=>{
 const f=fixture(),snapshot={action:'save',revision:0,build:f.store.state.build,storage:Object.fromEntries(Object.entries(f.store.state.remote).map(([id,c])=>[id,{...c,boxes:2}]))};let state=updateBaseSites(null,snapshot,0);
 state=updateBaseSites(state,{action:'remove',claimId:f.claim.id,item:'build-piece-3',revision:state.revision},0);assert.equal(state.build.claims[0].pieces.length,3);assert.equal(state.storage['build-crate-3'],undefined);
 assert.throws(()=>updateBaseSites(state,{...snapshot,revision:state.revision},0),/removed piece/);const restored=updateBaseSites(state,{action:'read'},0);assert.equal(restored.build.claims[0].pieces.length,3);
 let full=updateBaseSites(null,{...snapshot,storage:{...snapshot.storage,'build-crate-3':{...snapshot.storage['build-crate-3'],items:{basalt:1}}}},0);assert.throws(()=>updateBaseSites(full,{action:'remove',claimId:f.claim.id,item:'build-piece-3',revision:full.revision},0),/Empty/);assert.equal(full.storage['build-crate-3'].items.basalt,1);
});
test('1,024 pieces and their battery charge survive validation; 1,025 still has a bounded limit',()=>{
 const f=fixture(),pieces=[piece(2,'mainframe',[24,0,0]),...Array.from({length:MAX_PIECES-1},(_,i)=>piece(i+3,'battery',[i%16*2-16,0,Math.floor(i/16)*1.5-48]))];
 const claim={...f.claim,pieces,power:{...initialPower(0),charge:2+(MAX_PIECES-1)*12}},data={version:1,nextId:MAX_PIECES+2,claims:[claim]};assert.equal(MAX_PIECES,1024);assert.ok(validBuild(data));assert.ok(validPower(claim.power));assert.ok(JSON.stringify(data).length<256*1024);
 assert.equal(validBuild({...data,nextId:data.nextId+1,claims:[{...claim,pieces:[...pieces,piece(data.nextId,'battery',[30,0,0])]}]}),false);
 const result=planRemoval(data,{},claim.id,pieces[1].id);assert.ok(result.ok);assert.equal(result.build.claims[0].power.charge,claim.power.charge-12);
});

test('removal mode can aim into empty space without fabricating a target or breaking diagnostics',()=>{
 const f=fixture();f.nav.position.copy(f.build.toWorld(new Vector3(30,10,30),f.claim));f.nav.orientation.identity();f.build.beginRemoval();assert.equal(f.build.state.preview.valid,false);assert.match(f.build.state.preview.reason,/Aim/);f.build.dispose();
});
