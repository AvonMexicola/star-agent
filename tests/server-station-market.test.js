import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createWorld } from '../server/world.js';
import { createMemoryStore } from '../server/database.js';
import { createTrading } from '../server/trading.js';
import { emptyCommerce, ensureAccount } from '../src/trading/model.js';
import { AEON_MARKET_ID, quoteStation } from '../src/trading/market.js';
import { TRADE_RESOURCES } from '../src/trading/model.js';
import { HUB_COMMODITY_TERMINALS, AEON_STATION_TERMINALS, stationTerminalPoint,
  stationedForTrade } from '../src/trading/station-terminals.js';
import { readGLBGeometry } from './helpers/gltf-geometry.js';

const worldPromise = createWorld();
async function setup(initialStock = 1024) {
  const world = await worldPromise, store = createMemoryStore(), players = new Map(), initial = emptyCommerce();
  for (let index = 0; index < 2; index++) {
    const account = await store.createAccount({ email: `market-${index}@example.test`, callsign: `Trader_${index}`, passwordHash: 'test-only' });
    const nav = world.createNavigation(index, () => {});
    nav.mode = 'walk'; nav.insideShip = false;
    players.set(account.id, { id: account.id, account, nav, health: 100, hangarId: index + 1,
      inventory: { revision: 0, containers: { pack: {} } }, send() {} });
    ensureAccount(initial, account.id, 100000);
  }
  initial.markets[AEON_MARKET_ID].stock.basalt = initialStock;
  await store.transactCommerce(() => ({ state: initial }));
  const options = { store, players, world, persistent: () => ({ version: 1 }), flushWrites: async () => {} };
  const trading = createTrading(options);
  for (const player of players.values()) await trading.join(player);
  let serial = 0;
  return { world, store, players, trading, options,
    at(player, terminal) { player.nav.position.copy(stationTerminalPoint(world.station, terminal)); },
    buy(player, terminal, fields = {}) { return trading.request(player, { revision: trading.state.revision,
      commandId: `server-market-${++serial}`, op: 'buy', ship: `${player.id}:nomad`, resource: 'basalt', sbu: 1, terminal, ...fields }); } };
}

test('registered hub exchange points match the actual authored screens and exclude other retailers', async () => {
  const { scene } = await readGLBGeometry(new URL('../public/models/station-concourse.glb', import.meta.url));
  scene.updateMatrixWorld(true); const world = await worldPromise;
  assert.equal(AEON_STATION_TERMINALS.length, 22);
  for (const terminal of HUB_COMMODITY_TERMINALS) {
    const anchor = scene.getObjectByName(terminal.node); assert.ok(anchor, terminal.node);
    assert.ok(anchor.getWorldPosition(new Vector3()).distanceTo(new Vector3(...terminal.point)) < 0.000001);
    const point = stationTerminalPoint(world.station, terminal.id);
    assert.ok(world.station.hub.toLocal(point, new Vector3()).distanceTo(new Vector3(...terminal.point)) < 0.000001);
  }
  for (const id of ['station:hub:armory', 'station:hub:equipment', 'station:21', 'station:1:forged']) {
    assert.equal(stationTerminalPoint(world.station, id), null);
  }
});

