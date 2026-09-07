import test from 'node:test';
import assert from 'node:assert/strict';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {CATALOG,MATERIAL_IDS,SLOTS_PER_BOX,emptyItems} from '../src/inventory/containers.js';

function fixture(){
 const data=new Map();let writes=0;
 const disk={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes++;data.set(key,value);}};
 const store=new MiningStore(disk);
 return {store,disk,data,get writes(){return writes;}};
}
test('bulk deposit moves every resource in one save while retaining supplies, loadout and mining XP',()=>{
 const f=fixture(),s=f.store;
 let next={...s.state,boxes:{...s.state.boxes,pack:2},progression:{mining:{xp:550}}};
 next=s.withItems(next,'pack',{...s.container('pack',next).items,...Object.fromEntries(MATERIAL_IDS.map(id=>[id,.5]))});
 assert.equal(s.validContainers(next),true);assert.equal(s.write(next),true);
 const before=s.state,ship=s.container('ship').items,writes=f.writes;
 assert.equal(s.stow(),true);assert.equal(f.writes,writes+1);
 for(const id of MATERIAL_IDS){assert.equal(s.container('pack').items[id],0);assert.equal(s.container('ship').items[id],ship[id]+.5);}
 for(const id of ['pack','ship'])for(const item of CATALOG.filter(item=>item.unit==='item'))assert.equal(s.container(id).items[item.id],s.container(id,before).items[item.id]);
 assert.deepEqual(s.state.loadout,before.loadout);
 assert.deepEqual(s.state.progression,before.progression);assert.deepEqual(s.state.economy,before.economy);
 assert.equal(s.state.field,before.field);assert.deepEqual(new MiningStore(f.disk).state,s.state);
});
test('if the final resource cannot fit, bulk deposit leaves the entire load in the backpack',()=>{
 const f=fixture(),s=f.store;
 let next=s.withItems(s.state,'pack',{...emptyItems(),basalt:1,copper:1});
 next=s.withItems(next,'ship',{...emptyItems(),repair:s.state.boxes.ship*SLOTS_PER_BOX-1});
 assert.equal(s.validContainers(next),true);assert.equal(s.write(next),true);
 const before=s.state,raw=f.disk.getItem(MINING_KEY),writes=f.writes;
 assert.equal(s.stow(),false);assert.match(s.warning,/full/i);
 assert.equal(s.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);assert.equal(f.writes,writes);
});
test('a denied bulk-deposit save retains both inventories and earned skill',()=>{
 const f=fixture(),s=f.store;
 assert.equal(s.write(s.withItems({...s.state,progression:{mining:{xp:725}}},'pack',{...emptyItems(),basalt:2,copper:1})),true);
 const before=s.state,raw=f.disk.getItem(MINING_KEY);
 f.disk.setItem=()=>{throw Error('quota');};
 assert.equal(s.stow(),false);assert.equal(s.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);
 assert.deepEqual(s.state.progression,{mining:{xp:725}});
});
