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

/** Explicit test/development adapter. Never selected automatically in production. */
export function createMemoryStore() {
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

/** Persistent Postgres store. Call migrate() before accepting traffic. */
export async function createPostgresStore({ connectionString, pool: suppliedPool } = {}) {
  if (!suppliedPool && !connectionString) throw new Error('DATABASE_URL is required for persistent multiplayer.');
  const pool = suppliedPool ?? new (await import('pg')).default.Pool({ connectionString, max: 10 });
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
      });
    },
    async close() { if (!suppliedPool) await pool.end(); },
    async createAccount({ email, callsign, passwordHash }) {
      try { return fromRow((await pool.query('INSERT INTO accounts (id,email,callsign,password_hash) VALUES ($1,$2,$3,$4) RETURNING *', [randomUUID(), email, callsign, passwordHash])).rows[0]); }
      catch (error) { if (error.code === '23505') throw conflict(); throw error; }
    },
    async findAccountByEmail(email) { return fromRow((await pool.query('SELECT * FROM accounts WHERE lower(email) = lower($1)', [email])).rows[0]) ?? null; },
    async createSession({ accountId, passwordHash, tokenHash, expiresAt }) {
      return transaction(async client => {
        const found = await client.query('SELECT password_hash FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
        if (found.rows[0]?.password_hash !== passwordHash) return false;
        await client.query('INSERT INTO sessions (token_hash,account_id,expires_at) VALUES ($1,$2,$3)', [tokenHash, accountId, new Date(expiresAt)]);
        return true;
      });
    },
    async findSession(tokenHash, now) { return fromRow((await pool.query('SELECT a.* FROM accounts a JOIN sessions s ON s.account_id = a.id WHERE s.token_hash = $1 AND s.expires_at > $2', [tokenHash, new Date(now)])).rows[0]) ?? null; },
    async deleteSession(tokenHash) { await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); },
    async createReset({ accountId, tokenHash, expiresAt }) {
      await transaction(async client => {
        await client.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
        await client.query('INSERT INTO password_resets (token_hash,account_id,expires_at) VALUES ($1,$2,$3) ON CONFLICT (account_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at', [tokenHash, accountId, new Date(expiresAt)]);
      });
    },
    async resetPassword({ tokenHash, passwordHash, now }) {
      return transaction(async client => {
        const result = await client.query('SELECT account_id FROM password_resets WHERE token_hash = $1 AND expires_at > $2', [tokenHash, new Date(now)]);
        if (!result.rowCount) return null;
        const accountId = result.rows[0].account_id;
        await client.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
        const consumed = await client.query('DELETE FROM password_resets WHERE token_hash = $1 AND expires_at > $2 RETURNING account_id', [tokenHash, new Date(now)]);
        if (!consumed.rowCount) return null;
        const account = fromRow((await client.query('UPDATE accounts SET password_hash = $1 WHERE id = $2 RETURNING *', [passwordHash, accountId])).rows[0]);
        await client.query('DELETE FROM sessions WHERE account_id = $1', [accountId]);
        return account;
      });
    },
    async loadPlayerState(accountId) { return (await pool.query('SELECT state FROM player_state WHERE account_id = $1', [accountId])).rows[0]?.state ?? null; },
    async savePlayerState(accountId, state) {
      await pool.query('INSERT INTO player_state (account_id,state) VALUES ($1,$2::jsonb) ON CONFLICT (account_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()', [accountId, stateJSON(state)]);
    },
    async pruneExpired(now) {
      await transaction(async client => {
        await client.query('DELETE FROM sessions WHERE expires_at <= $1', [new Date(now)]);
        await client.query('DELETE FROM password_resets WHERE expires_at <= $1', [new Date(now)]);
      });
    },
  };
}
