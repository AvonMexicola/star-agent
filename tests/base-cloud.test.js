import {BasePower} from '../src/build/power-system.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {BaseCloud} from '../src/build/cloud.js';import {MiningStore} from '../src/mining/store.js';import {withClaimAnchor} from '../src/build/anchors.js';import {createMemoryStore} from '../server/database.js';import {createBaseSites} from '../server/base-sites.js';import {DECAY_MS} from '../src/build/power.js';import {bodySurfacePoint,SELENE} from '../src/celestial.js';import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';import {Vector3} from 'three';
async function fixture(){
 const disk=new Map(),storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)},store=new MiningStore(storage),db=createMemoryStore(),account=await db.createAccount({email:'cloud@test.invalid',callsign:'Cloud',passwordHash:'hash'});let time=0;
 const service=createBaseSites({store:db,now:()=>time});
 const claim=withClaimAnchor({id:'build-claim-1',owner:'local-player',body:'selene',name:'Cloud base',radius:64,useBuffer:false,origin:bodySurfacePoint(new Vector3(...MOON_LANDING_DIRECTION),SELENE).toArray(),quaternion:[0,0,0,1],pieces:[{id:'build-piece-2',type:'mainframe',position:[0,0,0],rotation:0,doorOpen:false},{id:'build-piece-3',type:'uranium-generator',position:[4,0,0],rotation:0,doorOpen:false}]});
 store.registerContainer({id:'build-core-1',name:'Cloud supplies',kind:'base',boxes:2});store.write({...store.withItems(store.state,'build-core-1',{'uranium-ore':1,'metal-stock':10}),build:{version:1,nextId:4,claims:[claim]}});
 const build={sync(){},get claims(){return store.state.build.claims;}},power={};
 const fetchImpl=async(url,options)=>{if(url.endsWith('/session'))return {ok:true,json:async()=>({account})};try{const data=await service.command(account.id,options.body?JSON.parse(options.body):{action:'read'});return {ok:true,json:async()=>({...data,accountId:account.id})};}catch(e){return {ok:false,json:async()=>({error:e.message})};}};
 const cloud=new BaseCloud({store,build,power,fetchImpl});return {cloud,store,db,account,disk,storage,setTime:t=>time=t,fetchImpl};
}
test('cloud save restores bases and cargo into a fresh browser, keeping unrelated backpack',async()=>{
 const f=await fixture();assert.equal((await f.cloud.connect()).ok,true);assert.equal(f.cloud.enabled,true);
 const disk=new Map(),other=new MiningStore({getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)}),build={sync(){},get claims(){return other.state.build?.claims??[]}},cloud=new BaseCloud({store:other,build,power:{},fetchImpl:f.fetchImpl});
 const oldPack=other.container('pack').items;assert.equal((await cloud.connect()).ok,true);assert.equal(other.state.build.claims.length,1);assert.equal(other.container('build-core-1').items['uranium-ore'],1);assert.deepEqual(other.container('pack').items,oldPack);
});
test('fuel is debited once by server and survives another save without resurrection',async()=>{
 const f=await fixture();await f.cloud.connect();assert.equal((await f.cloud.action('build-claim-1','fuel','uranium-ore')).ok,true);assert.equal(f.store.container('build-core-1').items['uranium-ore'],.9);assert.equal(f.store.state.build.claims[0].power.fuel['uranium-ore'],.1);
 await f.cloud.sync();assert.equal(f.store.container('build-core-1').items['uranium-ore'],.9);assert.equal(f.store.state.build.claims[0].power.fuel['uranium-ore'],.1);
});
test('offline expiry removes cached buildings and containers on reconnection',async()=>{
 const f=await fixture();await f.cloud.connect();f.setTime(DECAY_MS+12*3600000);await f.cloud.sync();assert.equal(f.store.state.build.claims.length,0);assert.equal(f.store.container('build-core-1'),null);assert.equal(f.store.state.build.nextId,4);
});
test('failed server requests retain local construction and report an unsaved status',async()=>{
 const f=await fixture();await f.cloud.connect();const before=JSON.stringify(f.store.state.build);f.cloud.fetchImpl=async()=>{throw Error('offline');};await f.cloud.sync();assert.equal(JSON.stringify(f.store.state.build),before);assert.match(f.cloud.status,/pending.*offline/);
});
test('local writes immediately show pending and remote layout changes cannot silently erase pieces',async()=>{
 const f=await fixture();await f.cloud.connect();f.store.write({...f.store.state,build:{...f.store.state.build,claims:f.store.state.build.claims.map(c=>({...c,useBuffer:true}))}});assert.match(f.cloud.status,/pending/);await f.cloud.sync();assert.match(f.cloud.status,/Saved on server/);
 const before=f.store.state.build;await f.db.mutateBaseSites(f.account.id,p=>({...p,revision:p.revision+1,build:{...p.build,nextId:5,claims:p.build.claims.map(c=>({...c,pieces:[...c.pieces,{id:'build-piece-4',type:'battery',position:[8,0,0],rotation:0,doorOpen:false}]}))}}));
 await f.cloud.sync();assert.match(f.cloud.status,/Another session/);assert.equal(f.store.state.build,before);
});

