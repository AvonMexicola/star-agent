import test from 'node:test';
import assert from 'node:assert/strict';
import { AEON_MARKET_ID, MARKET_INITIAL_STOCK, MARKET_STOCK_LIMIT, createMarket,
  marginalPrices, quoteMarket, quoteStation, marketIdForTerminal } from '../src/trading/market.js';
import { TRADE_RESOURCES, emptyCommerce, ensureAccount, normalizeCommerce, validCommerce,
  commerceCommand } from '../src/trading/model.js';
import { AEON_STATION_TERMINALS } from '../src/trading/station-terminals.js';
import { LocalTrading } from '../src/trading/local.js';
import { MiningStore, MINING_KEY } from '../src/mining/store.js';

const basalt = TRADE_RESOURCES[0], context = { terminal: () => true, docked: () => true, resources: () => 1024 };
const stock = state => state.markets[AEON_MARKET_ID].stock.basalt;
function ledger() { const state = emptyCommerce(); ensureAccount(state, 'pilot', 100000); return state; }
let serial = 0;
const command = (state, fields, ctx = context) => commerceCommand(state, 'pilot', {
  revision: state.revision, commandId: `market-${++serial}`, terminal: 'station:1',
  ship: 'pilot:atlas', resource: 'basalt', sbu: 1, ...fields,
}, ctx);

test('every resource has positive integer spread and both marginal prices decrease with abundance', () => {
  for (const resource of TRADE_RESOURCES) {
    let previous = { ask: Infinity, bid: Infinity };
    for (let level = 1; level <= MARKET_STOCK_LIMIT; level++) {
      const prices = marginalPrices(resource, level);
      assert.ok(Number.isSafeInteger(prices.ask) && Number.isSafeInteger(prices.bid));
      assert.ok(prices.bid > 0 && prices.ask > prices.bid);
      assert.ok(prices.ask <= previous.ask && prices.bid <= previous.bid);
      previous = prices;
    }
    const scarce = marginalPrices(resource, 1), abundant = marginalPrices(resource, MARKET_STOCK_LIMIT);
    assert.ok(scarce.ask > abundant.ask && scarce.bid > abundant.bid);
  }
});

test('bulk quotes integrate the same inventory levels as split orders and a complete roundtrip loses spread', () => {
  for (const resource of TRADE_RESOURCES) for (const initial of [64, 256, 1024, 2048, 4032]) {
    for (const quantity of [1, 2, 4, 8, 16, 32, 64]) for (const side of ['buy', 'sell']) {
      const market = createMarket(TRADE_RESOURCES); market.stock[resource.id] = initial;
      const bulk = quoteMarket(market, resource, side, quantity); assert.equal(bulk.ok, true);
      let splitTotal = 0;
      for (let unit = 0; unit < quantity; unit++) {
        const split = quoteMarket(market, resource, side, 1);
        splitTotal += split.total; market.stock[resource.id] = split.stockAfter;
      }
      assert.equal(splitTotal, bulk.total);
      assert.equal(market.stock[resource.id], bulk.stockAfter);
      const reverse = quoteMarket(market, resource, side === 'buy' ? 'sell' : 'buy', quantity);
      assert.equal(reverse.stockAfter, initial);
      assert.ok(side === 'buy' ? bulk.total > reverse.total : reverse.total > bulk.total);
    }
  }
  const market = createMarket(TRADE_RESOURCES);
  assert.equal(quoteMarket(market, basalt, 'buy', 4).total, 83, 'known four-unit quote: 20 + 21 + 21 + 21');
  market.stock.basalt = 1020;
  assert.equal(quoteMarket(market, basalt, 'sell', 4).total, 48);
});

