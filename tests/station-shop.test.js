import test from 'node:test';
import assert from 'node:assert/strict';
import { ShipInventory, INVENTORY_KEY } from '../src/ship-inventory.js';
import { STARTER_CREDITS, purchaseStationItem } from '../src/station-shop.js';
import { Fleet, FLEET_KEY } from '../src/fleet.js';

function storage() {
  const values = new Map();
  return { writes: 0, getItem: key => values.get(key) ?? null,
    setItem(key, value) { this.writes++; values.set(key, value); } };
}
const legacy = version => ({ version,
  ship: { repair: 2, ration: 5, sample: 1, scanner: 1 },
  pack: { repair: 1, ration: 1, sample: 0, scanner: 0 },
  ...(version === 2 ? { station: { repair: 17, ration: 42, sample: 5, scanner: 2 } } : {}),
});

test('new and legacy manifests persist one starter grant without changing cargo or Atlas progression', () => {
  for (const version of [null, 1, 2]) {
    const disk = storage();
    if (version) disk.setItem(INVENTORY_KEY, JSON.stringify(legacy(version)));
    const fleetSave = JSON.stringify({ version: 1, surfaceVisited: true, unlocked: true, active: 'atlas' });
    disk.setItem(FLEET_KEY, fleetSave);
    const inventory = new ShipInventory(disk, 2400);
    assert.equal(inventory.credits, STARTER_CREDITS);
    const saved = JSON.parse(disk.getItem(INVENTORY_KEY));
    assert.equal(saved.version, 3);
    if (version) for (const container of ['ship', 'pack', ...(version === 2 ? ['station'] : [])]) {
      for (const [id, count] of Object.entries(legacy(version)[container])) assert.equal(inventory.count(container, id), count);
    }
    assert.equal(inventory.count('station', 'rifle'), 0);
    assert.equal(purchaseStationItem(inventory, 'weapons', 'sidearm').ok, true);
    const writes = disk.writes, resumed = new ShipInventory(disk, 2400);
    assert.equal(resumed.credits, 1150); assert.equal(resumed.count('station', 'sidearm'), 1);
    assert.equal(disk.writes, writes, 'loading v3 neither regrants credits nor rewrites it');
    assert.equal(disk.getItem(FLEET_KEY), fleetSave);
    assert.equal(new Fleet(disk).active, 'atlas');
  }
});

test('one write commits money, warehouse delivery and finite stock; new items transfer normally', () => {
  const disk = storage(), inventory = new ShipInventory(disk), before = inventory.snapshot;
  disk.writes = 0;
  const result = purchaseStationItem(inventory, 'weapons', 'rifle');
  assert.equal(result.ok, true); assert.equal(result.cost, 700); assert.equal(result.destination, 'station');
  assert.equal(disk.writes, 1);
  assert.equal(inventory.credits, 800); assert.equal(inventory.count('station', 'rifle'), 1);
  assert.equal(inventory.shopStock.weapons.rifle, before.shopStock.weapons.rifle - 1);
  assert.equal(inventory.mass('station'), before.stationMass + 5);
  assert.deepEqual(new ShipInventory(disk).snapshot, inventory.snapshot);
  assert.equal(inventory.transfer('rifle', 'station', 'ship').ok, true);
  assert.equal(inventory.transfer('rifle', 'ship', 'pack').ok, true);
  assert.equal(new ShipInventory(disk).count('pack', 'rifle'), 1);
  assert.equal(new ShipInventory(disk).credits, 800, 'ordinary cargo transfers preserve wallet');
});

test('insufficient credit, capacity, unavailable stock and invalid catalogues change nothing', () => {
  const disk = storage(), inventory = new ShipInventory(disk);
  assert.equal(inventory.purchase('weapons', 'rifle').ok, true);
  assert.equal(inventory.purchase('weapons', 'rifle').ok, true);
  let before = inventory.snapshot, raw = disk.getItem(INVENTORY_KEY);
  assert.equal(inventory.purchase('weapons', 'sidearm').ok, false);
  assert.equal(inventory.purchase('weapons', 'rifle').ok, false);
  for (const [shop, item] of [['__proto__', 'sidearm'], ['equipment', '__proto__'], ['weapons', 'repair'], ['equipment', 'unknown']]) {
    assert.equal(inventory.purchase(shop, item).ok, false);
  }
  assert.deepEqual(inventory.snapshot, before); assert.equal(disk.getItem(INVENTORY_KEY), raw);
  const fresh = new ShipInventory(storage());
  fresh.capacity.station = fresh.mass('station'); before = fresh.snapshot;
  assert.equal(fresh.purchase('equipment', 'sample').ok, false);
  assert.deepEqual(fresh.snapshot, before);
});