test('concurrent pilots at different berths cannot oversell one shared warehouse unit or replay delivery', async () => {
  const fixture = await setup(1), [a, b] = [...fixture.players.values()];
  fixture.at(a, 'station:1'); fixture.at(b, 'station:2');
  const revision = fixture.trading.state.revision;
  const results = await Promise.allSettled([
    fixture.buy(a, 'station:1', { revision, commandId: 'last-unit-a' }),
    fixture.buy(b, 'station:2', { revision, commandId: 'last-unit-b' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.match(results.find(result => result.status === 'rejected').reason.message, /changed/);
  const saved = await fixture.store.loadCommerce(); assert.equal(saved.markets[AEON_MARKET_ID].stock.basalt, 0);
  assert.equal(Object.values(saved.ships).reduce((total, ship) => total + ship.crates.length, 0), 1);
  const winner = results[0].status === 'fulfilled' ? a : b, terminal = `station:${winner.hangarId}`;
  const commandId = winner === a ? 'last-unit-a' : 'last-unit-b';
  await fixture.buy(winner, terminal, { revision, commandId });
  assert.deepEqual(await fixture.store.loadCommerce(), saved);
  await assert.rejects(fixture.buy(winner, terminal), /Only 0 SBU/);
});

test('hub delivery goes to the leased parked ship while character speed does not gate commerce', async () => {
  const fixture = await setup(), [player] = [...fixture.players.values()];
  const id = HUB_COMMODITY_TERMINALS[0].id, ship = `${player.id}:nomad`;
  fixture.at(player, id); player.nav.velocity.set(10, 0, 0);
  assert.ok(player.nav.speed > 1); assert.equal(player.nav.shipVelocity.length(), 0);
  const before = fixture.trading.snapshot(player), quote = quoteStation(before, id, TRADE_RESOURCES[0], 'buy', 1);
  await fixture.buy(player, id);
  assert.equal(fixture.trading.state.ships[ship].crates.length, 1);
  assert.equal(fixture.trading.state.accounts[player.id].credits, before.account.credits - quote.total);
  assert.equal(fixture.trading.state.markets[AEON_MARKET_ID].stock.basalt, quote.stockAfter);
  fixture.at(player, HUB_COMMODITY_TERMINALS[1].id);
  const crate = fixture.trading.state.ships[ship].crates[0];
  await fixture.buy(player, HUB_COMMODITY_TERMINALS[1].id, { op: 'sell', crate: crate.id });
  assert.equal(fixture.trading.state.ships[ship].crates.length, 0);
  assert.equal(fixture.trading.state.markets[AEON_MARKET_ID].stock.basalt, 1024);
  assert.equal(fixture.trading.state.accounts[player.id].credits, 99992);
});

test('hub reach and delivery fail closed for moved hulls, lost leases, foreign berths and motion', async () => {
  const fixture = await setup(), [player, other] = [...fixture.players.values()], terminal = HUB_COMMODITY_TERMINALS[0].id;
  const root = player.nav.shipPosition.clone(), baseline = structuredClone(fixture.trading.state);
  const reset = () => { player.hangarId = 1; player.nav.mode = 'walk'; player.nav.insideShip = false;
    player.nav.dockedAtStation = true; player.nav.shipPosition = root.clone(); player.nav.shipVelocity.set(0, 0, 0);
    player.nav.cabinFlight = false; player.nav.travel = null; fixture.at(player, terminal); };
  for (const invalidate of [
    () => { player.hangarId = null; }, () => { player.hangarId = 2; },
    () => { player.nav.shipPosition.copy(fixture.world.pods[1].padWorldPosition); },
    () => { player.nav.shipPosition = null; }, () => { player.nav.shipVelocity.set(1, 0, 0); },
    () => { player.nav.cabinFlight = true; }, () => { player.nav.travel = { phase: 'accelerate' }; },
    () => { player.nav.dockedAtStation = false; }, () => { player.nav.mode = 'eva'; },
    () => { player.nav.insideShip = true; }, () => { player.nav.position.addScalar(3); },
  ]) {
    reset(); invalidate(); await assert.rejects(fixture.buy(player, terminal), /docked|Walk up/);
    assert.deepEqual(fixture.trading.state, baseline);
  }
  reset(); await assert.rejects(fixture.buy(player, terminal, { ship: `${other.id}:nomad` }), /your ship/);
  await assert.rejects(fixture.buy(player, terminal, { ship: `${player.id}:atlas` }), /docked/);
  fixture.at(player, 'station:2'); await assert.rejects(fixture.buy(player, 'station:2'), /docked/);
  fixture.at(player, terminal); await assert.rejects(fixture.buy(player, 'station:hub:armory'), /Walk up/);
  assert.deepEqual(await fixture.store.loadCommerce(), baseline);
  for (const id of AEON_STATION_TERMINALS.filter(t => t.frame === 'hangar').map(t => t.id)) {
    assert.equal(stationedForTrade({ nav: player.nav, hangarId: 1, station: fixture.world.station }, id), id === 'station:1');
  }
});

test('a transaction failure after command evaluation publishes no stock, money or crate changes', async () => {
  const fixture = await setup(), [player] = [...fixture.players.values()]; fixture.at(player, 'station:1');
  const committed = fixture.store.transactCommerce, before = structuredClone(fixture.trading.state);
  fixture.store.transactCommerce = fn => committed(async current => { await fn(current); throw Error('simulated COMMIT failure'); });
  await assert.rejects(fixture.buy(player, 'station:1'), /COMMIT failure/);
  assert.deepEqual(fixture.trading.state, before); assert.deepEqual(await fixture.store.loadCommerce(), before);
  fixture.store.transactCommerce = committed;
  await fixture.buy(player, 'station:1'); assert.equal(fixture.trading.state.markets[AEON_MARKET_ID].stock.basalt, 1023);
  const reloaded = createTrading(fixture.options); await reloaded.join(player);
  assert.deepEqual(reloaded.state, fixture.trading.state);
  for (let read = 0; read < 20; read++) reloaded.snapshot(player);
  assert.deepEqual(await fixture.store.loadCommerce(), fixture.trading.state);
});

test('normalization commits once and neither failed nor corrupt reads replace durable commerce', async () => {
  const fixture = await setup(), [player] = [...fixture.players.values()];
  const legacy = structuredClone(fixture.trading.state); delete legacy.markets; delete legacy.marketVersion;
  await fixture.store.transactCommerce(() => ({ state: legacy }));
  const next = createTrading(fixture.options), before = structuredClone(next.state), committed = fixture.store.transactCommerce;
  fixture.store.transactCommerce = fn => committed(async current => { await fn(current); throw Error('disk unavailable'); });
  await assert.rejects(next.join(player), /disk unavailable/);
  assert.deepEqual(next.state, before); assert.deepEqual(await fixture.store.loadCommerce(), legacy);
  fixture.store.transactCommerce = committed; await next.join(player);
  assert.equal((await fixture.store.loadCommerce()).marketVersion, 1);
  const damaged = structuredClone(next.state); delete damaged.markets;
  await fixture.store.transactCommerce(() => ({ state: damaged }));
  const validCache = structuredClone(next.state);
  await assert.rejects(next.join(player), /original data retained/);
  assert.deepEqual(next.state, validCache); assert.deepEqual(await fixture.store.loadCommerce(), damaged);
});