test('legacy normalization is additive, idempotent, and never repairs damaged market records', () => {
  const original = ledger(); delete original.markets; delete original.marketVersion;
  original.revision = 79; original.receipts['pilot:old'] = { message: 'historic receipt' };
  original.loose = { freight: { id: 'freight', resource: 'ice', sbu: 2, position: [25_000_000_000.125, 10, 20],
    quaternion: [0, 0, 0, 1], holder: 'pilot', until: 1500, movedAt: 1000 } };
  const before = structuredClone(original), normalized = normalizeCommerce(original);
  assert.deepEqual(original, before); assert.equal(normalized.revision, 79);
  assert.deepEqual(normalized.receipts, before.receipts); assert.equal(stock(normalized), MARKET_INITIAL_STOCK);
  assert.deepEqual(normalized.loose, before.loose, 'normalization retains tractor custody and double-precision position');
  assert.equal(normalized.marketVersion, 1);
  normalized.markets[AEON_MARKET_ID].stock.basalt = 0;
  assert.equal(normalizeCommerce(normalized), normalized); assert.equal(stock(normalized), 0);
  for (const damage of [s => { delete s.markets; }, s => { delete s.marketVersion; }, s => { s.markets = null; },
    s => { s.marketVersion = 2; }, s => { s.markets = {}; }, s => { delete s.markets[AEON_MARKET_ID].stock.ice; },
    s => { s.markets[AEON_MARKET_ID].stock.basalt = -1; }, s => { s.markets[AEON_MARKET_ID].stock.basalt = 4097; },
    s => { s.markets[AEON_MARKET_ID].stock.basalt = 0.5; }, s => { s.markets[AEON_MARKET_ID].stock.basalt = NaN; }]) {
    const damaged = structuredClone(normalized); damage(damaged); const unchanged = structuredClone(damaged);
    assert.equal(validCommerce(damaged), false); assert.throws(() => normalizeCommerce(damaged), /original data retained/);
    assert.deepEqual(damaged, unchanged);
  }
});

test('all twenty berths and two registered hub screens draw from one warehouse', () => {
  let state = ledger();
  for (const terminal of AEON_STATION_TERMINALS) {
    assert.equal(marketIdForTerminal(terminal.id), AEON_MARKET_ID);
    state = command(state, { op: 'buy', terminal: terminal.id }).state;
  }
  assert.equal(stock(state), 1002);
  assert.equal(state.ships['pilot:atlas'].crates.length, 22);
  assert.equal(Object.keys(state.markets).length, 1);
});

test('unknown trusted station IDs fail closed; distinct explicit markets keep distinct finite stock', () => {
  const state = ledger(); state.markets['selene-depot'] = createMarket(TRADE_RESOURCES, 'selene-depot');
  for (const id of ['station:0', 'station:21', 'station:01', 'station:anything', 'station:hub:armory',
    'station:hub:components', 'station:hub:exchange-north:forged', '__proto__']) {
    assert.equal(marketIdForTerminal(id), null);
    assert.throws(() => command(state, { op: 'buy', terminal: id, marketId: AEON_MARKET_ID }), /Unknown station/);
  }
  assert.throws(() => command(state, { op: 'buy' }, { ...context, stationMarket: () => 'unknown-station' }), /Unknown station/);
  assert.throws(() => command(state, { op: 'buy' }, { ...context, stationMarket: () => null }), /Unknown station/);
  assert.equal(quoteStation({ ...state, marketTerminals: {} }, 'station:1', basalt, 'buy', 1).ok, false);
  const fields = { op: 'buy', terminal: 'station:selene:exchange' };
  const result = command(state, fields, { ...context, stationMarket: id => id === fields.terminal ? 'selene-depot' : null });
  assert.equal(stock(result.state), 1024); assert.equal(result.state.markets['selene-depot'].stock.basalt, 1023);
});

test('stock and warehouse capacity reject atomically, while valid trades conserve packed material', () => {
  let state = ledger(); state.markets[AEON_MARKET_ID].stock.basalt = 1;
  const before = structuredClone(state);
  assert.throws(() => command(state, { op: 'buy', sbu: 2 }), /Only 1 SBU/); assert.deepEqual(state, before);
  let result = command(state, { op: 'buy' }); state = result.state;
  assert.equal(stock(state), 0); assert.equal(result.quote.stockBefore, 1);
  assert.throws(() => command(state, { op: 'buy' }), /Only 0 SBU/);
  const crate = state.ships['pilot:atlas'].crates[0];
  state.markets[AEON_MARKET_ID].stock.basalt = MARKET_STOCK_LIMIT;
  const full = structuredClone(state);
  assert.throws(() => command(state, { op: 'sell', crate: crate.id }), /room for 0 SBU/); assert.deepEqual(state, full);
  state.markets[AEON_MARKET_ID].stock.basalt--;
  result = command(state, { op: 'sell', crate: crate.id });
  assert.equal(stock(result.state), MARKET_STOCK_LIMIT); assert.equal(result.state.ships['pilot:atlas'].crates.length, 0);
});

