import test from 'node:test';
import assert from 'node:assert/strict';
import { MiningStore, MINING_KEY, MAX_SAVED_ROCKS } from '../src/mining/store.js';
import { ShipInventory, INVENTORY_KEY } from '../src/ship-inventory.js';
import { emptyItems, stacksFor, fitsBox, planTransfer } from '../src/inventory/containers.js';
import { createDensity, carve } from '../src/mining/volume.js';
const storage = () => { const data = new Map(); return { data, getItem: id => data.get(id) ?? null, setItem: (id, raw) => data.set(id, raw) }; };

test('stack slots and weights are independent limits; another box makes room for more item types', () => {
  const items = { ...emptyItems(), repair: 4, sample: 4 };
  assert.equal(stacksFor(items).length, 8);
  assert.equal(fitsBox(items, 1), true);
  assert.equal(fitsBox({ ...items, copper: .1 }, 1), false);
  assert.equal(fitsBox({ ...items, copper: .1 }, 2), true);
  assert.equal(stacksFor({ ice: 8.01 }).length, 3);
  assert.equal(fitsBox({ ice: 12.1 }, 1), false);
  assert.equal(fitsBox({ repair: 1.5 }, 1), false);
  assert.equal(planTransfer({ ice: 1 }, {}, 'ice', NaN, 1).ok, false);
});
test('legacy mining and supply saves migrate without recrediting or overwriting the old manifest', () => {
  const disk = storage(), old = new ShipInventory(disk); old.transfer('repair', 'ship');
  const beforeManifest = disk.getItem(INVENTORY_KEY);
  const baseline = new MiningStore(disk), cut = carve(baseline.state.field, [0, 0, 1.35], .025);
  assert.equal(baseline.commit(cut, 0), true);
  const legacy = JSON.parse(disk.getItem(MINING_KEY));
  for (const key of ['supplies', 'boxes', 'remote', 'rocks']) delete legacy[key];
  disk.setItem(MINING_KEY, JSON.stringify(legacy));
  const migrated = new MiningStore(disk), mass = migrated.mass;
  assert.equal(migrated.container('pack').items.repair, 1);
  assert.equal(migrated.transfer('repair', 'pack', 'ship', 1).ok, true);
  const reload = new MiningStore(disk);
  assert.equal(reload.container('pack').items.repair, 0);
  assert.equal(reload.container('ship').items.repair, 3);
  assert.equal(reload.mass, mass); assert.equal(reload.state.revision, 1);
  assert.equal(disk.getItem(INVENTORY_KEY), beforeManifest);
});
test('all container transfers conserve resources, survive reload, and synchronize the ship manifest', () => {
  const disk = storage(), store = new MiningStore(disk), manifest = new ShipInventory(disk);
  store.bindManifest(manifest);
  assert.equal(store.commit({ field: store.state.field, yieldVolume: [.25, .1, .1] }, 0), true);
  assert.equal(store.transfer('copper', 'pack', 'station', .7).ok, true);
  assert.equal(store.transfer('ration', 'ship', 'station', 3).ok, true);
  assert.equal(manifest.count('ship', 'ration'), 9);
  assert.equal(store.registerContainer({ id: 'base-lunar-01', name: 'Selene camp', kind: 'base', boxes: 2 }), true);
  assert.equal(store.transfer('copper', 'station', 'base-lunar-01', .5).ok, true);
  assert.equal(store.transfer('ration', 'station', 'pack', 1).ok, true);
  assert.equal(manifest.count('pack', 'ration'), 3);
  const reload = new MiningStore(disk);
  assert.ok(Math.abs(['pack', 'ship', 'station', 'base-lunar-01'].reduce((sum, id) => sum + reload.container(id).items.copper, 0) - 1.2) < 1e-7);
  assert.equal(['pack', 'ship', 'station', 'base-lunar-01'].reduce((sum, id) => sum + reload.container(id).items.ration, 0), 14);
  assert.deepEqual(reload.state, store.state);
});
test('failed saves leave source, destination, current field and manifest unchanged', () => {
  const disk = storage(), store = new MiningStore(disk), manifest = new ShipInventory(disk);
  store.bindManifest(manifest); store.commit({ field: store.state.field, yieldVolume: [.1, .1, .1] }, 0);
  const before = structuredClone(store.state), oldManifest = manifest.snapshot, saved = disk.getItem(MINING_KEY);
  disk.setItem = () => { throw Error('quota'); };
  assert.equal(store.transfer('ice', 'pack', 'station', 1).ok, false);
  assert.deepEqual(store.state, before); assert.deepEqual(manifest.snapshot, oldManifest);
  assert.equal(disk.getItem(MINING_KEY), saved);
  assert.equal(store.addBox('pack').ok, false);
  assert.equal(store.commit({ field: store.state.field, yieldVolume: [.1, 0, 0] }, 1), false);
});
test('full slots reject a mined award and cut together; boxes add actual capacity and persist', () => {
  const disk = storage(), store = new MiningStore(disk);
  store.state.supplies.pack = { repair: 2, sample: 3, scanner: 1, ration: 2 }; // 18 kg and 7 occupied supply slots.
  store.state.pack = [4, 0, 0];
  assert.equal(stacksFor(store.container('pack').items).length, 8);
  const before = store.state.field;
  assert.equal(store.commit({ field: before, yieldVolume: [0, .01, 0] }, 0), false);
  assert.equal(store.state.revision, 0); assert.equal(store.state.pack[1], 0);
  assert.equal(store.addBox('pack').ok, true);
  assert.equal(store.capacity, 24);
  assert.equal(store.commit({ field: before, yieldVolume: [0, .01, 0] }, 0), true);
  assert.equal(new MiningStore(disk).capacity, 24);
  assert.equal(store.addBox('pack').ok, false);
});
test('independent space fields and resource gains commit atomically with bounded saved-rock slots', () => {
  const disk = storage(), store = new MiningStore(disk), field = createDensity();
  for (let n = 0; n < MAX_SAVED_ROCKS; n++) {
    const id = `ring-rock-${n}`;
    assert.equal(store.getRock(id, field).revision, 0);
    assert.equal(store.commitRock(id, { field, yieldVolume: [.01, 0, 0] }, 0), true);
    assert.equal(store.commitRock(id, { field, yieldVolume: [.01, 0, 0] }, 0), false);
  }
  assert.equal(store.canEditRock('ring-rock-new'), false);
  assert.equal(store.canEditRock('ring-rock-0'), true);
  assert.equal(store.getRock('ring-rock-new', field).revision, 0);
  store.releaseRock('ring-rock-new'); assert.equal(store.initialRocks.has('ring-rock-new'), false);
  store.releaseRock('ring-rock-0'); assert.equal(store.getRock('ring-rock-0', field).revision, 1);
  const mass = store.mass;
  assert.equal(store.commitRock('ring-rock-new', { field, yieldVolume: [.01, 0, 0] }, 0), false);
  assert.equal(store.mass, mass);
  const reload = new MiningStore(disk);
  assert.deepEqual(reload.getRock('ring-rock-0', field).field, field);
  assert.equal(reload.getRock('ring-rock-0', field).revision, 1);
  assert.equal(reload.mass, mass);
  assert.equal(reload.commitRock('ring-rock-0', { field, yieldVolume: [.01, 0, 0] }, 1), true);
});
test('malformed container and rock saves remain untouched and unusable', () => {
  for (const mutate of [d => { d.boxes.pack = -1; }, d => { d.supplies.pack.repair = .5; }, d => { d.remote.station.items.ice = -2; }, d => { d.rocks.bad = { field: [NaN], revision: 1 }; }]) {
    const disk = storage(), store = new MiningStore(disk); store.stow();
    const data = JSON.parse(disk.getItem(MINING_KEY)); mutate(data);
    const raw = JSON.stringify(data); disk.setItem(MINING_KEY, raw);
    const invalid = new MiningStore(disk);
    assert.equal(invalid.blocked, true); assert.equal(disk.getItem(MINING_KEY), raw);
    assert.equal(invalid.transfer('ration', 'ship', 'pack', 1).ok, false);
    assert.ok(invalid.container('pack'));
  }
});