test('lost fuel acknowledgement cannot restore spent fuel from the old local buffer',async()=>{
 const f=await fixture();await f.cloud.connect();const normal=f.cloud.fetchImpl;
 f.cloud.fetchImpl=async(url,options)=>{const result=await normal(url,options);if(options.body&&JSON.parse(options.body).action==='fuel')throw Error('connection lost after commit');return result;};
 assert.equal((await f.cloud.action('build-claim-1','fuel','uranium-ore')).ok,false);assert.equal(f.store.container('build-core-1').items['uranium-ore'],1);
 f.cloud.fetchImpl=normal;await f.cloud.sync();assert.match(f.cloud.status,/inventory changed/);await f.cloud.connect();assert.equal(f.store.container('build-core-1').items['uranium-ore'],.9);assert.equal(f.store.state.build.claims[0].power.fuel['uranium-ore'],.1);
});

test('switching the authenticated account stops background saves before any upload',async()=>{
 const f=await fixture();await f.cloud.connect();let posts=0;const previous=f.cloud.fetchImpl;f.cloud.fetchImpl=async(url,options)=>{if(options.body)posts++;const response=await previous(url,options);return {...response,json:async()=>({...await response.json(),accountId:'different-account'})};};
 await f.cloud.sync();assert.equal(posts,0);assert.match(f.cloud.status,/Account changed/);
});

test('sandbox fuel refill is explicit and unavailable in regular play; local expiry cleans containers',async()=>{
 const f=await fixture();let time=0;const build={blocked:false,get claims(){return f.store.state.build.claims;}},power=new BasePower({store:f.store,build,now:()=>time});
 const before=f.store.state;assert.equal(power.action('build-claim-1','sandbox-fuel').ok,false);assert.equal(f.store.state,before);
 power.sandbox=true;assert.equal(power.action('build-claim-1','sandbox-fuel').ok,true);assert.equal(f.store.container('build-core-1').items['helium-3-regolith'],1);
 assert.equal(power.action('build-claim-1','fuel','uranium-ore').ok,true);assert.equal(f.store.container('build-core-1').items['uranium-ore'],.9);
 power.sandbox=false;f.store.write({...f.store.state,build:{...f.store.state.build,claims:f.store.state.build.claims.map(c=>({...c,power:{...c.power,fuel:{'uranium-ore':0,'helium-3-regolith':0}}}))}});time=DECAY_MS+12*3600000;assert.equal(power.action('build-claim-1','repair').ok,false);power.update();assert.equal(build.claims.length,0);assert.equal(f.store.container('build-core-1'),null);
});

test('cloud removal survives reconnect and preserves a placement made during its response',async()=>{
 const f=await fixture();await f.cloud.connect();const normal=f.cloud.fetchImpl;
 f.cloud.fetchImpl=async(url,options)=>{const result=await normal(url,options);if(options.body&&JSON.parse(options.body).action==='remove')f.store.write({...f.store.state,build:{...f.store.state.build,nextId:5,claims:f.store.state.build.claims.map(c=>({...c,pieces:[...c.pieces,{id:'build-piece-4',type:'battery',position:[8,0,0],rotation:0,doorOpen:false}]}))}});return result;};
 assert.equal((await f.cloud.action('build-claim-1','remove','build-piece-3')).ok,true);assert.deepEqual(f.store.state.build.claims[0].pieces.map(p=>p.type),['mainframe','battery']);
 f.cloud.fetchImpl=normal;await f.cloud.sync();await f.cloud.connect();assert.deepEqual(f.store.state.build.claims[0].pieces.map(p=>p.type),['mainframe','battery']);
});

test('JSONB key ordering does not turn an unchanged layout into a remote edit',async()=>{
 const f=await fixture();await f.cloud.connect();const original=f.cloud.fetchImpl;
 const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reorder(v[k])])):v;
 f.cloud.fetchImpl=async(url,options)=>{const response=await original(url,options);return {...response,json:async()=>reorder(await response.json())};};await f.cloud.sync();assert.match(f.cloud.status,/Saved on server/);
});
