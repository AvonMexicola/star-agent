import test from 'node:test';
import assert from 'node:assert/strict';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {STARTER_CONSTRUCTION_ITEMS as KIT,STARTER_CONSTRUCTION_PIECES as PIECES} from '../src/mining/starter-construction.js';
import {PIECES as DEFINITIONS} from '../src/build/definitions.js';
import {carve} from '../src/mining/volume.js';
import {stacksFor,itemMass} from '../src/inventory/containers.js';
const storage=()=>{const data=new Map();let writes=0;return {data,get writes(){return writes;},getItem:k=>data.get(k)??null,setItem(k,v){writes++;data.set(k,v);}};};
test('versioned starter kit funds every declared starter piece and fits normal ship cargo',()=>{
 const cost={};for(const [id,count] of Object.entries(PIECES))for(const [item,n]of Object.entries(DEFINITIONS[id].cost))cost[item]=(cost[item]??0)+n*count;
 assert.deepEqual(cost,KIT);assert.equal(itemMass(KIT),103);assert.equal(stacksFor(KIT).length,8);
 const disk=storage(),s=new MiningStore(disk),before=structuredClone(s.state),initialWrites=disk.writes;
 assert.equal(s.claimStarterConstruction().ok,true);assert.equal(disk.writes,initialWrites+1);
 for(const [id,n]of Object.entries(KIT))assert.equal(s.container('ship').items[id],n);
 for(const key of ['pack','ship','loadout','economy','progression','field','rocks'])assert.deepEqual(s.state[key],before[key]);
 for(const [container,items]of Object.entries(before.supplies))for(const [id,n]of Object.entries(items))assert.equal(s.state.supplies[container][id],n);
 assert.equal(s.state.starterConstruction.claimed,true);assert.equal(s.validContainers(s.state),true);
 const writes=disk.writes;assert.equal(s.claimStarterConstruction().ok,true);assert.equal(disk.writes,writes);
 const reload=new MiningStore(disk);assert.equal(reload.claimStarterConstruction().ok,true);assert.equal(disk.writes,writes);assert.deepEqual(reload.state,s.state);
});
test('old saves retain all cargo and cuts; absent receipt migrates pending without retroactive XP',()=>{
 const disk=storage(),s=new MiningStore(disk);assert.equal(s.commit(carve(s.state.field,[0,0,1.35],.025),0),true);const cut=s.state.field.slice();s.state.ship=[12,1,0];s.state.materials.ship={concrete:2};s.state.progression.mining.xp=333;s.state.build={preserved:true};s.write(s.state);
 const old=JSON.parse(disk.getItem(MINING_KEY));delete old.starterConstruction;disk.setItem(MINING_KEY,JSON.stringify(old));const raw=disk.getItem(MINING_KEY),loaded=new MiningStore(disk);
 assert.equal(disk.getItem(MINING_KEY),raw);assert.equal(loaded.state.starterConstruction.claimed,false);assert.equal(loaded.claimStarterConstruction().ok,true);
 assert.deepEqual(loaded.state.field,cut);assert.equal(loaded.state.revision,1);assert.equal(loaded.container('ship').items.concrete,82);assert.deepEqual(loaded.state.ship,[12,1,0]);assert.equal(loaded.state.progression.mining.xp,333);assert.deepEqual(loaded.state.build,{preserved:true});
 assert.equal(loaded.transfer('concrete','ship','pack',16).ok,true);assert.equal(loaded.stow(),true);assert.equal(loaded.claimStarterConstruction().ok,true);assert.equal(loaded.container('ship').items.concrete,82);
});
test('full mass or slots retain pending kit and existing state; freeing room enables exactly one claim',()=>{
 for(const kind of ['mass','slots']){
  const disk=storage(),s=new MiningStore(disk);if(kind==='mass')s.state.ship=[192,0,0];else{s.state.supplies.ship={sample:32};}
  assert.equal(s.write(s.state),true);const state=s.state,raw=disk.getItem(MINING_KEY);assert.equal(s.claimStarterConstruction().ok,false);assert.equal(s.state,state);assert.equal(disk.getItem(MINING_KEY),raw);assert.equal(new MiningStore(disk).state.starterConstruction.claimed,false);
  s.state=s.withItems(s.state,'ship',{});s.state.boxes.ship=4;assert.equal(s.claimStarterConstruction().ok,true);assert.equal(s.container('ship').items.concrete,80);
 }
});
test('quota and stale saves never issue a receipt or partial cargo; valid retry only grants once',()=>{
 const disk=storage(),s=new MiningStore(disk);s.write(s.state);const before=s.state,raw=disk.getItem(MINING_KEY),writer=disk.setItem;disk.setItem=()=>{throw Error('quota');};
 assert.equal(s.claimStarterConstruction().ok,false);assert.equal(s.state,before);assert.equal(disk.getItem(MINING_KEY),raw);assert.equal(s.state.starterConstruction.claimed,false);
 disk.setItem=writer;const retry=new MiningStore(disk);assert.equal(retry.claimStarterConstruction().ok,true);
 const otherDisk=storage(),first=new MiningStore(otherDisk);first.write(first.state);const pending=new MiningStore(otherDisk),prior=pending.state;assert.equal(first.claimStarterConstruction().ok,true);const current=otherDisk.getItem(MINING_KEY);
 assert.equal(pending.claimStarterConstruction().ok,false);assert.equal(pending.state,prior);assert.equal(otherDisk.getItem(MINING_KEY),current);assert.equal(new MiningStore(otherDisk).container('ship').items.concrete,80);
});
test('malformed receipts block mutation and preserve the original save',()=>{
 for(const value of [null,{version:2,claimed:false},{version:1,claimed:'yes'}]){
  const disk=storage(),s=new MiningStore(disk);s.write(s.state);const data=JSON.parse(disk.getItem(MINING_KEY));data.starterConstruction=value;const raw=JSON.stringify(data);disk.setItem(MINING_KEY,raw);const reload=new MiningStore(disk);
  assert.equal(reload.blocked,true);assert.equal(reload.claimStarterConstruction().ok,false);assert.equal(disk.getItem(MINING_KEY),raw);
 }
});
