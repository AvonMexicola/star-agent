import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Vector3, Quaternion } from 'three';
import { ShipInventory } from '../src/ship-inventory.js';
import { MiningStore, MINING_KEY } from '../src/mining/store.js';
import { itemMass } from '../src/inventory/containers.js';
import { createMediumShipInventory } from '../src/medium-ship-inventory.js';
import { createShipMFDs } from '../src/ship-mfd.js';

function fixture(t) {
  const data = new Map(); let writes = 0;
  const disk = { getItem: key => data.get(key) ?? null, setItem: (key, raw) => { writes++; data.set(key, raw); } };
  const legacy = new ShipInventory(disk, 960), store = new MiningStore(disk);
  store.bindManifest(legacy);
  const previous = globalThis.document, canvases = [];
  globalThis.document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    const text = [], context = { setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText(value) { text.push(value); } };
    const canvas = { width: 0, height: 0, getContext: () => context, text };
    canvases.push(canvas); return canvas;
  } };
  t.after(() => { globalThis.document = previous; });
  const nav = {
    powered: true, mode: 'landed', speed: 0, altitude: 0, normal: new Vector3(0, 1, 0),
    velocity: new Vector3(), orientation: new Quaternion(), flightAssist: true,
    flightEnvironment: { regime: 'SURFACE', atmosphereFraction: 0 }, body: { id: 'selene' },
    gearProgress: 1, doorOpen: false, doorProgress: 0,
  };
  const mfd = createShipMFDs({ includeFrames: false });
  const display = createMediumShipInventory(store, legacy);
  return { store, legacy, display, mfd, nav, disk, canvases, writes: () => writes };
}

test('medium MFD totals include committed ore, fuel byproduct, construction and modern supplies once', t => {
  const f = fixture(t), { store, legacy, display, mfd, nav } = f;
  assert.equal(store.commitRock(store.state.id, { field: store.state.field, yieldVolume: [.5, 0, 0] }, 0, 'pack', { item: 'helium-3-regolith', fraction: .005 }), true);
  assert.equal(store.claimStarterConstruction().ok, true);
  assert.equal(legacy.mass('pack'), 1, 'legacy manifest omits the accepted half-kilogram resource gain');
  assert.equal(legacy.mass('ship'), 33, 'legacy manifest omits the 103 kg construction grant');
  assert.ok(Math.abs(display.mass('pack') - 4.5) < 1e-9);
  assert.equal(display.mass('ship'), 136);
  assert.ok(store.container('pack').items['helium-3-regolith'] > 0);
  assert.deepEqual(store.limits('pack'), { resources: 48, supplies: 20 });
  assert.deepEqual(store.limits('ship'), { resources: 192, supplies: 960 });

  const state = store.state, saved = f.disk.getItem(MINING_KEY), writes = f.writes();
  mfd.update(.2, nav, display);
  assert.ok(mfd.snapshot()[3].values.includes('SHIP STORAGE: 136.0 kg'));
  assert.ok(mfd.snapshot()[3].values.includes('BACKPACK: 4.5 kg'));
  assert.equal(store.state, state); assert.equal(f.disk.getItem(MINING_KEY), saved); assert.equal(f.writes(), writes, 'display reads do not write the ledger');

  assert.equal(store.transfer('basalt', 'pack', 'ship', .25).ok, true);
  assert.equal(store.write(store.withItems(store.state, 'pack', { ...store.container('pack').items, bandage: 2 })), true);
  mfd.update(.2, nav, display);
  assert.equal(display.mass('ship'), 136.25);
  assert.ok(Math.abs(display.mass('pack') - 4.45) < 1e-9, 'same adapter reads subsequent commits and catalog item masses');
  assert.equal(display.mass('pack'), itemMass(store.container('pack').items));
  assert.ok(mfd.snapshot()[3].values.includes(`BACKPACK: ${display.mass('pack').toFixed(1)} kg`));
});

