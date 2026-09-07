import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import pg from 'pg';
import { Vector3 } from 'three';
import { createPostgresStore } from '../server/database.js';
import { startLocalDatabase } from '../server/local-database.js';
import { createStationSecurity } from '../server/security.js';
import { AEON_STATION_ID } from '../src/station-security-policy.js';
import { AEON_MARKET_ID, quoteStation } from '../src/trading/market.js';
import { stationTerminal, stationTerminalMarket } from '../src/trading/station-terminals.js';
import { emptyCommerce, ensureAccount, normalizeCommerce, commerceCommand,
  resourceById } from '../src/trading/model.js';

async function unusedPort() {
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve);
  });
  const { port } = reservation.address();
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}

function ownedPool(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 5 }), disconnected = [];
  pool.on('connect', client => disconnected.push(new Promise(resolve => client.once('end', resolve))));
  let closing;
  return { pool, close: () => closing ??= (async () => {
    // pg-pool can resolve end() while the removed clients are still closing.
    // Wait for their real socket lifecycle before terminating our PostgreSQL.
    await pool.end(); await Promise.all(disconnected);
  })() };
}

test('isolated PostgreSQL preserves the shared Aeon market and accepted friendship authority across store restart',
  { timeout: 90_000 }, async t => {
    assert.equal(AEON_MARKET_ID, AEON_STATION_ID, 'commodity and protection registries name the same station');
    const directory = await mkdtemp(join(tmpdir(), 'star-agent-community-persistence-'));
    const stores = new Map(), pools = new Set(); let database, inspection, security;
    const closeStore = async store => {
      await store.close(); await stores.get(store).close(); stores.delete(store);
    };
    t.after(async () => {
      const errors = [];
      for (const close of [() => security?.close(), ...[...stores.keys()].map(store => () => closeStore(store)),
        ...[...pools].map(pool => () => pool.close()), () => database?.close()]) {
        try { await close(); } catch (error) { errors.push(error); }
      }
      // Never remove files beneath a database that failed to shut down.
      if (!errors.length) await rm(directory, { recursive: true, force: true });
      if (errors.length) throw new AggregateError(errors, `Owned database cleanup failed: ${directory}`);
    });
    const port = await unusedPort();
    // Explicit settings cannot inherit DATABASE_URL / DEV_DATABASE_URL or use a
    // shared service. Only this newly created directory and loopback port exist.
    database = await startLocalDatabase({ XDG_DATA_HOME: directory,
      DEV_DATABASE_NAME: 'community-persistence', DEV_DATABASE_PORT: String(port) });
    const openPool = () => {
      const resource = ownedPool(database.connectionString); pools.add(resource); return resource;
    };
    const openStore = async () => {
      const resource = openPool(), store = await createPostgresStore({ pool: resource.pool });
      stores.set(store, resource); return store;
    };
    let first = await openStore(), second = await openStore();
    inspection = openPool().pool;
    await Promise.all([first.migrate(), second.migrate()]);
    const versions = (await readdir(new URL('../server/migrations/', import.meta.url)))
      .filter(name => /^\d{3}-[a-z0-9-]+\.sql$/.test(name)).map(name => Number(name.slice(0, 3))).sort((a, b) => a - b);
    assert.deepEqual((await inspection.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row => row.version), versions);
    assert.ok(versions.includes(2) && versions.includes(4), 'both commerce and accepted-friend migrations ran');

    const accounts = await Promise.all(['seller', 'buyer', 'pending'].map(name => first.createAccount({
      email: `community-${name}@example.test`, callsign: `Community_${name}`, passwordHash: 'disposable-test-only',
    })));
    const [alice, bob, pending] = accounts;
    // Exercise the existing fixed-price JSON upgrade in the actual transaction.
    const legacy = emptyCommerce(); delete legacy.markets; delete legacy.marketVersion;
    for (const account of accounts) ensureAccount(legacy, account.id, 100000);
    await first.transactCommerce(current => { assert.equal(current, null); return { state: legacy }; });
    await second.transactCommerce(current => ({ state: normalizeCommerce(current) }));
    const initial = await first.loadCommerce();
    assert.equal(initial.marketVersion, 1); assert.equal(initial.markets[AEON_MARKET_ID].stock.basalt, 1024);

    assert.equal(await first.socialChange(alice.id, bob.id, 'request'), true);
    assert.equal(await second.socialChange(bob.id, alice.id, 'request'), true);
    assert.equal(await first.socialChange(alice.id, bob.id, 'accept'), false, 'requester cannot grant their own consent');
    assert.equal(await first.areFriends(alice.id, bob.id), false, 'crossing requests remain pending');
    assert.equal(await second.areFriends(bob.id, alice.id), false);

    const center = new Vector3(25_000_000_000, 1_900_000, 0), strikes = [], securityErrors = [];
    security = createStationSecurity({ world: { center }, areFriends: (a, b) => first.areFriends(a, b),
      onStrike: (...args) => strikes.push(args), onError: error => securityErrors.push(error) });
    async function assertFriendAuthority(actor, target, expected, id) {
      // Trusted resolved impact fixtures test the durable friend predicate, not
      // socket authentication, aim, physical reach, or a playable combat route.
      const player = account => ({ id: account.id, account, health: 100, shipHealth: 100,
        nav: { position: center.clone(), mode: 'walk', velocity: new Vector3(), shipVelocity: new Vector3() } });
      const attacker = player(actor), victim = player(target), count = strikes.length;
      const result = await security.submit({ id, attacker, victim, kind: 'player', cause: 'shot', damage: 25, point: center.clone() });
      assert.equal(result.accepted, true); assert.equal(result.protected, true); assert.equal(result.friend, expected);
      assert.equal(victim.health, 75); assert.equal(attacker.health, expected ? 100 : 0);
      assert.equal(strikes.length - count, expected ? 0 : 1);
    }
    await assertFriendAuthority(alice, bob, false, 'pending-relationship');
    assert.equal(await second.socialChange(bob.id, alice.id, 'accept'), true);
    assert.equal(await first.areFriends(alice.id, bob.id), true); assert.equal(await second.areFriends(bob.id, alice.id), true);
    await first.socialChange(alice.id, pending.id, 'request');
    await assertFriendAuthority(alice, bob, true, 'accepted-relationship');

    // Database-boundary fixture: physical terminal/lease validation has separate
    // room tests. This context permits only registered stations and owned ships.
    const context = { terminal: id => Boolean(stationTerminal(id)),
      docked: ship => ship.owner === alice.id, stationMarket: stationTerminalMarket };
    const fields = { ship: `${alice.id}:atlas`, resource: 'basalt', sbu: 64 };
    const beforeAsk = quoteStation(initial, 'station:1', resourceById('basalt'), 'buy', 1).total;
    const beforeBid = quoteStation(initial, 'station:1', resourceById('basalt'), 'sell', 1).total;
    const bought = await first.transactCommerce(state => commerceCommand(state, alice.id, {
      ...fields, op: 'buy', terminal: 'station:1', revision: state.revision, commandId: 'berth-bulk-buy',
    }, context));
    assert.equal(bought.quote.total, 1343); assert.equal(bought.state.markets[AEON_MARKET_ID].stock.basalt, 960);
    assert.equal(bought.state.accounts[alice.id].credits, 100000 - 1343);
    const scarce = await second.loadCommerce();
    assert.ok(quoteStation(scarce, 'station:20', resourceById('basalt'), 'buy', 1).total > beforeAsk);
    assert.ok(quoteStation(scarce, 'station:hub:exchange-north', resourceById('basalt'), 'sell', 1).total > beforeBid);
    const sold = await second.transactCommerce(state => commerceCommand(state, alice.id, {
      ...fields, op: 'sell', terminal: 'station:hub:exchange-south', crate: bought.state.ships[fields.ship].crates[0].id,
      revision: state.revision, commandId: 'hub-bulk-sell',
    }, context));
    assert.equal(sold.quote.total, 768); assert.equal(sold.state.markets[AEON_MARKET_ID].stock.basalt, 1024);
    assert.ok(sold.quote.total < bought.quote.total, 'the same stock interval loses the bid/ask spread');
    assert.equal(quoteStation(sold.state, 'station:1', resourceById('basalt'), 'buy', 1).total, beforeAsk);
    assert.equal(quoteStation(sold.state, 'station:1', resourceById('basalt'), 'sell', 1).total, beforeBid);

    const quotedRevision = sold.state.revision;
    const orders = ['station:1', 'station:hub:exchange-north'].map((terminal, index) => ({
      ...fields, op: 'buy', terminal, revision: quotedRevision, commandId: `concurrent-buy-${index}`,
    }));
    const outcomes = await Promise.allSettled([first, second].map((store, index) =>
      store.transactCommerce(state => commerceCommand(state, alice.id, orders[index], context))));
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.match(outcomes.find(result => result.status === 'rejected').reason.message, /Cargo changed/);
    const winner = outcomes.findIndex(result => result.status === 'fulfilled');
    const committed = await first.loadCommerce();
    assert.equal(committed.revision, quotedRevision + 1);
    assert.equal(committed.accounts[alice.id].credits, 100000 - 1343 + 768 - 1343);
    assert.equal(committed.accounts[bob.id].credits, 100000);
    assert.equal(committed.markets[AEON_MARKET_ID].stock.basalt, 960);
    assert.equal(committed.ships[fields.ship].crates.length, 1); assert.equal(committed.ships[fields.ship].crates[0].sbu, 64);
    assert.equal(Object.hasOwn(committed.receipts, `${alice.id}:${orders[1 - winner].commandId}`), false);
    const replay = await second.transactCommerce(state => commerceCommand(state, alice.id, orders[winner], context));
    assert.equal(replay.replayed, true); assert.deepEqual(await first.loadCommerce(), committed);

    const playerState = { version: 1, inventory: { revision: 0, containers: { pack: { basalt: 16 } } } };
    await first.savePlayerState(alice.id, playerState);
    const friendLists = await Promise.all(accounts.map(account => first.socialList(account.id)));
    await assert.rejects(first.transactCommerce(state => {
      const result = commerceCommand(state, alice.id, { ...fields, op: 'buy', resource: 'ice', sbu: 1,
        terminal: 'station:1', revision: state.revision, commandId: 'rolled-back-ice' }, context);
      // transactCommerce writes its ledger first, then these player rows. The
      // missing account FK fails after both the ledger and first row were written.
      return { ...result, players: { [alice.id]: { version: 1, inventory: { corrupted: true } },
        '00000000-0000-0000-0000-000000000000': { version: 1 } } };
    }), error => error.code === '23503');
    assert.deepEqual(await second.loadCommerce(), committed, 'stock, wallets, crate IDs and receipts roll back together');
    assert.deepEqual(await second.loadPlayerState(alice.id), playerState, 'earlier player write also rolls back');
    assert.deepEqual(await Promise.all(accounts.map(account => second.socialList(account.id))), friendLists);

    await closeStore(first); await closeStore(second);
    first = await openStore(); second = await openStore(); await Promise.all([first.migrate(), second.migrate()]);
    assert.deepEqual(await first.loadCommerce(), committed, 'reopening and re-running migration never replenish finite stock');
    assert.deepEqual(await second.loadCommerce(), committed);
    assert.deepEqual(await first.loadPlayerState(alice.id), playerState);
    assert.deepEqual(await Promise.all(accounts.map(account => first.socialList(account.id))), friendLists);
    assert.equal(await first.areFriends(alice.id, bob.id), true); assert.equal(await second.areFriends(bob.id, alice.id), true);
    assert.equal(await first.areFriends(alice.id, pending.id), false); assert.equal(await second.areFriends(pending.id, alice.id), false);
    await assertFriendAuthority(bob, alice, true, 'accepted-after-restart');
    await assertFriendAuthority(pending, alice, false, 'pending-after-restart');
    assert.deepEqual(securityErrors, []);
    t.diagnostic(`PostgreSQL 16, migrations ${versions.join('/')}; two independent stores; stock 960 SBU and accepted mutual friendship retained.`);
  });
