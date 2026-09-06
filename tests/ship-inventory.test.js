import test from 'node:test';
import assert from 'node:assert/strict';
import { ShipInventory, ITEMS, INVENTORY_KEY, CAPACITY } from '../src/ship-inventory.js';
import { constrainShipStep, interactionAt, SHIP_LAYOUT } from '../src/boarding.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFile } from 'node:fs/promises';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}
test('cargo transfers conserve every item and mass and persist across reload', () => {
  const disk = storage(), inventory = new ShipInventory(disk), before = inventory.snapshot;
  for (const item of ITEMS) {
    assert.equal(inventory.transfer(item.id, 'ship').ok, true);
    const after = new ShipInventory(disk);
    assert.equal(after.count('ship', item.id), inventory.count('ship', item.id));
    assert.equal(after.count('pack', item.id), inventory.count('pack', item.id));
    assert.equal(inventory.count('ship', item.id) + inventory.count('pack', item.id), before.ship[item.id] + before.pack[item.id]);
  }
  assert.equal(inventory.mass('ship') + inventory.mass('pack'), before.shipMass + before.packMass);
  assert.equal(inventory.transfer('scanner', 'pack').ok, true);
  assert.equal(inventory.transfer('scanner', 'pack').ok, false);
  assert.equal(inventory.transfer('unobtainium', 'ship').ok, false);
  assert.equal(inventory.transfer('repair', '__proto__').ok, false);
});
test('capacity prevents overloading without losing cargo', () => {
  const inventory = new ShipInventory(storage());
  for (let i = 0; i < 30; i++) inventory.transfer('repair', 'ship');
  for (let i = 0; i < 30; i++) inventory.transfer('sample', 'ship');
  const before = inventory.snapshot;
  assert.equal(inventory.transfer('scanner', 'ship').ok, false);
  assert.deepEqual(inventory.snapshot, before);
  assert.ok(inventory.mass('pack') <= CAPACITY.pack);
});
test('malformed manifests are rejected and unavailable persistence leaves transfers usable', () => {
  for (const data of ['bad json', '{"version":1,"ship":null}', JSON.stringify({ version: 1, ship: { repair: 1e20 } })]) {
    const disk = storage();disk.setItem(INVENTORY_KEY, data);
    assert.equal(new ShipInventory(disk).count('ship', 'repair'), 3);
  }
  const inventory = new ShipInventory({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  assert.equal(inventory.transfer('repair', 'ship').ok, true);
  assert.equal(inventory.saved, false);
  assert.equal(inventory.count('pack', 'repair'), 1);
});
test('cargo interaction is inside the cabin and its solid body leaves the boarding aisle clear', () => {
  const v = (x, z) => new THREE.Vector3(x, 2.75, z);
  assert.equal(interactionAt(v(0, 1.15), false), 'storage');
  assert.equal(interactionAt(v(2.1, 1.15), false), null);
  assert.equal(interactionAt(v(0, 2.3), false), 'door');
  assert.equal(interactionAt(v(0, -1.4), false), 'seat');
  assert.deepEqual(constrainShipStep(v(0, 1.15), v(1.5, 1.15), true), v(0, 1.15));
  assert.deepEqual(constrainShipStep(v(0, -1.2), v(0, 7), true), v(0, 7));
  assert.deepEqual(constrainShipStep(v(.8, 0), v(.8, 2.4), true), v(.8, 0));
});
test('Blender asset fits the navigation envelope with a correctly placed movable cargo lid', async () => {
  const data = await readFile(new URL('../public/models/nomad.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  const bounds = new THREE.Box3().setFromObject(scene);
  for (const [index, axis] of ['x', 'y', 'z'].entries()) {
    assert.ok(bounds.min[axis] >= SHIP_LAYOUT.flightBounds.min[index] - .01, `${axis} minimum ${bounds.min[axis]}`);
    assert.ok(bounds.max[axis] <= SHIP_LAYOUT.flightBounds.max[index] + .01, `${axis} maximum ${bounds.max[axis]}`);
  }
  const lid = scene.getObjectByName('CargoLid');assert.ok(lid);
  const hinge = lid.getWorldPosition(new THREE.Vector3());
  assert.ok(hinge.distanceTo(new THREE.Vector3(1.65, 1.98, 1.15)) < 1e-5);
  assert.ok(new THREE.Box3().setFromObject(lid).getSize(new THREE.Vector3()).length() < 2, 'lid transforms remain ship local');
  const chair=scene.getObjectByName('PilotChair');assert.ok(chair,'Blender pilot chair is present');
  const chairBounds=new THREE.Box3().setFromObject(chair);
  assert.ok(chairBounds.max.z<-2,'seat shell stays clear of the rear standing aisle');
  const sightline=new THREE.Raycaster(new THREE.Vector3(...SHIP_LAYOUT.seatEye),new THREE.Vector3(0,0,-1),0,8);
  const opaque=sightline.intersectObject(scene,true).filter(hit=>!hit.object.material.transparent);
  assert.equal(opaque.length,0,'centre windscreen remains clear of opaque struts');
});


test('bulk transfers fill available capacity, conserve cargo and save once across all containers',()=>{
  const disk=storage();let writes=0;const original=disk.setItem;disk.setItem=(...args)=>{writes++;original(...args);};
  const inv=new ShipInventory(disk),before=inv.snapshot;
  const result=inv.transferAll('station','ship');assert.equal(result.ok,true);assert.ok(result.remaining>0);
  assert.equal(writes,1);assert.equal(inv.mass('ship'),120);
  inv.transferAll('ship','pack');assert.equal(inv.mass('pack'),20);
  for(const item of ITEMS)assert.equal(['ship','pack','station'].reduce((n,c)=>n+inv.count(c,item.id),0),['ship','pack','station'].reduce((n,c)=>n+before[c][item.id],0));
  assert.deepEqual(new ShipInventory(disk).snapshot,inv.snapshot);
  const after=inv.snapshot;assert.equal(inv.transferAll('__proto__','ship').ok,false);assert.equal(inv.transferAll('ship','constructor').ok,false);assert.equal(inv.transferAll('ship','ship').ok,false);assert.deepEqual(inv.snapshot,after);
});
test('legacy saves migrate without resetting cargo, and blocked persistence keeps bulk moves in session',()=>{
  const disk=storage(),old=new ShipInventory(disk).snapshot;old.ship.repair=1;old.pack.repair=2;
  disk.setItem(INVENTORY_KEY,JSON.stringify({version:1,ship:old.ship,pack:old.pack}));
  const inv=new ShipInventory(disk);assert.equal(inv.count('ship','repair'),1);assert.equal(inv.count('station','repair'),12);
  inv.transferAll('pack','station');assert.equal(JSON.parse(disk.getItem(INVENTORY_KEY)).version,2);
  const blocked=new ShipInventory({getItem(){return null;},setItem(){throw Error('denied');}});
  assert.equal(blocked.transferAll('station','ship').ok,true);assert.equal(blocked.saved,false);assert.equal(blocked.mass('ship'),120);
});
