import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMemoryStore, createPostgresStore } from '../server/database.js';
import { createSocialService } from '../server/social.js';
import { moderateChat, createChatModerator, CHAT_POLICY } from '../server/chat-moderation.js';

test('chat permits ordinary profanity, neutral identities, history and unrelated substrings', () => {
  for (const text of ['hell, shit, fuck', 'I am Jewish. Jews, Christians and Muslims are welcome.', 'My friends are gay.',
    'We studied Nazi history. Nazis were evil.', 'Jews fought against Hitler.', 'The night geranium blooms.', 'Scunthorpe has a port.',
    'Hello 🚀', '<img src=x onerror=alert(1)>', 'Callsign NightRigger', 'the sniper fired', 'White power cable connected.']) {
    assert.equal(moderateChat(text).allowed, true, text);
  }
});

test('explicit severe slurs, hateful violence and promotion are blocked with a kick', () => {
  for (const text of ['you nigger', 'faggot', 'you kike', 'gas the jews', 'heil hitler', 'sieg heil', 'white power',
    'N1GG3R', 'n.i.g.g.e.r', 'n i g g e r', 'nig\u200bger', 'ｎｉｇｇｅｒ', 'nіggеr', 'you F4GG0T', 'faggot!', 'Heil Hitler!', 'n!gger', 'nìggér']) {
    const result = moderateChat(text); assert.equal(result.allowed, false, text); assert.equal(result.kick, true, text);
    assert.doesNotMatch(result.reason, /nigger|faggot|kike/i);
  }
});

test('clear quotations and reports are withheld without a kick, not used as a broadcast bypass', () => {
  for (const text of ['Someone called me "nigger".', 'I reported the slur nigger.', 'The slogan "heil hitler" is hateful.',
    'Heil Hitler is wrong.', 'I condemn white power.']) {
    assert.equal(moderateChat(text).allowed, false, text); assert.equal(moderateChat(text).kick, false, text);
  }
  assert.equal(moderateChat('"nigger". Meanwhile, you faggot.').kick, true);
});

test('moderation processing and explicit configuration are bounded', () => {
  for (const text of [null, {}, [], 99, '', ' \u200b ', '\ud800', 'x'.repeat(401), '😀'.repeat(401)]) assert.equal(moderateChat(text).allowed, false);
  assert.equal(moderateChat('😀'.repeat(400)).allowed, true);
  assert.equal(moderateChat('hello\nworld\u202e').text, 'hello world');
  assert.throws(() => createChatModerator({ ...CHAT_POLICY, severeSlurs: ['(.+)+'] }), /Policy rules/);
  assert.throws(() => createChatModerator({ ...CHAT_POLICY, severeSlurs: Array(65).fill('abc') }), /Invalid/);
});

async function accounts(store) {
  const result = [];
  for (const callsign of ['Nova', 'Orion', 'Vega']) result.push(await store.createAccount({ email: `${callsign}@example.test`, callsign, passwordHash: 'isolated-fixture' }));
  return result;
}
async function friendContract(store) {
  const [a, b, c] = await accounts(store);
  assert.equal(await store.areFriends(a.id, a.id), false);
  assert.equal(await store.areFriends(a.id, b.id), false);
  await store.socialChange(a.id, b.id, 'request');
  assert.equal(await store.areFriends(a.id, b.id), false);
  assert.equal(await store.socialChange(a.id, b.id, 'accept'), false);
  await store.socialChange(b.id, a.id, 'request');
  assert.equal(await store.areFriends(a.id, b.id), false);
  assert.deepEqual((await store.socialList(a.id)).relationships, [{ id: b.id, callsign: b.callsign, status: 'outgoing' }]);
  assert.deepEqual((await store.socialList(c.id)).relationships, []);
  await store.socialChange(b.id, a.id, 'decline');
  assert.deepEqual((await store.socialList(a.id)).relationships, []);
  await store.socialChange(a.id, b.id, 'request'); await store.socialChange(b.id, a.id, 'accept');
  assert.equal(await store.areFriends(a.id, b.id), true); assert.equal(await store.areFriends(b.id, a.id), true);
  await store.savePlayerState(a.id, { inventory: { ore: 7 } });
  await store.socialChange(b.id, a.id, 'block');
  assert.equal(await store.areFriends(a.id, b.id), false);
  assert.equal(await store.socialChange(a.id, b.id, 'request'), false);
  assert.deepEqual(await store.socialList(a.id), { relationships: [], blocked: [] });
  assert.deepEqual(await store.socialList(b.id), { relationships: [], blocked: [{ id: a.id, callsign: a.callsign }] });
  await store.socialChange(a.id, b.id, 'unblock'); // cannot undo the other account's block
  assert.equal(await store.socialChange(a.id, b.id, 'request'), false);
  await store.socialChange(b.id, a.id, 'unblock');
  assert.equal(await store.areFriends(a.id, b.id), false);
  await store.socialChange(a.id, b.id, 'request'); await store.socialChange(b.id, a.id, 'accept');
  await store.socialChange(a.id, b.id, 'remove');
  assert.equal(await store.areFriends(a.id, b.id), false);
  assert.deepEqual(await store.loadPlayerState(a.id), { inventory: { ore: 7 } });
  return [a, b, c];
}
test('memory friend lifecycle requires explicit mutual consent and blocks remove friendship without touching inventory', async () => friendContract(createMemoryStore()));

