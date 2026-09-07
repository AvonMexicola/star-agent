import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAuth, createAuthRateLimiter, SESSION_TTL_MS, RESET_TTL_MS } from '../server/auth.js';
import { createMemoryStore, createPostgresStore } from '../server/database.js';
import { createSMTPMailer } from '../server/mail.js';

const password = 'a long private passphrase';
const nextPassword = 'another entirely new passphrase';
const cookieOf = response => response.headers['set-cookie'].split(';')[0];
const tokenOf = message => new URL(message.url).searchParams.get('reset');
const digest = token => createHash('sha256').update(token).digest('hex');
const flushMail = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  const store = options.store ?? createMemoryStore();
  const messages = [], diagnostics = [], revoked = [];
  let clock = Date.UTC(2026, 8, 7);
  const auth = createAuth({ store, mail: { async sendPasswordReset(message) { messages.push(message); } },
    publicOrigin: 'https://game.example', now: () => clock, rateLimit: () => true,
    onMailError: event => diagnostics.push(event), onSessionsRevoked: id => revoked.push(id), ...options });
  return { auth, store, messages, diagnostics, revoked, advance: ms => { clock += ms; }, now: () => clock };
}
async function register(auth, overrides = {}) {
  return auth.register({ email: 'pilot@example.com', callsign: 'Nova_7', password, ...overrides }, { ip: '127.0.0.1' });
}