test('medium total remains truthful on the immediate power-off repaint; legacy formatting stays intact', t => {
  const { store, legacy, display, mfd, nav } = fixture(t);
  assert.equal(store.claimStarterConstruction().ok, true);
  mfd.update(.2, nav, display);
  nav.powered = false; mfd.update(.001, nav, display);
  assert.ok(mfd.snapshot()[3].values.includes('SHIP STORAGE: 136.0 kg'));
  assert.ok(mfd.snapshot()[3].values.includes('MAIN POWER: OFF'));
  mfd.update(.2, nav, legacy);
  assert.ok(mfd.snapshot()[3].values.includes('SHIP STORAGE: 33.0 / 960 kg'));
  nav.powered = true; mfd.update(.001, nav, legacy);
  assert.ok(mfd.snapshot()[3].values.includes('SHIP STORAGE: 33.0 / 960 kg'));
  assert.ok(mfd.snapshot()[3].values.includes('BACKPACK: 1.0 / 20 kg'));
});

test('connected authoritative server inventory bypasses the local medium total readout', t => {
  const { legacy, mfd, nav } = fixture(t);
  const local = { mass: id => legacy.mass(id), capacity: legacy.capacity, massReadout() { throw Error('Local totals must not override server authority'); } };
  const state = { connected: true, inventory: { containers: { ship: { repair: 1, ice: 3 }, pack: { basalt: 2 } }, capacity: { ship: 2400, pack: 20 } }, players: [] };
  for (const multiplayer of [state, { state }]) {
    nav.multiplayer = multiplayer; mfd.update(.2, nav, local);
    assert.ok(mfd.snapshot()[3].values.includes('SHIP STORAGE: 7.0 / 2400 kg'));
    assert.ok(mfd.snapshot()[3].values.includes('BACKPACK: 2.0 / 20 kg'));
    assert.ok(mfd.snapshot()[3].values.includes('ACCESS: SERVER AUTHORITY'));
  }
});

test('actual Stratum readout keeps dedicated ore and freight separate from canonical ship storage', async t => {
  const f = fixture(t), { store, legacy, display, mfd, nav } = f;
  assert.equal(store.claimStarterConstruction().ok, true);
  assert.equal(store.registerContainer({ id: 'stratum-ore', name: 'Stratum dedicated ore bin', kind: 'ship', boxes: 8 }), true);
  assert.equal(store.commitRock(store.state.id, { field: store.state.field, yieldVolume: [9.5, 0, 0] }, 0, 'stratum-ore'), true);
  assert.equal(display.mass('ship'), 136, 'dedicated ore is not added to general ship storage');
  nav.shipMiningState = { mass: itemMass(store.container('stratum-ore').items), charge: .8, beaming: 2, reason: 'CUTTING' };

  // Evaluate the production display closure only. Asset loading and lights are
  // outside this display regression; the real MFD canvas formatter runs below.
  const source = await readFile(new URL('../src/medium-ships.js', import.meta.url), 'utf8');
  const start = source.indexOf('    ship.updateDisplays = (dt, nav, inventory) => {');
  const end = source.indexOf('\n    ship.displayState =', start);
  assert.ok(start >= 0 && end > start, 'locate the actual Stratum display closure');
  const ship = {}, systems = { moving: false, secured: true };
  new Function('ship', 'mfd', 'systems', source.slice(start, end))(ship, mfd, systems);
  ship.updateDisplays(.2, nav, display);
  assert.ok(mfd.snapshot()[3].values.includes('SHIP STORAGE: 136.0 kg'));
  assert.ok(mfd.snapshot()[2].values.includes('ORE BIN: 9.50 / 384 kg'));
  assert.ok(mfd.snapshot()[3].values.includes('BOARDING RAMP: SECURED'));
  assert.ok(mfd.snapshot()[3].values.includes('LANDING GEAR: DOWN'));
  assert.ok(f.canvases[3].text.includes('32 SBU freight / separate ore bin'));
  ship.updateDisplays(.2, nav, legacy);
  assert.ok(mfd.snapshot()[3].values.includes('SUPPLIES: 33.0 / 240 kg'), 'unadapted legacy wrapper input keeps its existing behavior');
});
