import test from 'node:test';
import assert from 'node:assert/strict';
import { socialView } from '../src/multiplayer/social-state.js';
import { MultiplayerClient } from '../src/multiplayer/client.js';
test('friend presence uses actual admitted IDs and is cleared offline; blocked presence is absent', () => {
  const social = { relationships: [{ id: 'a', callsign: 'Nova', status: 'friend' }, { id: 'b', callsign: 'Orion', status: 'outgoing' }, { id: 'c', callsign: 'Vega', status: 'friend' }], blocked: [{ id: 'c', callsign: 'Vega' }] };
  const state = { connected: true, ownId: 'self', social, players: [{ id: 'self', callsign: 'Own' }, { id: 'a', callsign: 'Nova' }, { id: 'c', callsign: 'Vega' }, { id: 'd', callsign: 'Draco' }] };
  const view = socialView(state);
  assert.deepEqual(view.relationships.map(peer => [peer.id, peer.online]), [['a', true], ['b', false]]);
  assert.deepEqual(view.pilots.map(peer => peer.id), ['d', 'a']);
  assert.deepEqual(socialView({ ...state, connected: false }), { ready: false, relationships: [], blocked: [], pilots: [] });
});
test('client bounds live history, hides blocked history and keeps kick explanation while clearing stale presence', () => {
  const client = new MultiplayerClient();
  client._publish({ connected: true });
  for (let i = 0; i < 110; i++) client._message(JSON.stringify({ type: 'chat', id: String(i), channel: 'server', sender: { id: i === 109 ? 'blocked' : 'friend', callsign: 'Nova' }, text: `message ${i}` }));
  assert.equal(client.state.chat.length, 100);
  client._message(JSON.stringify({ type: 'social', relationships: [], blocked: [{ id: 'blocked', callsign: 'Vega' }] }));
  assert.equal(client.state.chat.length, 99); assert.equal(client.state.chat.some(chat => chat.sender.id === 'blocked'), false);
  client._message(JSON.stringify({ type: 'moderation', message: 'Removed from this session for severe hateful abuse.' }));
  assert.match(client.state.moderation, /Removed/);
  client.disconnect(); assert.deepEqual(client.state.chat, []); assert.equal(client.state.social, null);
});
test('social requests use unique IDs, server acknowledgements and cannot override request identity', async () => {
  const client = new MultiplayerClient(), messages = [];
  client.socket = { readyState: 1, send(raw) { messages.push(JSON.parse(raw)); } }; client._publish({ connected: true });
  const sent = client.sendChat('hello'); const message = messages.at(-1);
  assert.equal(message.type, 'social'); assert.equal(message.action, 'chat'); assert.equal(message.sender, undefined);
  client._message(JSON.stringify({ type: 'ack', requestId: message.requestId, ok: true })); await sent;
  const request = client.request('request', { targetId: 'other', action: 'evil', type: 'input', requestId: 'override' }, 'social');
  const friend = messages.at(-1); assert.equal(friend.action, 'request'); assert.equal(friend.type, 'social'); assert.notEqual(friend.requestId, 'override');
  client._message(JSON.stringify({ type: 'ack', requestId: friend.requestId, ok: true })); await request;
  assert.notEqual(message.requestId, friend.requestId);
  client.keyFire = true; client.pointerFire = true; client.suspendInput();
  assert.equal(client.keyFire, false); assert.equal(client.pointerFire, false); assert.equal(messages.at(-1).input.fire, false);
});
