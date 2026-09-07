import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as socketServer } from 'node:net';
import WebSocket from 'ws';
import { localDatabaseOptions } from '../server/local-database.js';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read, label, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await read(); if (value) return value; await pause(40); }
  throw new Error(`Timed out: ${label}`);
}
async function unusedPort() {
  const server = socketServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function runner(env) {
  const child = spawn(process.execPath, ['scripts/dev-all.mjs'], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output += data; });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  return { child, exited, output: () => output, async stop() {
    if (child.exitCode !== null || child.signalCode) return exited;
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    try { return await exited; } finally { clearTimeout(timer); }
  } };
}
async function ready(run) {
  await until(() => {
    if (run.child.exitCode !== null) throw new Error(`Runner failed: ${run.output()}`);
    return run.output().includes('Star Agent multiplayer listening');
  }, 'persistent API ready');
}
async function peer(origin, cookie) {
  const messages = [];
  const ws = new WebSocket(origin.replace('http:', 'ws:') + '/ws', { headers: { Origin: origin, Cookie: cookie } });
  let failure;
  ws.on('message', data => messages.push(JSON.parse(data)));
  ws.on('error', error => { failure = error; });
  const state = () => messages.findLast(message => message.type === 'state');
  await until(() => { if (failure) throw failure; return state()?.inventory; }, 'authenticated room snapshot');
  return { ws, messages, state };
}

test('local database selection ignores production settings and cannot silently choose RAM', () => {
  const configured = localDatabaseOptions({ DATABASE_URL: 'postgresql://private.example/live', STAR_AGENT_MEMORY: '1' });
  assert.match(configured.directory, /star-agent.*postgres.*star-agent-local/);
  assert.equal(configured.name, 'star-agent-local');
  assert.equal(configured.connectionString, undefined);
  assert.equal(localDatabaseOptions({ DEV_DATABASE_URL: 'postgresql://127.0.0.1/star_agent_test' }).connectionString, 'postgresql://127.0.0.1/star_agent_test');
  for (const url of ['', 'postgresql://remote.example/db', 'https://localhost/db']) {
    assert.throws(() => localDatabaseOptions({ DEV_DATABASE_URL: url }), /local PostgreSQL|loopback/);
  }
  assert.throws(() => localDatabaseOptions({ DEV_DATABASE_NAME: '../other-project' }), /DEV_DATABASE_NAME/);
  assert.throws(() => localDatabaseOptions({ DEV_DATABASE_PORT: '65536' }), /DEV_DATABASE_PORT/);
});

test('accounts, cookie sessions and authoritative inventory survive full restart and cold-backup restore', { timeout: 90000 }, async t => {
  const data = await mkdtemp(join(tmpdir(), 'star-agent-sql-'));
  const port = await unusedPort(), apiPort = await unusedPort(), dbPort = await unusedPort();
  const env = { DEV_PORT: String(port), DEV_API_PORT: String(apiPort), XDG_DATA_HOME: data,
    DEV_DATABASE_NAME: 'restart-test', DEV_DATABASE_PORT: String(dbPort),
    DATABASE_URL: 'postgresql://invalid.example/never-use-this', STAR_AGENT_MEMORY: '1' };
  delete env.DEV_DATABASE_URL;
  const origin = `http://127.0.0.1:${port}`;
  let running, pilot;
  t.after(async () => { pilot?.ws.terminate(); await running?.stop(); await rm(data, { recursive: true, force: true }); });
  running = runner({ ...env, DEV_DATABASE_URL: undefined }); await ready(running);
  if (process.platform !== 'win32') {
    assert.equal((await stat(join(data, 'star-agent/postgres/restart-test'))).mode & 0o777, 0o700);
    assert.equal((await stat(join(data, 'star-agent/postgres/restart-test/credentials.json'))).mode & 0o777, 0o600);
  }
  const post = (action, body) => fetch(`${origin}/api/auth/${action}`, { method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const credentials = { email: 'durable@example.test', callsign: 'Durable_Pilot', password: 'durable local test password' };
  const registered = await post('register', credentials);
  assert.equal(registered.status, 201);
  const account = (await registered.json()).account, cookie = registered.headers.get('set-cookie').split(';')[0];
  pilot = await peer(origin, cookie);
  assert.equal(pilot.state().players.find(player => player.id === account.id).mode, 'walk');
  pilot.ws.send(JSON.stringify({ type: 'request', requestId: 'durable-transfer', action: 'transfer',
    from: 'pack', to: 'ship', item: 'bandage', quantity: 1, revision: pilot.state().inventory.revision }));
  await until(() => pilot.state()?.inventory.containers.ship.bandage === 1, 'authoritative saved transfer');
  const inventory = structuredClone(pilot.state().inventory);
  assert.equal(inventory.containers.pack.bandage, 2);
  assert.equal((await running.stop()).code, 0, running.output());
  assert.doesNotMatch(running.output(), /FAILED|PrismaClient.*Error/);
  pilot = null;

  running = runner({ ...env, DEV_DATABASE_URL: undefined }); await ready(running);
  const session = await fetch(`${origin}/api/auth/session`, { headers: { Cookie: cookie } });
  assert.deepEqual((await session.json()).account, account);
  const login = await post('login', credentials);
  assert.equal(login.status, 200);
  assert.deepEqual((await login.json()).account, account);
  assert.equal((await post('register', { ...credentials, email: 'DURABLE@example.test' })).status, 409);
  pilot = await peer(origin, cookie);
  assert.deepEqual(pilot.state().inventory, inventory);
  assert.equal(pilot.state().players.find(player => player.id === account.id).mode, 'walk');
  assert.equal((await running.stop()).code, 0, running.output());
  assert.doesNotMatch(running.output(), /FAILED|PrismaClient.*Error/);
  pilot = null;

  // A stopped cluster can be restored as a separate named instance without
  // changing account identity or touching the original database directory.
  await cp(join(data, 'star-agent/postgres/restart-test'), join(data, 'star-agent/postgres/restore-test'), { recursive: true, errorOnExist: true, force: false });
  running = runner({ ...env, DEV_DATABASE_URL: undefined, DEV_DATABASE_NAME: 'restore-test' }); await ready(running);
  const restored = await fetch(`${origin}/api/auth/session`, { headers: { Cookie: cookie } });
  assert.deepEqual((await restored.json()).account, account);
  pilot = await peer(origin, cookie);
  assert.deepEqual(pilot.state().inventory, inventory);
  assert.equal((await running.stop()).code, 0, running.output());
});

test('a configured unavailable database fails startup without an ephemeral fallback', { timeout: 20000 }, async t => {
  const port = await unusedPort(), apiPort = await unusedPort(), dbPort = await unusedPort();
  const running = runner({ DEV_PORT: String(port), DEV_API_PORT: String(apiPort),
    DEV_DATABASE_URL: `postgresql://127.0.0.1:${dbPort}/missing`, STAR_AGENT_MEMORY: '1' });
  t.after(() => running.stop());
  const result = await running.exited;
  assert.notEqual(result.code, 0);
  assert.match(running.output(), /SERVER_STARTUP_FAILED/);
  assert.doesNotMatch(running.output(), /Star Agent multiplayer listening/);
});
