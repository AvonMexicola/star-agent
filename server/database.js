import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const clone = (value) => value == null ? value : structuredClone(value);
const conflict = () => Object.assign(new Error('Account details unavailable.'), { code: 'ACCOUNT_CONFLICT' });
function stateJSON(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('Player state must be an object.');
  const json = JSON.stringify(state);
  if (Buffer.byteLength(json) > 1024 * 1024) throw new RangeError('Player state exceeds 1 MiB.');
  return json;
}
const fromRow = (row) => row && ({ id: row.id, email: row.email, callsign: row.callsign, passwordHash: row.password_hash });
const accountFields = { id: true, email: true, callsign: true, passwordHash: true };

/** Explicit test/development adapter. Never selected automatically in production. */
export function createMemoryStore() {
  let commerce=null, commerceQueue=Promise.resolve();
  const accounts = new Map(), sessions = new Map(), resets = new Map(), states = new Map();
  return {
    persistent: false,
    async migrate() {}, async close() {},
    async createAccount({ email, callsign, passwordHash }) {
      for (const a of accounts.values()) if (a.email.toLowerCase() === email.toLowerCase() || a.callsign.toLowerCase() === callsign.toLowerCase()) throw conflict();
      const account = { id: randomUUID(), email, callsign, passwordHash };
      accounts.set(account.id, account);
      return clone(account);
    },
    async findAccountByEmail(email) { return clone([...accounts.values()].find(a => a.email.toLowerCase() === email.toLowerCase()) ?? null); },
    async createSession({ accountId, passwordHash, tokenHash, expiresAt }) {
      if (accounts.get(accountId)?.passwordHash !== passwordHash) return false;
      sessions.set(tokenHash, { accountId, expiresAt }); return true;
    },
    async findSession(tokenHash, now) {
      const session = sessions.get(tokenHash);
      if (!session || session.expiresAt <= now) { sessions.delete(tokenHash); return null; }
      return clone(accounts.get(session.accountId));
    },
    async deleteSession(tokenHash) { sessions.delete(tokenHash); },
    async createReset({ accountId, tokenHash, expiresAt }) {
      if (!accounts.has(accountId)) return;
      for (const [hash, reset] of resets) if (reset.accountId === accountId) resets.delete(hash);
      resets.set(tokenHash, { accountId, expiresAt });
    },
    async resetPassword({ tokenHash, passwordHash, now }) {
      const reset = resets.get(tokenHash);
      if (!reset || reset.expiresAt <= now) return null;
      const account = accounts.get(reset.accountId);
      account.passwordHash = passwordHash;
      for (const [hash, value] of resets) if (value.accountId === account.id) resets.delete(hash);
      for (const [hash, value] of sessions) if (value.accountId === account.id) sessions.delete(hash);
      return clone(account);
    },
    async loadCommerce() { return clone(commerce); },
    transactCommerce(fn) {
      const task=commerceQueue.catch(()=>{}).then(async()=>{
        const result=await fn(clone(commerce));
        for(const [id,state] of Object.entries(result.players??{})) {
          if(!accounts.has(id))throw new Error('Unknown account.'); stateJSON(state);
        }
        const value=JSON.parse(JSON.stringify(result.state));
        for(const [id,state] of Object.entries(result.players??{}))states.set(id,clone(state));
        commerce=value;return clone(result);
      }); commerceQueue=task;return task;
    },
    async loadPlayerState(accountId) { return clone(states.get(accountId) ?? null); },
    async savePlayerState(accountId, state) {
      if (!accounts.has(accountId)) throw new Error('Unknown account.');
      states.set(accountId, JSON.parse(stateJSON(state)));
    },
    async pruneExpired(now) {
      for (const [key, value] of sessions) if (value.expiresAt <= now) sessions.delete(key);
      for (const [key, value] of resets) if (value.expiresAt <= now) resets.delete(key);
    },
  };
}

