import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { createServer } from '../server/index.js';
import { createMemoryStore } from '../server/database.js';
import { createWorld } from '../server/world.js';
import { createRoom } from '../server/room.js';
import { socialView } from '../src/multiplayer/social-state.js';
const origin = 'http://social.example.test';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(read) { for (let i = 0; i < 200; i++) { const value = read(); if (value) return value; await delay(10); } throw new Error('Timed out waiting for isolated social state.'); }
function fakeRoom() {
  const members = new Map(), commands = [];
  return { members, commands, async join(account, send) { members.set(account.id, { account, send }); send({ type: 'welcome', id: account.id }); return account.id; },
    async receive(id, message) { commands.push(message); members.get(id).send({ type: 'ack', requestId: message.requestId, ok: true }); },
    async leave(id) { members.delete(id); }, async close() { members.clear(); } };
}
async function fixture(t, { store = createMemoryStore(), room = fakeRoom() } = {}) {
  const errors = [], sockets = [];
  const app = await createServer({ store, room, publicOrigin: origin, logger: { error: code => errors.push(code) } });
  const address = await app.listen(0), base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { for (const socket of sockets) socket.terminate(); await app.close(); });
  async function register(callsign) {
    const response = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { Origin: origin, 'content-type': 'application/json' }, body: JSON.stringify({ callsign, email: `${callsign}@example.test`, password: 'isolated social password' }) });
    assert.equal(response.status, 201);
    return { ...(await response.json()).account, cookie: response.headers.get('set-cookie').split(';')[0] };
  }
  function connect(account, onMessage) {
    const socket = new WebSocket(`${base.replace('http:', 'ws:')}/ws`, { headers: { Origin: origin, ...(account?.cookie ? { Cookie: account.cookie } : {}) } });
    sockets.push(socket); const messages = [];
    socket.on('message', data => { const message = JSON.parse(data); messages.push(message); onMessage?.(message, socket); }); socket.on('error', () => {});
    return { socket, messages, send(action, fields = {}, requestId = `${messages.length}-${Date.now()}`) { socket.send(JSON.stringify({ type: 'social', action, requestId, ...fields })); return until(() => messages.find(message => message.type === 'ack' && message.requestId === requestId)); } };
  }
  return { app, store, room, errors, register, connect };
}
test('commands sent immediately after welcome wait for slow social admission and are acknowledged', async t => {
  const store = createMemoryStore(), original = store.socialList;
  let release; const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  store.socialList = async id => { await gate; return original(id); };
  const f = await fixture(t, { store }), account = await f.register('Nova');
  const peer = f.connect(account, (message, socket) => {
    if (message.type === 'welcome') {
      socket.send(JSON.stringify({ type: 'social', action: 'chat', text: 'early hello', requestId: 'early-chat' }));
      socket.send(JSON.stringify({ type: 'request', action: 'hangar', requestId: 'early-hangar' }));
    }
  });
  await until(() => peer.messages.find(message => message.type === 'welcome'));
  await delay(30); assert.equal(f.room.commands.length, 0); release();
  await until(() => peer.messages.filter(message => message.type === 'ack').length === 2);
  assert.equal(peer.messages.find(message => message.type === 'chat').text, 'early hello');
  assert.equal(f.room.commands[0].action, 'hangar'); assert.deepEqual(f.errors, []);
});
test('closing during delayed admission releases room and social membership without replay', async t => {
  const store = createMemoryStore(), original = store.socialList;
  let release; const gate = new Promise(resolve => { release = resolve; });
  t.after(() => release());
  store.socialList = async id => { await gate; return original(id); };
  const f = await fixture(t, { store }), account = await f.register('Nova');
  const peer = f.connect(account);
  await until(() => peer.messages.find(message => message.type === 'welcome'));
  peer.socket.send(JSON.stringify({ type: 'social', action: 'chat', text: 'cancelled early chat', requestId: 'cancel' }));
  const closed = once(peer.socket, 'close'); peer.socket.close(); await closed; release();
  await until(() => f.room.members.size === 0);
  const next = f.connect(account); await until(() => next.messages.find(message => message.type === 'social'));
  assert.equal(next.messages.some(message => message.type === 'chat'), false);
  assert.equal((await next.send('chat', { text: 'fresh connection' })).ok, true); assert.deepEqual(f.errors, []);
});
test('real authenticated room IDs drive friendship, presence, kicks, reconnect and preserved inventory', async t => {
  const store = createMemoryStore(), world = await createWorld(), simulationErrors = [];
  const room = createRoom({ store, world, onError: error => simulationErrors.push(error.message) });
  const f = await fixture(t, { store, room }), a = await f.register('Nova'), b = await f.register('Orion');
  const unauthenticated = f.connect(null); const [, response] = await once(unauthenticated.socket, 'unexpected-response'); assert.equal(response.statusCode, 401); response.resume(); unauthenticated.socket.terminate();
  const first = f.connect(a), second = f.connect(b);
  await until(() => first.messages.findLast(message => message.type === 'state')?.players.length === 2);
  await until(() => second.messages.find(message => message.type === 'social'));
  await first.send('request', { targetId: b.id, sender: { id: b.id } });
  await second.send('accept', { targetId: a.id });
  assert.equal(await store.areFriends(a.id, b.id), true);
  const social = () => first.messages.findLast(message => message.type === 'social');
  const roster = () => first.messages.findLast(message => message.type === 'state').players;
  assert.equal(socialView({ connected: true, ownId: a.id, social: social(), players: roster() }).relationships[0].online, true);
  assert.equal(social().relationships[0].id, roster().find(peer => peer.callsign === 'Orion').id);
  const inventory = second.messages.findLast(message => message.type === 'state')?.inventory ?? second.messages.find(message => message.type === 'welcome').inventory;
  const closed = once(second.socket, 'close');
  await second.send('chat', { text: 'sieg heil', sender: { id: a.id, callsign: 'Nova' } });
  assert.equal((await closed)[0], 4003);
  await until(() => roster().length === 1);
  assert.equal(socialView({ connected: true, ownId: a.id, social: social(), players: roster() }).relationships[0].online, false);
  assert.equal(first.messages.some(message => message.type === 'chat'), false);
  const rejoined = f.connect(b); await until(() => rejoined.messages.find(message => message.type === 'social'));
  assert.deepEqual(rejoined.messages.find(message => message.type === 'welcome').inventory, inventory);
  assert.equal((await rejoined.send('chat', { text: 'hell, shit, fuck; my friends are Jewish and gay' })).ok, true);
  await until(() => first.messages.some(message => message.type === 'chat'));
  assert.equal(first.messages.find(message => message.type === 'chat').sender.id, b.id);
  assert.equal(JSON.stringify(first.messages.filter(message => ['chat', 'social'].includes(message.type))).includes('@example'), false);
  assert.deepEqual(f.errors, []); assert.deepEqual(simulationErrors, []);
});