async function fixture(store = createMemoryStore()) {
  const users = await accounts(store), received = users.map(() => []), kicked = [], errors = [];
  let time = 100_000;
  const service = createSocialService({ store, now: () => time, onError: error => errors.push(error) });
  const peers = [];
  const join = async i => {
    const peer = await service.join(users[i], m => received[i].push(structuredClone(m)), (...args) => kicked.push({ i, args }));
    peers[i] = peer; return peer;
  };
  for (let i = 0; i < users.length; i++) await join(i);
  const send = (i, action, fields = {}, requestId = randomUUID()) => service.receive(peers[i], { type: 'social', requestId, action, ...fields });
  return { users, received, kicked, errors, service, store, send, peers, join, advance(ms) { time += ms; } };
}
const chats = messages => messages.filter(m => m.type === 'chat');
test('live chat derives sender/time from authenticated admission and retry does not rebroadcast', async () => {
  const f = await fixture();
  await f.send(0, 'chat', { text: 'hello', sender: f.users[1], sentAt: 0 }, 'same');
  await f.send(0, 'chat', { text: 'hello' }, 'same');
  for (const messages of f.received) {
    assert.equal(chats(messages).length, 1);
    assert.deepEqual(chats(messages)[0].sender, { id: f.users[0].id, callsign: 'Nova' });
    assert.equal(chats(messages)[0].sentAt, 100_000);
    assert.equal(JSON.stringify(chats(messages)).includes('@example'), false);
  }
  await f.send(0, 'chat', { text: 'different' }, 'same');
  assert.equal(f.received[0].at(-1).ok, false);
  await f.service.close();
});

test('blocked messages never reach the room; severe abuse kicks and invalidates queued sender work', async () => {
  const f = await fixture();
  await f.store.savePlayerState(f.users[0].id, { inventory: { ore: 4 } });
  await f.send(0, 'chat', { text: 'heil hitler' });
  await f.send(0, 'chat', { text: 'stale input' });
  assert.equal(f.received.flatMap(chats).length, 0);
  assert.deepEqual(f.kicked, [{ i: 0, args: [4003, 'Removed from this session for severe hateful abuse.'] }]);
  assert.equal(f.received[1].some(m => m.type === 'moderation'), false);
  assert.deepEqual(await f.store.loadPlayerState(f.users[0].id), { inventory: { ore: 4 } });
  await f.join(0); // session kick is not a permanent account ban
  await f.send(0, 'chat', { text: 'hello again' });
  assert.equal(chats(f.received[1]).length, 1);
  await f.service.close();
});

test('rate budgets persist across reconnect and block suppresses delivery in both directions', async () => {
  const f = await fixture();
  for (let i = 0; i < 5; i++) await f.send(0, 'chat', { text: `hello ${i}` });
  assert.equal(chats(f.received[1]).length, 4);
  f.service.leave(f.peers[0]); await f.join(0);
  await f.send(0, 'chat', { text: 'rejoin flood' });
  assert.equal(f.received[0].at(-1).ok, false);
  f.advance(2000); await f.send(0, 'chat', { text: 'refilled' });
  assert.equal(chats(f.received[1]).length, 5);
  await f.send(1, 'block', { targetId: f.users[0].id });
  f.advance(2000); await f.send(0, 'chat', { text: 'hidden from blocker' });
  await f.send(1, 'chat', { text: 'hidden from blocked' });
  assert.equal(chats(f.received[1]).length, 6); // own message only
  assert.equal(chats(f.received[0]).at(-1).text, 'hidden from blocker');
  assert.equal(chats(f.received[2]).length, 7);
  await f.service.close();
});

