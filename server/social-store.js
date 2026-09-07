/** Social persistence is separate from player inventory. Every mutation locks both
 * accounts in ID order, so crossing requests, accepts and blocks are atomic. */
export const SOCIAL_LIMIT = 100;
const actions = new Set(['request', 'accept', 'decline', 'remove', 'block', 'unblock']);
const pair = (a, b) => [a, b].sort();
const publicAccount = account => ({ id: account.id, callsign: account.callsign });
const rowStatus = (row, own) => row.status === 'accepted' ? 'friend' : row.requestedBy === own ? 'outgoing' : 'incoming';
export function validSocialAction(action) { return actions.has(action); }

export function createMemorySocialStore(accounts) {
  const relations = new Map(), blocks = new Map();
  const blocked = (a, b) => blocks.has(`${a}:${b}`) || blocks.has(`${b}:${a}`);
  return {
    async socialList(accountId) {
      const result = { relationships: [], blocked: [] };
      for (const row of relations.values()) {
        if (!row.ids.includes(accountId) || blocked(...row.ids)) continue;
        const other = accounts.get(row.ids.find(id => id !== accountId));
        if (other) result.relationships.push({ ...publicAccount(other), status: rowStatus(row, accountId) });
      }
      for (const row of blocks.values()) if (row.actor === accountId) result.blocked.push(publicAccount(accounts.get(row.target)));
      return structuredClone(result);
    },
    async areFriends(a, b) { return a !== b && relations.get(pair(a, b).join(':'))?.status === 'accepted' && !blocked(a, b); },
    async socialChange(actor, target, action) {
      if (!actions.has(action) || actor === target || !accounts.has(actor) || !accounts.has(target)) return false;
      const ids = pair(actor, target), key = ids.join(':'), row = relations.get(key);
      if (action === 'unblock') { blocks.delete(`${actor}:${target}`); return true; }
      if (action === 'block') {
        if (!blocks.has(`${actor}:${target}`) && [...blocks.values()].filter(value => value.actor === actor).length >= SOCIAL_LIMIT) return false;
        blocks.set(`${actor}:${target}`, { actor, target }); relations.delete(key); return true;
      }
      if (blocked(actor, target)) return false;
      if (action === 'request') {
        if (row) return true; // crossing requests do not silently consent to friendship
        if (ids.some(id => [...relations.values()].filter(value => value.ids.includes(id)).length >= SOCIAL_LIMIT)) return false;
        relations.set(key, { ids, requestedBy: actor, status: 'pending' }); return true;
      }
      if (action === 'accept') {
        if (row?.status === 'accepted') return true;
        if (row?.status !== 'pending' || row.requestedBy === actor) return false;
        row.status = 'accepted'; return true;
      }
      if (action === 'decline') {
        if (row?.status === 'pending' && row.requestedBy !== actor) relations.delete(key);
        return true;
      }
      if (action === 'remove') { relations.delete(key); return true; }
      return false;
    },
  };
}

