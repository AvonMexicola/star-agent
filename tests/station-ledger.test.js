import test from 'node:test';
import assert from 'node:assert/strict';
import {ShipInventory,INVENTORY_KEY} from '../src/ship-inventory.js';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {Loadout} from '../src/inventory/loadout.js';
import {bindStationLedger} from '../src/inventory/station-ledger.js';
import {STATION_SHOPS} from '../src/station-shop.js';
const setup=()=>{const data=new Map();const disk={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const inventory=new ShipInventory(disk);const store=new MiningStore(disk);bindStationLedger(inventory,store);return {disk,store,inventory};};
const [shopId,shop]=Object.entries(STATION_SHOPS)[0],offer=shop.offers[0];
test('station purchase, cargo transfer, loadout and mineral awards survive in one ledger without rewriting legacy save',()=>{
 const {disk,store,inventory}=setup(),legacy=disk.getItem(INVENTORY_KEY),credits=inventory.credits,count=inventory.count('station',offer.itemId);
 assert.equal(inventory.purchase(shopId,offer.itemId).ok,true);
 assert.equal(inventory.transfer(offer.itemId,'station','ship').ok,true);
 const gear=new Loadout(store);assert.equal(gear.select('weapon1').ok,true);assert.equal(gear.spendRound('rifle-laser'),true);
 assert.equal(store.commit({field:store.state.field,yieldVolume:[.01,0,0]},0),true);
 const reload=new MiningStore(disk),manifest=new ShipInventory(disk);bindStationLedger(manifest,reload);
 assert.equal(manifest.credits,credits-offer.price);assert.equal(manifest.count('station',offer.itemId),count);
 assert.equal(manifest.count('ship',offer.itemId),1);assert.equal(reload.state.revision,1);assert.deepEqual(reload.state.loadout,store.state.loadout);
 assert.equal(disk.getItem(INVENTORY_KEY),legacy);
});
test('failed purchase and stale second session cannot debit money or overwrite mined cargo',()=>{
 const {disk,store,inventory}=setup();store.write(store.state);
 const stale=new MiningStore(disk),old=new ShipInventory(disk);bindStationLedger(old,stale);
 assert.equal(store.commit({field:store.state.field,yieldVolume:[.01,0,0]},0),true);
 const raw=disk.getItem(MINING_KEY),money=old.credits;
 assert.equal(old.purchase(shopId,offer.itemId).ok,false);assert.equal(old.credits,money);assert.equal(disk.getItem(MINING_KEY),raw);
 const before=inventory.snapshot;disk.setItem=()=>{throw Error('quota');};
 assert.equal(inventory.purchase(shopId,offer.itemId).ok,false);assert.deepEqual(inventory.snapshot,before);
});
test('old field supplies missing newer shop item keys migrate without discarding cuts',()=>{
 const {disk,store}=setup();store.write(store.state);const saved=JSON.parse(disk.getItem(MINING_KEY));
 delete saved.economy;for(const id of ['ship','pack'])for(const key of ['rifle','sidearm','replacement'])delete saved.supplies[id][key];
 disk.setItem(MINING_KEY,JSON.stringify(saved));const migrated=new MiningStore(disk);
 assert.equal(Boolean(migrated.blocked),false);assert.equal(migrated.state.revision,store.state.revision);
});
test('unreadable storage blocks changes without throwing during game startup',()=>{
 const disk={getItem(){throw Error('access denied');},setItem(){assert.fail('must not overwrite unreadable save');}};
 const store=new MiningStore(disk),inventory=new ShipInventory(disk);bindStationLedger(inventory,store);
 assert.equal(store.blocked,true);assert.equal(store.saved,false);assert.equal(inventory.purchase(shopId,offer.itemId).ok,false);
});
