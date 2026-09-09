import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { createServer } from '../server/index.js';
import { createMemoryStore } from '../server/database.js';

const ORIGIN = 'http://game.example';
const credentials = { email: 'pilot@example.com', callsign: 'Nova', password: 'a private test passphrase' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  const deadline = Date.now() + 3000;
  while (!fn()) { if (Date.now() > deadline) throw new Error('Timed out waiting for server result.'); await delay(10); }
}
function fakeRoom(options = {}) {
  const members = new Map(), received = [], left = [], revoked = [];
  let closed = 0;
  return {
    members, received, left, revoked, get closed() { return closed; },
    async join(account, send) {
      if (options.joinError) throw options.joinError;
      if (members.has(account.id)) throw Object.assign(new Error('Already connected.'), { code: 'ACCOUNT_CONNECTED' });
      if (members.size >= (options.maxPlayers ?? 10)) throw Object.assign(new Error('Full.'), { code: 'ROOM_FULL' });
      members.set(account.id, { account, send }); send({ type: 'welcome', account }); return account.id;
    },
    async receive(id, message) { if (options.receiveError) throw options.receiveError; received.push({ id, message }); },
    async leave(id) { left.push(id); members.delete(id); },
    async revoke(id) { revoked.push(id); members.delete(id); },
    async close() { closed++; members.clear(); },
  };
}
async function fixture(t, options = {}) {
  const room = options.room ?? fakeRoom(), store = options.store ?? createMemoryStore();
  const diagnostics = [], diagnosticDetails = [], mails = [];
  const app = await createServer({ store, room, publicOrigin: ORIGIN, logger: { error(code, details) {
    diagnostics.push(code); if (details !== undefined) diagnosticDetails.push(details);
  } },
    mail: { async sendPasswordReset(mail) { mails.push(mail); } }, ...options });
  const address = await app.listen();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(() => app.close());
  async function request(path, { method = 'GET', input, cookie, origin = ORIGIN, headers = {}, raw } = {}) {
    const response = await fetch(`${base}${path}`, { method, headers: {
      ...(origin === null ? {} : { origin }), ...(cookie ? { cookie } : {}),
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...headers,
    }, ...(method === 'POST' ? { body: raw ?? JSON.stringify(input ?? {}) } : {}) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function register(input = credentials) {
    const response = await request('/api/auth/register', { method: 'POST', input });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return { cookie: response.headers.get('set-cookie').split(';')[0], account: response.body.account };
  }
  function connect(cookie, { origin = ORIGIN, path = '/ws', ...wsOptions } = {}) {
    const ws = new WebSocket(`${base.replace('http:', 'ws:')}${path}`, { headers: {
      ...(origin === null ? {} : { origin }), ...(cookie ? { cookie } : {}),
    }, ...wsOptions });
    ws.messages = [];
    ws.on('message', data => ws.messages.push(JSON.parse(data.toString())));
    ws.on('error', () => {});
    return ws;
  }
  return { app, room, store, diagnostics, diagnosticDetails, mails, base, request, register, connect };
}

test('HTTP register/login/session/logout use cookies and return no account email or credential fields', async t => {
  const { request, register } = await fixture(t);
  const health = await request('/api/health', { origin: null });
  assert.deepEqual(health.body, { ok: true });
  const { cookie, account } = await register();
  assert.deepEqual(Object.keys(account).sort(), ['callsign', 'id']);
  const session = await request('/api/auth/session', { cookie });
  assert.deepEqual(session.body.account, account);
  assert.equal(session.headers.get('cache-control'), 'no-store');
  assert.equal(session.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(session.headers.get('access-control-allow-origin'), null);
  assert.equal((await request('/api/auth/logout', { method: 'POST', cookie })).status, 200);
  assert.equal((await request('/api/auth/session', { cookie })).body.account, null);
  const login = await request('/api/auth/login', { method: 'POST', input: credentials });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
});

test('all mutations require the exact configured Origin; CORS and unsupported methods are rejected', async t => {
  const { request } = await fixture(t);
  for (const origin of [null, 'null', 'http://evil.example', `${ORIGIN}.evil.example`, `${ORIGIN}/`]) {
    assert.equal((await request('/api/auth/register', { method: 'POST', input: credentials, origin })).status, 403);
  }
  assert.equal((await request('/api/auth/session', { origin: 'http://evil.example' })).status, 403);
  const preflight = await request('/api/auth/register', { method: 'OPTIONS', origin: 'http://evil.example' });
  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  const wrongMethod = await request('/api/auth/login');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'POST');
  assert.equal((await request('/api/missing')).status, 404);
});

test('HTTP rejects malformed JSON, nonobjects, wrong content type and oversized fixed/chunked bodies', async t => {
  const { request, base } = await fixture(t);
  for (const raw of ['{broken', 'null', '[]', '"text"']) {
    assert.equal((await request('/api/auth/register', { method: 'POST', raw })).status, 400);
  }
  assert.equal((await request('/api/auth/register', { method: 'POST', headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await request('/api/auth/register', { method: 'POST', headers: { 'content-encoding': 'gzip' } })).status, 415);
  assert.equal((await request('/api/auth/register', { method: 'POST', input: { data: 'x'.repeat(17 * 1024) } })).status, 413);
  const chunked = await new Promise((resolve, reject) => {
    const req = httpRequest(`${base}/api/auth/register`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'transfer-encoding': 'chunked' } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject); req.write('x'.repeat(10 * 1024)); req.end('x'.repeat(10 * 1024));
  });
  assert.equal(chunked, 413);
});

test('WebSocket upgrades require same origin, the /ws path and a valid session', async t => {
  const { connect, register } = await fixture(t);
  const { cookie } = await register();
  for (const [suppliedCookie, options, expected] of [
    [null, {}, 401], [cookie, { origin: null }, 403], [cookie, { origin: 'http://evil.example' }, 403],
    [cookie, { path: '/elsewhere' }, 404], ['star_session=invalid', {}, 401],
  ]) {
    const ws = connect(suppliedCookie, options);
    const [, response] = await once(ws, 'unexpected-response');
    assert.equal(response.statusCode, expected);
    response.resume(); ws.terminate();
  }
});

test('authenticated sockets relay JSON to the room and release membership on disconnect', async t => {
  const { connect, register, room } = await fixture(t);
  const { cookie, account } = await register();
  const ws = connect(cookie);
  await once(ws, 'open'); await until(() => ws.messages.length);
  assert.deepEqual(ws.messages[0], { type: 'welcome', account });
  ws.send(JSON.stringify({ type: 'input', sequence: 1 }));
  await until(() => room.received.length);
  assert.deepEqual(room.received[0], { id: account.id, message: { type: 'input', sequence: 1 } });
  const closed = once(ws, 'close'); ws.close(); await closed;
  await until(() => room.left.length);
  assert.equal(room.members.size, 0);
});

test('capacity and duplicate-account admission errors are explicit and release sockets', async t => {
  for (const [code, expectedClose] of [['ROOM_FULL', 1013], ['ACCOUNT_CONNECTED', 1008]]) {
    const room = fakeRoom({ joinError: Object.assign(new Error('private implementation detail'), { code }) });
    const { connect, register } = await fixture(t, { room });
    const { cookie } = await register();
    const ws = connect(cookie);
    const closed = once(ws, 'close');
    const [closeCode] = await closed;
    assert.equal(closeCode, expectedClose);
    assert.equal(ws.messages[0].code, code);
    assert.equal(JSON.stringify(ws.messages).includes('private'), false);
  }
});

test('WebSocket malformed, binary and oversized frames close with appropriate protocol codes', async t => {
  const { connect, register, room } = await fixture(t);
  const { cookie } = await register();
  for (const [payload, options, expected] of [['{broken', {}, 1007], ['[]', {}, 1007], [Buffer.from('binary'), {}, 1003], ['x'.repeat(17 * 1024), {}, 1009]]) {
    const ws = connect(cookie);
    await once(ws, 'open'); await until(() => ws.messages.length);
    const closed = once(ws, 'close'); ws.send(payload, options);
    assert.equal((await closed)[0], expected);
    await until(() => !room.members.size);
  }
});

test('message floods and async room failures close sockets without unhandled rejections', async t => {
  const { connect, register } = await fixture(t, { room: fakeRoom({ receiveError: new Error('private database detail') }) });
  const { cookie } = await register();
  const ws = connect(cookie);
  await once(ws, 'open'); await until(() => ws.messages.length);
  const closed = once(ws, 'close'); ws.send(JSON.stringify({ type: 'bad-command' }));
  const [code, reason] = await closed;
  assert.equal(code, 1008); assert.equal(reason.toString().includes('private'), false);
  const second = await fixture(t);
  const secondAccount = await second.register();
  const flood = second.connect(secondAccount.cookie);
  await once(flood, 'open'); await until(() => flood.messages.length);
  const floodClosed = once(flood, 'close');
  for (let i = 0; i < 150; i++) flood.send(JSON.stringify({ type: 'input', sequence: i }));
  assert.equal((await floodClosed)[0], 1008);
});

test('WebSocket diagnostics distinguish a message-rate burst from an async command backlog', async t => {
  const rate = await fixture(t);
  const rateAccount = await rate.register();
  const burst = rate.connect(rateAccount.cookie);
  await once(burst, 'open'); await until(() => burst.messages.length);
  // Drain each batch so the rate ceiling, rather than the pending queue, fires.
  for (let batch = 0; batch < 3; batch++) {
    for (let i = 0; i < 40; i++) burst.send(JSON.stringify({ type: 'input', sequence: batch * 40 + i }));
    await until(() => rate.room.received.length === (batch + 1) * 40);
  }
  const rateClosed = once(burst, 'close');
  burst.send(JSON.stringify({ type: 'input', sequence: 120 }));
  const [rateCode, rateReason] = await rateClosed;
  assert.equal(rateCode, 1008); assert.equal(rateReason.toString(), 'Too many messages.');
  assert.deepEqual(rate.diagnostics, ['WEBSOCKET_MESSAGE_RATE_LIMIT']);
  assert.equal(rate.diagnosticDetails[0].messages, 121);
  assert.ok(rate.diagnosticDetails[0].pending < 64);
  assert.equal(rate.diagnosticDetails[0].admitted, true);

  let release, started = false;
  const blocked = new Promise(resolve => { release = resolve; });
  const room = fakeRoom();
  room.receive = async () => { started = true; await blocked; };
  const pending = await fixture(t, { room });
  try {
    const pendingAccount = await pending.register();
    const backlog = pending.connect(pendingAccount.cookie);
    await once(backlog, 'open'); await until(() => backlog.messages.length);
    backlog.send(JSON.stringify({ type: 'input', sequence: 0 }));
    await until(() => started);
    const pendingClosed = once(backlog, 'close');
    for (let i = 1; i <= 64; i++) backlog.send(JSON.stringify({ type: 'input', sequence: i }));
    const [pendingCode, pendingReason] = await pendingClosed;
    assert.equal(pendingCode, 1008); assert.equal(pendingReason.toString(), 'Too many messages.');
    assert.deepEqual(pending.diagnostics, ['WEBSOCKET_PENDING_MESSAGE_LIMIT']);
    const details = pending.diagnosticDetails[0];
    assert.deepEqual(Object.keys(details).sort(), ['admitted', 'messages', 'pending', 'processingMs', 'windowMs']);
    assert.equal(details.pending, 64); assert.equal(details.messages, 65);
    assert.equal(details.admitted, true);
    assert.equal(typeof details.processingMs, 'number'); assert.ok(details.processingMs >= 0);
  } finally { release(); }
});

test('heartbeat rechecks session validity and terminates clients that do not answer pings', async t => {
  const { connect, register, store, room } = await fixture(t, { heartbeatIntervalMs: 50 });
  const { cookie } = await register();
  const ws = connect(cookie);
  await once(ws, 'open'); await until(() => ws.messages.length);
  const closed = once(ws, 'close');
  await store.deleteSession(createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
  assert.equal((await closed)[0], 1008);
  await until(() => room.members.size === 0);
  const second = await register({ ...credentials, email: 'second@example.com', callsign: 'Second' });
  const unresponsive = connect(second.cookie, { autoPong: false });
  const stopped = once(unresponsive, 'close');
  assert.equal((await stopped)[0], 1006);
});

test('logout closes its live session and password reset immediately revokes the account sockets', async t => {
  const { connect, register, request, mails, room } = await fixture(t);
  const { cookie } = await register();
  const ws = connect(cookie);
  await once(ws, 'open'); await until(() => ws.messages.length);
  const closed = once(ws, 'close');
  await request('/api/auth/logout', { method: 'POST', cookie });
  assert.equal((await closed)[0], 1008);
  await until(() => !room.members.size);
  const login = await request('/api/auth/login', { method: 'POST', input: credentials });
  const second = connect(login.headers.get('set-cookie').split(';')[0]);
  await once(second, 'open'); await until(() => second.messages.length);
  await request('/api/auth/forgot', { method: 'POST', input: { email: credentials.email } });
  await until(() => mails.length);
  const token = new URL(mails[0].url).searchParams.get('reset');
  const revoked = once(second, 'close');
  const reset = await request('/api/auth/reset', { method: 'POST', input: { token, password: 'new independent passphrase' } });
  assert.equal(reset.status, 200);
  assert.equal((await revoked)[0], 1008);
  assert.equal(room.revoked.length, 1);
});

test('SMTP absence preserves registration and uniform forgotten response with sanitized diagnostics', async t => {
  const { register, request, diagnostics } = await fixture(t, { mail: undefined });
  await register();
  const known = await request('/api/auth/forgot', { method: 'POST', input: { email: credentials.email } });
  const unknown = await request('/api/auth/forgot', { method: 'POST', input: { email: 'unknown@example.com' } });
  assert.equal(known.status, 200); assert.deepEqual(known.body, unknown.body);
  await until(() => diagnostics.length);
  assert.deepEqual(diagnostics, ['RESET_EMAIL_FAILED']);
});

test('shutdown awaits an in-flight room command before leave, closes resources once and is idempotent', async t => {
  let release, started = false;
  const events = [];
  const room = fakeRoom();
  room.receive = async () => { started = true; await new Promise(resolve => { release = resolve; }); events.push('receive'); };
  room.leave = async () => { events.push('leave'); };
  room.close = async () => { events.push('room'); };
  const store = createMemoryStore(); store.close = async () => { events.push('store'); };
  const { app, connect, register } = await fixture(t, { room, store, mail: { close() { events.push('mail'); } } });
  const { cookie } = await register();
  const ws = connect(cookie);
  await once(ws, 'open'); await until(() => ws.messages.length);
  ws.send(JSON.stringify({ type: 'input' })); await until(() => started);
  const closing = app.close();
  assert.equal(app.close(), closing);
  release(); await closing;
  assert.deepEqual(events, ['receive', 'leave', 'room', 'mail', 'store']);
});

test('CLI production cannot start with the explicit development memory flag', async () => {
  const child = spawn(process.execPath, ['server/index.js'], { cwd: new URL('..', import.meta.url),
    env: { PATH: process.env.PATH, NODE_ENV: 'production', STAR_AGENT_MEMORY: '1', PUBLIC_ORIGIN: 'https://game.example' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1); assert.match(output, /SERVER_STARTUP_FAILED/);
});

test('HTTP and upgrade rate limits bound requests before expensive authentication', async t => {
  const { request, connect } = await fixture(t);
  for (let i = 0; i < 180; i++) assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/health')).status, 429);
  for (let i = 0; i < 31; i++) {
    const ws = connect(null);
    const [, response] = await once(ws, 'unexpected-response');
    assert.equal(response.statusCode, i < 30 ? 401 : 429);
    response.resume(); ws.terminate();
  }
});

test('shutdown still releases SMTP and database resources after a room cleanup failure', async () => {
  const released = [];
  const room = fakeRoom(); room.close = async () => { throw new Error('private cleanup detail'); };
  const store = createMemoryStore(); store.close = async () => { released.push('store'); };
  const app = await createServer({ store, room, publicOrigin: ORIGIN, mail: { close() { released.push('mail'); } } });
  await app.listen();
  await assert.rejects(app.close(), /Server resource shutdown failed/);
  assert.deepEqual(released, ['mail', 'store']);
});