test('quotes bind to ledger revision; replay returns its original settlement without moving stock twice', () => {
  const state = ledger(), message = { op: 'buy', resource: 'copper', sbu: 4, ship: 'pilot:atlas',
    terminal: 'station:1', revision: 0, commandId: 'quoted-order' };
  const result = commerceCommand(state, 'pilot', message, context);
  const replay = commerceCommand(result.state, 'pilot', message, context);
  assert.equal(replay.state, result.state); assert.deepEqual(replay.quote, result.quote);
  assert.equal(result.state.markets[AEON_MARKET_ID].stock.copper, 1020);
  assert.throws(() => commerceCommand(result.state, 'pilot', { ...message, commandId: 'new-order' }, context), /changed/);
});

test('owner prices and player shop stock stay independent of NPC scarcity; packing consumes mass only', () => {
  let state = ledger(); ensureAccount(state, 'seller', 0);
  state.markets[AEON_MARKET_ID].stock.basalt = 0;
  state.terminals['trade-1'] = { id: 'trade-1', owner: 'seller', position: [0, 0, 0], stock: { basalt: 2 }, prices: { basalt: 37 } };
  let result = command(state, { op: 'buy', terminal: 'trade-1', sbu: 2 }); state = result.state;
  assert.equal(state.accounts.seller.credits, 74); assert.equal(state.accounts.pilot.credits, 99926);
  assert.equal(state.terminals['trade-1'].stock.basalt, 0); assert.equal(stock(state), 0); assert.equal(result.quote, undefined);
  result = command(state, { op: 'pack', sbu: 2 });
  assert.equal(result.resourceDelta, -32); assert.equal(stock(result.state), 0);
});

function storageFixture() {
  const values = new Map(); let writes = 0;
  return { values, get writes() { return writes; }, storage: { getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (key === MINING_KEY) writes++; values.set(key, value); } } };
}
test('local initialization writes once; reads, reloads and exhausted stock never refill or rewrite', () => {
  const fixture = storageFixture(), store = new MiningStore(fixture.storage), trader = new LocalTrading(store);
  assert.equal(trader.error, ''); assert.equal(fixture.writes, 1);
  for (let read = 0; read < 10; read++) assert.equal(stock(trader.state), 1024);
  assert.equal(fixture.writes, 1);
  const next = structuredClone(trader.state); next.markets[AEON_MARKET_ID].stock.basalt = 0;
  assert.equal(store.write({ ...store.state, commerce: next }), true);
  const restored = new LocalTrading(new MiningStore(fixture.storage));
  assert.equal(stock(restored.state), 0); assert.equal(fixture.writes, 2);
  assert.throws(() => restored.command({ op: 'buy', ship: 'local-player:nomad', terminal: 'station:1',
    resource: 'basalt', sbu: 1, commandId: 'empty', revision: 0 }, context), /Only 0 SBU/);
  assert.equal(fixture.writes, 2);
});

test('corrupt local market and failed normalization writes preserve the exact original save', () => {
  const fixture = storageFixture(), store = new MiningStore(fixture.storage);
  const corrupt = ledger(); delete corrupt.markets;
  store.write({ ...store.state, commerce: corrupt }); const raw = fixture.values.get(MINING_KEY), count = fixture.writes;
  const trader = new LocalTrading(new MiningStore(fixture.storage));
  assert.match(trader.error, /original data retained/); assert.equal(fixture.values.get(MINING_KEY), raw); assert.equal(fixture.writes, count);
  const fresh = storageFixture(), legacyStore = new MiningStore(fresh.storage), legacy = ledger();
  delete legacy.markets; delete legacy.marketVersion;
  legacyStore.write({ ...legacyStore.state, commerce: legacy }); const original = fresh.values.get(MINING_KEY);
  fresh.storage.setItem = () => { throw Error('disk full'); };
  const failed = new LocalTrading(new MiningStore(fresh.storage));
  assert.match(failed.error, /Save unavailable/); assert.equal(fresh.values.get(MINING_KEY), original);
});
