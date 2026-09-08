import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import pg from 'pg';
import { createPostgresPoolCloser } from '../server/postgres-pool.js';
import { createPostgresStore } from '../server/database.js';
import { startLocalDatabase } from '../server/local-database.js';

test('pool shutdown waits for every socket, including a connection completed during drain', async () => {
  const pool = new EventEmitter(), first = new EventEmitter(), late = new EventEmitter();
  let calls = 0, finished = false;
  pool.end = async () => { calls++; pool.emit('connect', late); };
  const close = createPostgresPoolCloser(pool);
  pool.emit('connect', first);
  const pending = close();
  pending.then(() => { finished = true; });
  assert.equal(close(), pending, 'concurrent close shares one drain');
  await Promise.resolve();
  first.emit('end');
  await Promise.resolve();
  assert.equal(finished, false, 'pool completion and one socket do not close the store');
  late.emit('end');
  await pending;
  assert.equal(finished, true);
  assert.equal(calls, 1);
  assert.equal(pool.listenerCount('connect'), 0);
});

test('pool shutdown retains end failures and releases its tracking listener', async () => {
  const pool = new EventEmitter(), failure = Error('pool drain failed');
  pool.end = async () => { throw failure; };
  await assert.rejects(createPostgresPoolCloser(pool)(), error => error === failure);
  assert.equal(pool.listenerCount('connect'), 0);
});

test('real owned stores close every PostgreSQL socket on reopen and failed initialization; supplied pools stay usable',
  { timeout: 90_000 }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'star-agent-pool-close-'));
    const reservation = createServer();
    await new Promise((resolve, reject) => {
      reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve);
    });
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const OriginalPool = pg.Pool, connections = [], closers = [];
    let database, store, external;
    pg.Pool = class extends OriginalPool {
      constructor(...args) {
        super(...args);
        this.on('connect', client => {
          const record = { ended: false };
          record.done = new Promise(resolve => client.once('end', () => { record.ended = true; resolve(); }));
          connections.push(record);
        });
      }
    };
    t.after(async () => {
      pg.Pool = OriginalPool;
      try {
        await store?.close();
        for (const close of closers) await close();
        await Promise.all(connections.map(record => record.done));
      } finally {
        await database?.close();
        await rm(root, { recursive: true, force: true });
      }
    });
    database = await startLocalDatabase({ XDG_DATA_HOME: root,
      DEV_DATABASE_NAME: 'pool-close-test', DEV_DATABASE_PORT: String(port) });
    const assertDisconnected = () => assert.ok(connections.length && connections.every(record => record.ended),
      'store.close resolves only after all owned client end events');
    store = await createPostgresStore({ connectionString: database.connectionString });
    await store.migrate();
    const account = await store.createAccount({ email: 'close@example.test', callsign: 'Close_Test', passwordHash: 'test-only' });
    await store.close(); store = null; assertDisconnected();
    store = await createPostgresStore({ connectionString: database.connectionString });
    assert.equal((await store.findAccountByEmail('close@example.test')).id, account.id);
    await store.close(); store = null; assertDisconnected();
    const invalid = new URL(database.connectionString);
    invalid.searchParams.set('options', '-c search_path=missing_test_schema');
    await assert.rejects(createPostgresStore({ connectionString: invalid.href }), /existing schema/);
    assertDisconnected();
    external = new OriginalPool({ connectionString: database.connectionString });
    closers.push(createPostgresPoolCloser(external));
    store = await createPostgresStore({ pool: external });
    await store.close(); store = null;
    assert.equal((await external.query('SELECT 1 AS alive')).rows[0].alive, 1,
      'the caller still owns a supplied pool');
  });