test('registration exposes callsign/id only, stores salted scrypt, issues a secure hashed session', async () => {
  const { auth, store } = fixture();
  const response = await register(auth, { realName: 'Never persist this' });
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(response.body.account).sort(), ['callsign', 'id']);
  assert.match(response.headers['set-cookie'], /; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
  const account = await store.findAccountByEmail('PILOT@EXAMPLE.COM');
  assert.match(account.passwordHash, /^scrypt:32768:8:3:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(account.realName, undefined);
  assert.equal(account.password, undefined);
  assert.equal(await store.findSession(cookieOf(response).split('=')[1], Date.now()), null);
  assert.deepEqual((await auth.session({ cookie: cookieOf(response) })).body.account, response.body.account);
  const second = await register(auth, { email: 'other@example.com', callsign: 'OtherPilot' });
  assert.equal(second.status, 201);
  assert.notEqual((await store.findAccountByEmail('other@example.com')).passwordHash, account.passwordHash);
});

test('case-insensitive email and callsign uniqueness survives simultaneous registration', async () => {
  const { auth } = fixture();
  const results = await Promise.all([
    register(auth, { email: 'Pilot@Example.com', callsign: 'Alpha' }),
    register(auth, { email: 'pilot@example.COM', callsign: 'Beta' }),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const winner = results.find(r => r.status === 201);
  const duplicate = await register(auth, { email: 'different@example.com', callsign: winner.body.account.callsign.toLowerCase() });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, results.find(r => r.status === 409).body.error);
});

test('password and callsign boundaries reject invalid registration without storing accounts', async () => {
  const { auth, store } = fixture();
  for (const input of [{ password: 'short' }, { password: 'x'.repeat(129) }, { password: null },
    { callsign: 'ab' }, { callsign: 'Real Name' }, { callsign: '<script>' }, { email: 'invalid' }, { email: 'a\r\n@example.com' }]) {
    assert.equal((await register(auth, input)).status, 400);
  }
  assert.equal(await store.findAccountByEmail('pilot@example.com'), null);
  assert.equal((await register(auth, { password: '🌠'.repeat(12) })).status, 201);
});

test('malformed top-level JSON inputs fail without throwing or enumerating accounts', async () => {
  const { auth } = fixture();
  for (const input of [null, [], 'text', 42, false]) {
    assert.equal((await auth.register(input)).status, 400);
    assert.equal((await auth.login(input)).status, 401);
    assert.equal((await auth.forgot(input)).status, 200);
    assert.equal((await auth.reset(input)).status, 400);
  }
});

test('login is case insensitive and unknown/wrong credentials have identical public errors', async () => {
  const { auth } = fixture();
  await register(auth);
  const wrong = await auth.login({ email: 'pilot@example.com', password: nextPassword });
  const unknown = await auth.login({ email: 'unknown@example.com', password: nextPassword });
  assert.deepEqual(wrong, unknown);
  assert.equal(wrong.status, 401);
  const login = await auth.login({ email: ' PILOT@EXAMPLE.COM ', password });
  assert.equal(login.status, 200);
  assert.equal((await auth.authenticate({ cookie: cookieOf(login) })).callsign, 'Nova_7');
});

test('logout removes only the presented session; sessions expire and malformed/ambiguous cookies fail closed', async () => {
  const { auth, advance } = fixture();
  const first = await register(auth);
  const second = await auth.login({ email: 'pilot@example.com', password });
  const logout = await auth.logout({ cookie: cookieOf(first) });
  assert.match(logout.headers['set-cookie'], /Max-Age=0; Secure$/);
  assert.equal(await auth.authenticate({ cookie: cookieOf(first) }), null);
  assert.ok(await auth.authenticate({ cookie: cookieOf(second) }));
  assert.equal(await auth.authenticate({ cookie: `${cookieOf(second)}; ${cookieOf(second)}` }), null);
  assert.equal(await auth.authenticate({ cookie: 'star_session=bad%encoding' }), null);
  assert.equal(await auth.authenticate({ cookie: 'x'.repeat(9000) }), null);
  advance(SESSION_TTL_MS);
  assert.equal(await auth.authenticate({ cookie: cookieOf(second) }), null);
});

test('forgotten password never enumerates accounts or waits for email delivery', async () => {
  let beginSending;
  const sent = new Promise(resolve => { beginSending = resolve; });
  const { auth } = fixture({ mail: { sendPasswordReset() { beginSending(); return new Promise(() => {}); } } });
  await register(auth);
  const known = await auth.forgot({ email: 'PILOT@EXAMPLE.COM' });
  const unknown = await auth.forgot({ email: 'missing@example.com' });
  const invalid = await auth.forgot({ email: 'not an email' });
  assert.deepEqual(known, unknown);
  assert.deepEqual(known, invalid);
  assert.equal(known.status, 200);
  assert.equal(JSON.stringify(known).includes('token'), false);
  await sent;
});

test('SMTP failures return the same response and only sanitized diagnostics', async () => {
  const { auth, diagnostics } = fixture({ mail: { async sendPasswordReset() { throw new Error('private SMTP password + reset token'); } } });
  await register(auth);
  const known = await auth.forgot({ email: 'pilot@example.com' });
  const unknown = await auth.forgot({ email: 'missing@example.com' });
  await flushMail();
  assert.deepEqual(known, unknown);
  assert.deepEqual(diagnostics, [{ code: 'RESET_EMAIL_FAILED' }]);
});

test('reset token is hashed, single use, revokes all sessions and replaces password', async () => {
  const { auth, store, messages, revoked, now } = fixture();
  const first = await register(auth);
  const second = await auth.login({ email: 'pilot@example.com', password });
  await auth.forgot({ email: 'pilot@example.com' });
  await flushMail();
  assert.equal(messages.length, 1);
  const token = tokenOf(messages[0]);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(messages[0].expiresAt, now() + RESET_TTL_MS);
  assert.equal(await store.resetPassword({ tokenHash: token, passwordHash: 'wrong', now: now() }), null);
  const reset = await auth.reset({ token, password: nextPassword });
  assert.equal(reset.status, 200);
  assert.match(reset.headers['set-cookie'], /Max-Age=0/);
  assert.deepEqual(revoked, [first.body.account.id]);
  for (const response of [first, second]) assert.equal(await auth.authenticate({ cookie: cookieOf(response) }), null);
  assert.equal((await auth.reset({ token, password })).status, 400);
  assert.equal((await auth.login({ email: 'pilot@example.com', password })).status, 401);
  assert.equal((await auth.login({ email: 'pilot@example.com', password: nextPassword })).status, 200);
});

test('issuing another reset replaces the old link; expiry is exclusive at its deadline', async () => {
  const { auth, messages, advance } = fixture();
  await register(auth);
  await auth.forgot({ email: 'pilot@example.com' });
  await flushMail();
  await auth.forgot({ email: 'pilot@example.com' });
  await flushMail();
  assert.equal((await auth.reset({ token: tokenOf(messages[0]), password: nextPassword })).status, 400);
  advance(RESET_TTL_MS);
  assert.equal((await auth.reset({ token: tokenOf(messages[1]), password: nextPassword })).status, 400);
});

test('concurrent reset consumption succeeds once and prevents sessions using a stale credential', async () => {
  const { auth, store, messages, now } = fixture();
  const registered = await register(auth);
  const old = await store.findAccountByEmail('pilot@example.com');
  await auth.forgot({ email: 'pilot@example.com' });
  await flushMail();
  const token = tokenOf(messages[0]);
  const results = await Promise.all([auth.reset({ token, password: nextPassword }), auth.reset({ token, password: 'third alternative passphrase' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal(await store.createSession({ accountId: registered.body.account.id, passwordHash: old.passwordHash,
    tokenHash: digest('stale session'), expiresAt: now() + SESSION_TTL_MS }), false);
});

test('rate limits apply per IP and normalized identity and forgot remains uniform when throttled', async () => {
  const attempts = [];
  const { auth } = fixture({ rateLimit: input => { attempts.push(input); return false; } });
  assert.equal((await register(auth)).status, 429);
  assert.equal((await auth.login({ email: 'Pilot@Example.com', password }, { ip: 'test' })).status, 429);
  assert.equal((await auth.forgot({ email: 'pilot@example.com' }, { ip: 'test' })).status, 200);
  assert.equal((await auth.reset({ token: 'x'.repeat(43), password })).status, 429);
  assert.equal(attempts[1].identity, attempts[2].identity);
  assert.equal(attempts[1].identity.includes('example'), false);
  const limit = createAuthRateLimiter();
  for (let i = 0; i < 3; i++) assert.equal(limit({ action: 'forgot', ip: `ip${i}`, identity: 'same', now: 0 }), true);
  assert.equal(limit({ action: 'forgot', ip: 'new-ip', identity: 'same', now: 0 }), false);
  assert.equal(limit({ action: 'forgot', ip: 'new-ip', identity: 'same', now: 15 * 60 * 1000 }), true);
});

test('player state is copied and bounded; production refuses implicit or ephemeral storage', async () => {
  const { auth, store } = fixture();
  const account = (await register(auth)).body.account;
  const state = { credits: 7, inventory: { ore: 3 } };
  await store.savePlayerState(account.id, state);
  state.inventory.ore = 999;
  const loaded = await store.loadPlayerState(account.id);
  assert.equal(loaded.inventory.ore, 3);
  loaded.credits = 999;
  assert.equal((await store.loadPlayerState(account.id)).credits, 7);
  await assert.rejects(store.savePlayerState(account.id, []), /must be an object/);
  await assert.rejects(store.savePlayerState(account.id, { large: 'x'.repeat(1024 * 1024) }), /exceeds/);
  await assert.rejects(createPostgresStore(), /DATABASE_URL/);
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(() => fixture(), /PostgreSQL persistence/);
    assert.throws(() => fixture({ store: { persistent: true }, secureCookies: false }), /secure cookies/);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test('SMTP adapter produces a plain email without real-name fields; construction never sends', async () => {
  const sent = [];
  const mail = await createSMTPMailer({ env: { SMTP_FROM: 'Star Agent <no-reply@example.com>' },
    transport: { async sendMail(message) { sent.push(message); }, async verify() { return true; } } });
  assert.equal(sent.length, 0);
  await mail.sendPasswordReset({ email: 'pilot@example.com', callsign: 'Nova', url: 'https://game.example/?reset=test' });
  assert.equal(sent[0].to, 'pilot@example.com');
  assert.match(sent[0].text, /https:\/\/game.example\/\?reset=test/);
  assert.equal(sent[0].html, undefined);
  assert.equal(sent[0].disableFileAccess, true);
  assert.equal(await mail.verify(), true);
  await assert.rejects(createSMTPMailer({ env: {} }), /SMTP_HOST/);
});

test('PostgreSQL migrations, uniqueness races, reset locking and durable state', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  // Explicitly supplied TEST_DATABASE_URL only. Never select DATABASE_URL or touch its default schema.
  const { default: pg } = await import('pg');
  const schema = `auth_test_${process.pid}_${Date.now()}`;
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  let pool;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    const store = await createPostgresStore({ pool });
    await Promise.all([store.migrate(), store.migrate()]);
    const { auth, messages, now } = fixture({ store });
    const registrations = await Promise.all([register(auth, { email: 'PILOT@example.com', callsign: 'First' }), register(auth, { callsign: 'Second' })]);
    assert.deepEqual(registrations.map(r => r.status).sort(), [201, 409]);
    const registered = registrations.find(r => r.status === 201);
    const account = await store.findAccountByEmail('pilot@example.com');
    await assert.rejects(store.createAccount({ email: 'other@example.com', callsign: account.callsign.toLowerCase(), passwordHash: account.passwordHash }), { code: 'ACCOUNT_CONFLICT' });
    await store.savePlayerState(account.id, { inventory: { ore: 8 }, credits: 17 });
    const reopened = await createPostgresStore({ pool });
    await reopened.migrate();
    assert.deepEqual(await reopened.loadPlayerState(account.id), { inventory: { ore: 8 }, credits: 17 });
    assert.equal((await reopened.findSession(digest(cookieOf(registered).split('=')[1]), now())).id, account.id);
    await auth.forgot({ email: account.email });
    await flushMail();
    const tokenHash = digest(tokenOf(messages[0]));
    const resets = await Promise.all([
      store.resetPassword({ tokenHash, passwordHash: 'replacement-1', now: now() }),
      reopened.resetPassword({ tokenHash, passwordHash: 'replacement-2', now: now() }),
    ]);
    assert.equal(resets.filter(Boolean).length, 1);
    assert.equal(await auth.authenticate({ cookie: cookieOf(registered) }), null);
    assert.equal(await store.createSession({ accountId: account.id, passwordHash: account.passwordHash, tokenHash: digest('stale'), expiresAt: now() + SESSION_TTL_MS }), false);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM password_resets')).rows[0].count, 0);
    await store.pruneExpired(now());
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