test('repeated shop clicks cannot exceed finite stock and purchases do not replenish on reload', () => {
  const disk = storage(), inventory = new ShipInventory(disk);
  for (let n = 0; n < 10; n++) assert.equal(inventory.purchase('equipment', 'sample').ok, true);
  assert.equal(inventory.purchase('equipment', 'sample').ok, false);
  const resumed = new ShipInventory(disk);
  assert.equal(resumed.shopStock.equipment.sample, 0);
  assert.equal(resumed.credits, 1100);
  assert.equal(resumed.purchase('equipment', 'sample').ok, false);
});

test('failed purchase persistence leaves credits, cargo, stock and prior save unchanged', () => {
  const disk = storage(), inventory = new ShipInventory(disk), before = inventory.snapshot;
  const raw = disk.getItem(INVENTORY_KEY), write = disk.setItem;
  disk.setItem = () => { throw Error('Quota exceeded'); };
  const result = inventory.purchase('equipment', 'replacement');
  assert.equal(result.ok, false); assert.match(result.message, /No credits spent/);
  assert.deepEqual(inventory.snapshot, before); assert.equal(disk.getItem(INVENTORY_KEY), raw);
  disk.setItem = write;
  assert.deepEqual(new ShipInventory(disk).snapshot, before);
  const unavailable = new ShipInventory(null), unavailableBefore = unavailable.snapshot;
  assert.equal(unavailable.purchase('weapons', 'sidearm').ok, false);
  assert.deepEqual(unavailable.snapshot, unavailableBefore);
});

test('malformed or future manifests are preserved rather than replaced with a new grant', () => {
  const validDisk = storage(); new ShipInventory(validDisk);
  const valid = JSON.parse(validDisk.getItem(INVENTORY_KEY));
  for (const value of ['not json', JSON.stringify({ version: 4 }), JSON.stringify({ ...valid, credits: -1 }),
    JSON.stringify({ ...valid, credits: 1.5 }), JSON.stringify({ ...valid, shopStock: {} }),
    JSON.stringify({ ...legacy(2), ship: { ...legacy(2).ship, repair: -1 } })]) {
    const disk = storage(); disk.setItem(INVENTORY_KEY, value);
    const inventory = new ShipInventory(disk), before = inventory.snapshot, writes = disk.writes;
    assert.equal(inventory.credits, 0); assert.equal(inventory.saved, false);
    assert.equal(inventory.purchase('weapons', 'sidearm').ok, false);
    assert.deepEqual(inventory.snapshot, before);
    inventory.transfer('repair', 'ship');
    assert.equal(disk.writes, writes); assert.equal(disk.getItem(INVENTORY_KEY), value);
  }
});

test('failed initial migration retains the old save and can commit the grant plus purchase together on recovery', () => {
  const disk = storage(), raw = JSON.stringify(legacy(2)); disk.setItem(INVENTORY_KEY, raw);
  const write = disk.setItem; disk.setItem = () => { throw Error('Denied'); };
  const inventory = new ShipInventory(disk);
  assert.equal(disk.getItem(INVENTORY_KEY), raw);
  assert.equal(inventory.purchase('equipment', 'repair').ok, false);
  assert.equal(inventory.credits, 1500); assert.equal(inventory.count('station', 'repair'), 17);
  disk.setItem = write;
  assert.equal(inventory.purchase('equipment', 'repair').ok, true);
  const resumed = new ShipInventory(disk);
  assert.equal(resumed.credits, 1380); assert.equal(resumed.count('station', 'repair'), 18);
});

test('purchase refuses an already changed saved manifest instead of overwriting another session', () => {
  const disk = storage(), first = new ShipInventory(disk), second = new ShipInventory(disk);
  assert.equal(first.purchase('weapons', 'rifle').ok, true);
  const before = second.snapshot, raw = disk.getItem(INVENTORY_KEY);
  assert.equal(second.purchase('weapons', 'sidearm').ok, false);
  assert.deepEqual(second.snapshot, before); assert.equal(disk.getItem(INVENTORY_KEY), raw);
});
