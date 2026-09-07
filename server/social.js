import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { moderateChat } from './chat-moderation.js';
import { validSocialAction } from './social-store.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ACTION_REPLY = 'Friend request handled. Requests arrive only when the pilot is available.';

/** One service per authenticated ten-player room. No history, offline messages or
 * account search. Identity comes only from the admitted socket's private handle. */
export function createSocialService({ store, now = Date.now, moderate = moderateChat, onError = () => {} }) {
  const members = new Map(), budgets = new Map();
  let chain = Promise.resolve(), closed = false;
  const run = operation => {
    const task = chain.then(operation); chain = task.catch(() => {}); return task;
  };
  const current = peer => !closed && peer && members.get(peer.account.id) === peer;
  function budget(id) {
    const time = now();
    for (const [key, item] of budgets) if (time - item.touched >= 10 * 60_000) budgets.delete(key);
    let item = budgets.get(id);
    if (!item) {
      if (budgets.size >= 2048) return null;
      item = { tokens: 4, touched: time, updated: time, socialStart: time, social: 0, seen: new Map() }; budgets.set(id, item);
    }
    item.tokens = Math.min(4, item.tokens + Math.max(0, time - item.updated) / 2000); item.updated = time; item.touched = time;
    if (time - item.socialStart >= 60_000) { item.socialStart = time; item.social = 0; }
    return item;
  }
  async function refresh(peer) {
    if (!current(peer)) return;
    const data = await store.socialList(peer.account.id);
    if (!current(peer)) return;
    peer.data = data;
    peer.blocks = new Set(data.blocked.map(account => account.id));
    peer.send({ type: 'social', ...data });
  }
  async function refreshPair(a, b) {
    for (const id of [a, b]) if (members.has(id)) await refresh(members.get(id));
  }
  return {
    join(account, send, kick) {
      return run(async () => {
        if (closed || members.has(account.id)) throw new Error('Social admission unavailable.');
        const peer = { account: { id: account.id, callsign: account.callsign }, send, kick, blocks: new Set(), data: null };
        members.set(account.id, peer);
        try { await refresh(peer); return peer; }
        catch (error) { members.delete(account.id); throw error; }
      });
    },
    leave(peer) { if (current(peer)) members.delete(peer.account.id); },
    receive(peer, message) {
      return run(async () => {
        if (!current(peer)) return;
        const requestId = message.requestId;
        if (typeof requestId !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(requestId)) throw new Error('Invalid social request.');
        const reply = fields => peer.send({ type: 'ack', requestId, ...fields });
        const limits = budget(peer.account.id);
        if (!limits) { reply({ ok: false, error: 'Comms is busy. Try again shortly.' }); return; }
        const fingerprint = createHash('sha256').update(JSON.stringify([message.action, message.text, message.targetId])).digest('hex');
        const previous = limits.seen.get(requestId);
        if (previous) { reply(previous.fingerprint === fingerprint ? previous.result : { ok: false, error: 'Use a new request identifier.' }); return; }
        const finish = result => {
          if (limits.seen.size >= 64) limits.seen.delete(limits.seen.keys().next().value);
          limits.seen.set(requestId, { fingerprint, result }); reply(result);
        };
        if (message.action === 'chat') {
          const decision = moderate(message.text);
          if (!decision.allowed) {
            finish({ ok: false, error: decision.reason });
            if (decision.kick) {
              peer.send({ type: 'moderation', code: 'SEVERE_HATE', message: decision.reason });
              members.delete(peer.account.id); // queued social work cannot run after a kick
              peer.kick(4003, decision.reason);
            }
            return;
          }
          if (limits.tokens < 1) { finish({ ok: false, error: 'Chat is moving too quickly. Wait a moment.' }); return; }
          limits.tokens--;
          const chat = { type: 'chat', id: randomUUID(), channel: 'server', sender: peer.account, text: decision.text, sentAt: now() };
          for (const receiver of members.values()) if (!peer.blocks.has(receiver.account.id) && !receiver.blocks.has(peer.account.id)) receiver.send(chat);
          finish({ ok: true }); return;
        }
        if (++limits.social > 20) { finish({ ok: false, error: 'Too many friend actions. Try again in a minute.' }); return; }
        try {
          if (message.action === 'refresh') { await refresh(peer); finish({ ok: true }); return; }
          if (!validSocialAction(message.action)) { finish({ ok: false, error: 'Unknown Comms action.' }); return; }
          const target = message.targetId;
          const known = typeof target === 'string' && UUID.test(target) && target !== peer.account.id
            && (members.has(target) || peer.data.relationships.some(account => account.id === target) || peer.blocks.has(target));
          // Requests originate only in the live roster; other actions may use a
          // known saved relationship. Unknown, missing and blocked targets share
          // a response. No callsign/email/account-existence endpoint is provided.
          if (known && (message.action !== 'request' || members.has(target))) {
            await store.socialChange(peer.account.id, target, message.action);
            await refreshPair(peer.account.id, target);
          }
          finish({ ok: true, message: message.action === 'request' ? ACTION_REPLY : 'Friend list updated.' });
        } catch {
          onError('SOCIAL_STORAGE_FAILED');
          // Fail closed after an indeterminate storage/read result. A committed
          // block must never leave an old permissive in-memory delivery cache.
          for (const member of members.values()) member.kick(1011, 'Comms storage unavailable. Rejoin shortly.');
          members.clear();
          finish({ ok: false, error: 'Comms storage unavailable. Rejoin shortly.' });
        }
      });
    },
    areFriends: (a, b) => store.areFriends(a, b),
    async close() { closed = true; await chain; members.clear(); budgets.clear(); },
  };
}