export function createPostgresSocialStore(prisma) {
  return {
    async socialList(accountId) {
      // Only existing relationships/own blocks are returned. No account directory,
      // wildcard callsign lookup, emails or reverse-block information is exposed.
      const relationships = await prisma.$queryRaw`
        SELECT a.id, a.callsign, f.status, f.requested_by AS "requestedBy"
        FROM friendships f JOIN accounts a ON a.id = CASE WHEN f.account_low = ${accountId}::uuid THEN f.account_high ELSE f.account_low END
        WHERE (f.account_low = ${accountId}::uuid OR f.account_high = ${accountId}::uuid)
        AND NOT EXISTS (SELECT 1 FROM social_blocks b WHERE
          (b.blocker = ${accountId}::uuid AND b.blocked = a.id) OR (b.blocker = a.id AND b.blocked = ${accountId}::uuid))
        ORDER BY lower(a.callsign)`;
      const blocked = await prisma.$queryRaw`SELECT a.id, a.callsign FROM social_blocks b JOIN accounts a ON a.id = b.blocked WHERE b.blocker = ${accountId}::uuid ORDER BY lower(a.callsign)`;
      return { relationships: relationships.map(row => ({ id: row.id, callsign: row.callsign, status: rowStatus(row, accountId) })), blocked };
    },
    async areFriends(a, b) {
      if (a === b) return false;
      const [low, high] = pair(a, b);
      return (await prisma.$queryRaw`SELECT 1 FROM friendships f WHERE f.account_low = ${low}::uuid AND f.account_high = ${high}::uuid AND f.status = 'accepted'
        AND NOT EXISTS (SELECT 1 FROM social_blocks WHERE (blocker = ${a}::uuid AND blocked = ${b}::uuid) OR (blocker = ${b}::uuid AND blocked = ${a}::uuid))`).length > 0;
    },
    async socialChange(actor, target, action) {
      if (!actions.has(action) || actor === target) return false;
      return prisma.$transaction(async tx => {
        const [low, high] = pair(actor, target);
        const accounts = await tx.$queryRaw`SELECT id FROM accounts WHERE id IN (${low}::uuid, ${high}::uuid) ORDER BY id FOR UPDATE`;
        if (accounts.length !== 2) return false;
        if (action === 'unblock') {
          await tx.$executeRaw`DELETE FROM social_blocks WHERE blocker = ${actor}::uuid AND blocked = ${target}::uuid`; return true;
        }
        if (action === 'block') {
          const existing = await tx.$queryRaw`SELECT 1 FROM social_blocks WHERE blocker = ${actor}::uuid AND blocked = ${target}::uuid`;
          const [{ count }] = await tx.$queryRaw`SELECT count(*)::integer AS count FROM social_blocks WHERE blocker = ${actor}::uuid`;
          if (!existing.length && count >= SOCIAL_LIMIT) return false;
          await tx.$executeRaw`INSERT INTO social_blocks (blocker, blocked) VALUES (${actor}::uuid, ${target}::uuid) ON CONFLICT DO NOTHING`;
          await tx.$executeRaw`DELETE FROM friendships WHERE account_low = ${low}::uuid AND account_high = ${high}::uuid`; return true;
        }
        const blocked = await tx.$queryRaw`SELECT 1 FROM social_blocks WHERE (blocker = ${actor}::uuid AND blocked = ${target}::uuid) OR (blocker = ${target}::uuid AND blocked = ${actor}::uuid)`;
        if (blocked.length) return false;
        const [row] = await tx.$queryRaw`SELECT status, requested_by AS "requestedBy" FROM friendships WHERE account_low = ${low}::uuid AND account_high = ${high}::uuid`;
        if (action === 'request') {
          if (row) return true;
          const counts = await tx.$queryRaw`SELECT a.id, count(f.account_low)::integer AS count FROM accounts a
            LEFT JOIN friendships f ON f.account_low = a.id OR f.account_high = a.id WHERE a.id IN (${low}::uuid, ${high}::uuid) GROUP BY a.id`;
          if (counts.some(value => value.count >= SOCIAL_LIMIT)) return false;
          await tx.$executeRaw`INSERT INTO friendships (account_low, account_high, requested_by, status) VALUES (${low}::uuid, ${high}::uuid, ${actor}::uuid, 'pending')`; return true;
        }
        if (action === 'accept') {
          if (row?.status === 'accepted') return true;
          if (row?.status !== 'pending' || row.requestedBy === actor) return false;
          await tx.$executeRaw`UPDATE friendships SET status = 'accepted' WHERE account_low = ${low}::uuid AND account_high = ${high}::uuid`; return true;
        }
        if (action === 'decline') {
          await tx.$executeRaw`DELETE FROM friendships WHERE account_low = ${low}::uuid AND account_high = ${high}::uuid AND status = 'pending' AND requested_by <> ${actor}::uuid`; return true;
        }
        if (action === 'remove') { await tx.$executeRaw`DELETE FROM friendships WHERE account_low = ${low}::uuid AND account_high = ${high}::uuid`; return true; }
        return false;
      });
    },
  };
}
