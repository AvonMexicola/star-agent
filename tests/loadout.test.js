import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {Loadout,EQUIPMENT_SLOTS,validLoadout} from '../src/inventory/loadout.js';
import {Equipment} from '../src/equipment.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function setup(){const disk=storage(),store=new MiningStore(disk);return {disk,store,gear:new Loadout(store)};}
function total(store,id){return ['pack','ship',...Object.keys(store.state.remote)].reduce((n,k)=>n+(store.container(k).items[id]??0),0)+Object.values(store.state.loadout.slots).reduce((n,s)=>n+(s?.item===id?s.quantity:0),0);}

test('legacy saves gain the finite starter equipment once and preserve cargo and cuts',()=>{
  const {disk,store,gear}=setup();assert.equal(EQUIPMENT_SLOTS.length,10);assert.equal(validLoadout(gear.state),true);
  assert.equal(gear.state.slots.weapon1.item,'rifle-laser');assert.equal(gear.state.slots.tool.item,'mining-laser-tool');
  assert.equal(gear.state.slots.ammo1.item,'carbine-charge');assert.equal(gear.state.slots.ammo1.quantity,60);
  store.commit({field:store.state.field,yieldVolume:[.1,.2,0]},0);
  const old=JSON.parse(disk.getItem(MINING_KEY));delete old.loadout;disk.setItem(MINING_KEY,JSON.stringify(old));
  const migrated=new MiningStore(disk),g=new Loadout(migrated);assert.deepEqual(migrated.state.pack,store.state.pack);assert.equal(migrated.state.revision,1);
  assert.equal(g.select('weapon1').ok,true);assert.equal(g.spendRound('rifle-laser'),true);
  const reload=new MiningStore(disk);assert.equal(reload.state.loadout.slots.ammo1.quantity,59);assert.equal(total(reload,'rifle-laser'),1);
});
test('equipping, swapping weapon slots and top-ups conserve physical items',()=>{
  const {store,gear,disk}=setup();assert.equal(gear.stow('weapon1').ok,true);assert.equal(gear.assign('weapon2','rifle-laser').ok,true);
  assert.equal(gear.assign('weapon1','sidearm-pistol').ok,true);assert.equal(total(store,'rifle-laser'),1);assert.equal(total(store,'sidearm-pistol'),1);
  assert.equal(gear.assign('weapon1','bandage').ok,false);assert.equal(gear.assign('no-slot','nonsense').ok,false);
  assert.equal(gear.stow('ammo1').ok,true);assert.equal(gear.assign('ammo1','carbine-charge').ok,true);assert.equal(total(store,'carbine-charge'),60);
  assert.equal(gear.assign('ammo1','carbine-charge').ok,false);
  assert.deepEqual(new MiningStore(disk).state.loadout,gear.state);
});
test('failed writes and full containers reject gear swaps without losing or duplicating items',()=>{
  const {store,gear,disk}=setup();store.state.supplies.pack={repair:2,sample:3,scanner:1,ration:2};store.state.pack=[4,0,0];
  const before=structuredClone(store.state);assert.equal(gear.stow('weapon1').ok,false);assert.deepEqual(store.state,before);
  disk.setItem=()=>{throw Error('quota');};assert.equal(gear.stow('weapon1','ship').ok,false);assert.deepEqual(store.state,before);assert.equal(store.blocked,true);
});
test('ammo is compatible, finite, and charged only after the selected weapon authorizes a shot',()=>{
  const {gear,store}=setup();assert.equal(gear.spendRound('rifle-laser'),false);assert.equal(gear.ammoFor(),0);
  gear.select('weapon1');for(let i=0;i<60;i++)assert.equal(gear.spendRound('rifle-laser'),true);
  assert.equal(gear.spendRound('rifle-laser'),false);assert.equal(gear.ammoFor(),0);assert.equal(total(store,'sidearm-charge'),36);
  gear.select('tool');assert.equal(gear.ammoFor(),0);assert.equal(gear.spendRound('mining-laser-tool'),false);
});
test('quick items heal and stop bleeding atomically, retain full-health items and never revive',()=>{
  const {gear,store,disk}=setup();const initial=total(store,'bandage');assert.equal(gear.useQuick(0).ok,false);assert.equal(total(store,'bandage'),initial);
  gear.injure(55,{bleeding:true});assert.equal(gear.useQuick(0).ok,true);assert.equal(gear.state.health,60);assert.equal(gear.state.bleeding,false);
  assert.equal(gear.useQuick(1).ok,true);assert.equal(gear.state.health,100);assert.equal(total(store,'healing-stim'),1);
  const saved=structuredClone(store.state);disk.setItem=()=>{throw Error('quota');};assert.equal(gear.injure(20).ok,false);assert.deepEqual(store.state,saved);
  const another=setup();another.gear.injure(100);assert.equal(another.gear.useQuick().ok,false);assert.equal(another.gear.state.health,0);
});
test('backpack removal requires empty contents, disables gathering, and preserves box mounts on re-equip',()=>{
  const {store,gear,disk}=setup();assert.equal(gear.stow('backpack','ship').ok,false);assert.equal(gear.stow('backpack','pack').ok,false);
  assert.equal(store.transfer('ration','pack','ship',2).ok,true);store.addBox('pack');assert.equal(gear.stow('backpack','ship').ok,true);
  assert.equal(store.capacity,0);assert.equal(store.addBox('pack').ok,false);assert.equal(store.transfer('ration','ship','pack',1).ok,false);
  assert.equal(store.commit({field:store.state.field,yieldVolume:[.01,0,0]},0),false);
  assert.equal(new MiningStore(disk).blocked,undefined);assert.equal(gear.assign('backpack','backpack-life-support','ship').ok,true);assert.equal(store.capacity,24);
});
test('invalid loadouts preserve the original save and block mutation instead of granting a new starter kit',()=>{
  for(const change of [l=>l.slots.weapon1={item:'bandage',quantity:1},l=>l.slots.ammo1.quantity=-1,l=>l.health=101,l=>l.quickIndex=8]){
    const {store,disk}=setup();store.stow();const d=JSON.parse(disk.getItem(MINING_KEY));change(d.loadout);const raw=JSON.stringify(d);disk.setItem(MINING_KEY,raw);
    const invalid=new MiningStore(disk);assert.equal(invalid.blocked,true);assert.equal(new Loadout(invalid).select('weapon1').ok,false);assert.equal(disk.getItem(MINING_KEY),raw);
  }
});
test('late weapon model loads cannot reattach after switching, and denied fire emits no shot',async()=>{
  const pending=new Map(),loader={load(url,resolve){pending.set(url,resolve);}},hand=new THREE.Bone(),back=new THREE.Bone();hand.name='RightHand';back.name='Spine2';
  const e=new Equipment({skeleton:{bones:[hand,back]}},new THREE.Scene(),{loader,sockets:{rigs:{mannequin:{bones:{RightHand:'RightHand',Spine2:'Spine2'},items:{}}}}});
  const rifle=e.equip('rifle-laser'),pistol=e.equip('sidearm-pistol');
  const resolve=name=>pending.get(`/models/props/${name}.glb`)({scene:new THREE.Group()});
  resolve('sidearm-pistol');await pistol;resolve('rifle-laser');await rifle;
  assert.equal(e.equipped,'sidearm-pistol');assert.equal(e.itemObject('rifle-laser').parent,null);
  e.setRenderOrigin(new THREE.Vector3());let attempts=0;e.update(.5,{firing:true,authorizeFire:()=>{attempts++;return false;}});assert.equal(attempts,1);assert.equal(e.firingInput(),false);
  e.update(.5,{firing:true,authorizeFire:()=>true});assert.equal(e.firingInput(),true);e.dispose();
});