test('friend requests have no account search, reverse-block leak or offline lookup', async () => {
  const f = await fixture();
  await f.send(0, 'request', { targetId: randomUUID() }); const unknown = f.received[0].at(-1);
  f.service.leave(f.peers[1]);
  await f.send(0, 'request', { targetId: f.users[1].id }); const offline = f.received[0].at(-1);
  await f.join(1); await f.send(1, 'block', { targetId: f.users[0].id });
  await f.send(0, 'request', { targetId: f.users[1].id }); const blocked = f.received[0].at(-1);
  for (const value of [offline, blocked]) assert.deepEqual({ ...value, requestId: null }, { ...unknown, requestId: null });
  assert.deepEqual(f.received[0].findLast(m => m.type === 'social').blocked, []);
  assert.equal(JSON.stringify(f.received).includes('@example'), false);
  for (let i = 0; i < 21; i++) await f.send(2, 'refresh');
  assert.equal(f.received[2].at(-1).ok, false);
  await f.service.close();
});

test('an indeterminate storage result closes delivery caches instead of allowing blocked chat', async () => {
  const f = await fixture();
  f.store.socialChange = async () => { throw new Error('private database detail'); };
  await f.send(0, 'block', { targetId: f.users[1].id });
  assert.deepEqual(f.errors, ['SOCIAL_STORAGE_FAILED']); assert.equal(f.kicked.length, 3);
  await f.send(0, 'chat', { text: 'do not send after storage failure' });
  assert.equal(f.received.flatMap(chats).length, 0);
  assert.equal(JSON.stringify(f.received).includes('private'), false);
  await f.service.close();
});

test('PostgreSQL social migration, lifecycle, cross-store races, rollback and reconnect persistence', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const { default: pg } = await import('pg');
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `social_test_${process.pid}_${Date.now()}`;
  let pool, first, second;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    first = await createPostgresStore({ pool }); second = await createPostgresStore({ pool });
    await Promise.all([first.migrate(), second.migrate()]);
    const [a, b, c] = await friendContract(first);
    await Promise.all([first.socialChange(a.id, b.id, 'request'), second.socialChange(b.id, a.id, 'request')]);
    assert.equal((await first.socialList(a.id)).relationships.length, 1);
    const requester = (await first.socialList(a.id)).relationships[0].status === 'outgoing' ? a : b;
    const recipient = requester === a ? b : a;
    await Promise.all([first.socialChange(recipient.id, requester.id, 'accept'), second.socialChange(requester.id, recipient.id, 'block')]);
    assert.equal(await first.areFriends(a.id, b.id), false);
    assert.equal(await second.areFriends(a.id, b.id), false);
    await first.socialChange(requester.id, recipient.id, 'unblock');
    await first.socialChange(a.id, b.id, 'request'); await second.socialChange(b.id, a.id, 'accept');
    await first.close(); first = await createPostgresStore({ pool }); await first.migrate();
    assert.equal(await first.areFriends(a.id, b.id), true);
    assert.deepEqual((await first.socialList(a.id)).relationships, [{ id: b.id, callsign: b.callsign, status: 'friend' }]);
    await pool.query(`CREATE FUNCTION reject_social_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated rollback fixture'; END $$`);
    await pool.query('CREATE TRIGGER reject_social_delete BEFORE DELETE ON friendships FOR EACH ROW EXECUTE FUNCTION reject_social_delete()');
    await assert.rejects(first.socialChange(a.id, b.id, 'block'));
    assert.equal(await first.areFriends(a.id, b.id), true); assert.deepEqual((await first.socialList(a.id)).blocked, []);
    await pool.query('DROP TRIGGER reject_social_delete ON friendships');
    await assert.rejects(pool.query('INSERT INTO friendships(account_low,account_high,requested_by,status) VALUES($1,$2,$3,$4)', [a.id, a.id, c.id, 'accepted']));
  } finally {
    await first?.close(); await second?.close(); await pool?.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end();
  }
});