/** Persistent PostgreSQL store through Prisma. Call migrate() before accepting traffic. */
export async function createPostgresStore({ connectionString, pool: suppliedPool } = {}) {
  if (!suppliedPool && !connectionString) throw new Error('DATABASE_URL is required for persistent multiplayer.');
  const pool = suppliedPool ?? new (await import('pg')).default.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
  let prisma;
  try {
    const [{ PrismaClient }, { PrismaPg }, schema] = await Promise.all([
      import('./generated/prisma/index.js'), import('@prisma/adapter-pg'),
      pool.query('SELECT current_schema() AS name'),
    ]);
    if (!schema.rows[0]?.name) throw new Error('Database search path must select an existing schema.');
    prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: schema.rows[0].name }) });
  } catch (error) {
    if (!suppliedPool) await pool.end();
    throw error;
  }
  async function transaction(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const value = await fn(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  return {
    persistent: true,
    async migrate() {
      const sql = await readFile(new URL('./migrations/001-accounts.sql', import.meta.url), 'utf8');
      await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(7291, 1)');
        await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
        const result = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [1]);
        if (!result.rowCount) { await client.query(sql); await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [1]); }
        const commerceMigration=await client.query('SELECT version FROM schema_migrations WHERE version=2');
        if(!commerceMigration.rowCount){await client.query(await readFile(new URL('./migrations/002-commerce.sql',import.meta.url),'utf8'));await client.query('INSERT INTO schema_migrations(version) VALUES(2)');}
      });
    },
    async close() { try { await prisma.$disconnect(); } finally { if (!suppliedPool) await pool.end(); } },
    async createAccount({ email, callsign, passwordHash }) {
      try { return await prisma.account.create({ data: { id: randomUUID(), email, callsign, passwordHash }, select: accountFields }); }
      catch (error) { if (error.code === 'P2002') throw conflict(); throw error; }
    },
    async findAccountByEmail(email) {
      // Literal equality: an email containing % or _ must never become an ILIKE pattern.
      return fromRow((await prisma.$queryRaw`SELECT id,email,callsign,password_hash FROM accounts WHERE lower(email) = lower(${email})`)[0]) ?? null;
    },
    async createSession({ accountId, passwordHash, tokenHash, expiresAt }) {
      return prisma.$transaction(async client => {
        const found = await client.$queryRaw`SELECT password_hash FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE`;
        if (found[0]?.password_hash !== passwordHash) return false;
        await client.session.create({ data: { tokenHash, accountId, expiresAt: new Date(expiresAt) } });
        return true;
      });
    },
    async findSession(tokenHash, now) {
      return (await prisma.session.findFirst({ where: { tokenHash, expiresAt: { gt: new Date(now) } },
        select: { account: { select: accountFields } } }))?.account ?? null;
    },
    async deleteSession(tokenHash) { await prisma.session.deleteMany({ where: { tokenHash } }); },
    async createReset({ accountId, tokenHash, expiresAt }) {
      await prisma.$transaction(async client => {
        const found = await client.$queryRaw`SELECT id FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE`;
        if (!found.length) return;
        await client.passwordReset.upsert({ where: { accountId },
          create: { accountId, tokenHash, expiresAt: new Date(expiresAt) },
          update: { tokenHash, expiresAt: new Date(expiresAt) } });
      });
    },
    async resetPassword({ tokenHash, passwordHash, now }) {
      return prisma.$transaction(async client => {
        const where = { tokenHash, expiresAt: { gt: new Date(now) } };
        const reset = await client.passwordReset.findFirst({ where });
        if (!reset) return null;
        const { accountId } = reset;
        await client.$queryRaw`SELECT id FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE`;
        const consumed = await client.passwordReset.deleteMany({ where });
        if (!consumed.count) return null;
        const account = await client.account.update({ where: { id: accountId }, data: { passwordHash }, select: accountFields });
        await client.session.deleteMany({ where: { accountId } });
        return account;
      });
    },
    async loadCommerce() { return (await pool.query("SELECT state FROM commerce_state WHERE id='world-7291'")).rows[0]?.state??null; },
    async transactCommerce(fn) {
      return transaction(async client=>{
        await client.query('SELECT pg_advisory_xact_lock(7291, 2)');
        const current=(await client.query("SELECT state FROM commerce_state WHERE id='world-7291' FOR UPDATE")).rows[0]?.state??null;
        const result=await fn(current);
        await client.query("INSERT INTO commerce_state(id,state) VALUES('world-7291',$1::jsonb) ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()",[JSON.stringify(result.state)]);
        for(const [id,state] of Object.entries(result.players??{}))await client.query('INSERT INTO player_state(account_id,state) VALUES($1,$2::jsonb) ON CONFLICT(account_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()',[id,stateJSON(state)]);
        return result;
      });
    },
    async loadPlayerState(accountId) { return (await prisma.playerState.findUnique({ where: { accountId }, select: { state: true } }))?.state ?? null; },
    async savePlayerState(accountId, state) {
      const value = JSON.parse(stateJSON(state));
      await prisma.playerState.upsert({ where: { accountId }, create: { accountId, state: value },
        update: { state: value, updatedAt: new Date() } });
    },
    async pruneExpired(now) {
      const where = { expiresAt: { lte: new Date(now) } };
      await prisma.$transaction([prisma.session.deleteMany({ where }), prisma.passwordReset.deleteMany({ where })]);
    },
  };
}
