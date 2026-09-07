import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {sandboxStorage,prepareSandbox,refillSandbox,sandboxTotals,sandboxClaim,SANDBOX_PREFIX,SANDBOX_BINS} from '../src/build/sandbox.js';
import {validBuild,planCost} from '../src/build/state.js';
import {bodyAltitude,SELENE} from '../src/celestial.js';
const disk=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('sandbox allocation is isolated, finite, valid and persistent across reload',()=>{
 const storage=disk(),regular=new MiningStore(storage);regular.claimStarterConstruction();const original=storage.getItem(MINING_KEY);
 const store=new MiningStore(sandboxStorage(storage));assert.equal(prepareSandbox(store).ok,true);assert.equal(store.validContainers(store.state),true);assert.equal(validBuild(store.state.build),true);
 assert.deepEqual(sandboxTotals(store),{concrete:3072,'metal-stock':768,glass:384,conductor:384});
 const paid=planCost(store,store.state,{concrete:600,'metal-stock':3},SANDBOX_BINS.map(b=>b.id));assert.equal(paid.ok,true);assert.equal(store.write(paid.next),true);
 const reload=new MiningStore(sandboxStorage(storage));assert.equal(prepareSandbox(reload).ok,true);assert.equal(sandboxTotals(reload).concrete,2472);assert.deepEqual(reload.state.build,store.state.build);
 assert.equal(storage.getItem(MINING_KEY),original);assert.ok(storage.getItem(SANDBOX_PREFIX+MINING_KEY));
});
test('refill is atomic and preserves builds, equipment, progression and carried stock',()=>{
 const storage=disk(),store=new MiningStore(sandboxStorage(storage));prepareSandbox(store);
 const paid=planCost(store,store.state,{glass:12},SANDBOX_BINS.map(b=>b.id));store.write(paid.next);const before=store.state;
 assert.equal(refillSandbox(store).ok,true);for(const key of ['build','loadout','progression','pack','ship','supplies'])assert.deepEqual(store.state[key],before[key]);
 assert.equal(sandboxTotals(store).glass,384);
 const raw=storage.getItem(SANDBOX_PREFIX+MINING_KEY),current=store.state;storage.setItem=()=>{throw Error('quota');};
 assert.equal(refillSandbox(store).ok,false);assert.equal(store.state,current);assert.equal(storage.getItem(SANDBOX_PREFIX+MINING_KEY),raw);
 assert.equal(refillSandbox(new MiningStore(disk())).ok,false);
});
test('sandbox cannot overwrite stale or unrecognized saves',()=>{
 const storage=disk(),a=new MiningStore(sandboxStorage(storage)),b=new MiningStore(sandboxStorage(storage));assert.equal(prepareSandbox(a).ok,true);const raw=storage.getItem(SANDBOX_PREFIX+MINING_KEY);assert.equal(prepareSandbox(b).ok,false);assert.equal(storage.getItem(SANDBOX_PREFIX+MINING_KEY),raw);
 const c=new MiningStore(sandboxStorage(storage));c.state={...c.state,buildSandbox:2};assert.equal(prepareSandbox(c).ok,false);
});
test('supplied foundations and mainframe rest on canonical lunar terrain',()=>{
 const c=sandboxClaim();for(const p of c.pieces)for(const x of [-2,0,2])for(const z of [-2,0,2]){
  if(p.type==='mainframe'&&(x||z))continue;
  const point=new Vector3(p.position[0]+x,p.position[1],p.position[2]+z).applyQuaternion(new Quaternion(...c.quaternion)).add(new Vector3(...c.origin));
  const altitude=bodyAltitude(point,SELENE);assert.ok(altitude>=-.001&&altitude<.6,`${p.id}: ${altitude}`);
 }
});
