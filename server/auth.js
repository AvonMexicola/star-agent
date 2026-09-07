import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const SESSION_COOKIE = 'star_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 30 * 60 * 1000;
const FORGOT_MESSAGE = 'If that address has an account, a reset link will be sent.';
const DUMMY_HASH = `scrypt:32768:8:3:${'00'.repeat(16)}:${'00'.repeat(64)}`;
const digest = token => createHash('sha256').update(token).digest('hex');
const publicAccount = account => account ? { id: account.id, callsign: account.callsign } : null;
const result = (status, body, headers) => ({ status, body, ...(headers ? { headers } : {}) });
const failure = (status, error) => result(status, { error });
const inputObject = input => input && typeof input === 'object' && !Array.isArray(input) ? input : {};
const normalizedEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = value => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\x00-\x1f\x7f]/.test(value);
function validPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 256) return false;
  const length = [...value].length;
  return length >= 12 && length <= 128 && Buffer.byteLength(value) <= 512;
}
function sessionToken(cookie) {
  if (typeof cookie !== 'string' || cookie.length > 8192) return null;
  const matches = cookie.split(';').map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
function setCookie(token, secure, maxAge) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

/** Bounded single-process limiter; inject a shared limiter before running multiple workers. */
export function createAuthRateLimiter({ maxEntries = 10000 } = {}) {
  const entries = new Map();
  return ({ action, ip, identity, now }) => {
    for (const [key, entry] of entries) if (entry.until <= now) entries.delete(key);
    const limits = action === 'forgot' ? [12, 3] : action === 'register' ? [10, 5] : [40, 10];
    const keys = [`${action}:ip:${ip}`, `${action}:identity:${identity}`];
    if (keys.some((key, i) => (entries.get(key)?.count ?? 0) >= limits[i])) return false;
    if (keys.some(key => !entries.has(key)) && entries.size + 2 > maxEntries) return false;
    keys.forEach(key => {
      const entry = entries.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
      entry.count++; entries.set(key, entry);
    });
    return true;
  };
}

/** Framework-neutral auth. Context is {cookie, ip}; the HTTP layer enforces origin and request size. */
export function createAuth({ store, mail, publicOrigin, secureCookies = true, now = Date.now,
  rateLimit = createAuthRateLimiter(), onMailError = () => {}, onSessionsRevoked = () => {} } = {}) {
  if (!store) throw new Error('An explicit account store is required.');
  if (process.env.NODE_ENV === 'production' && !store.persistent) throw new Error('Production authentication requires PostgreSQL persistence.');
  const origin = new URL(publicOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.origin !== publicOrigin.replace(/\/$/, '')) throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a path.');
  if (secureCookies && origin.protocol !== 'https:') throw new Error('Secure cookies require an HTTPS PUBLIC_ORIGIN.');
  if (process.env.NODE_ENV === 'production' && !secureCookies) throw new Error('Production authentication requires secure cookies.');
  let passwordJobs = 0;
  async function derive(password, salt) {
    // Do not grow an unbounded queue of expensive password jobs under attack.
    if (passwordJobs >= 4) throw Object.assign(new Error('Authentication is busy. Try again shortly.'), { code: 'AUTH_BUSY' });
    passwordJobs++;
    try { return await scryptAsync(password, salt, 64, SCRYPT); }
    finally { passwordJobs--; }
  }
  async function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    return `scrypt:32768:8:3:${salt}:${(await derive(password, Buffer.from(salt, 'hex'))).toString('hex')}`;
  }
  async function verifyPassword(password, hash) {
    const valid = /^scrypt:32768:8:3:[0-9a-f]{32}:[0-9a-f]{128}$/.test(hash ?? '');
    const parts = (valid ? hash : DUMMY_HASH).split(':');
    const actual = await derive(password, Buffer.from(parts[4], 'hex'));
    return timingSafeEqual(actual, Buffer.from(parts[5], 'hex')) && valid;
  }
  async function allowed(action, context, identity) {
    return rateLimit({ action, ip: String(context?.ip ?? 'unknown').slice(0, 100), identity: digest(identity), now: now() });
  }
  async function issueSession(account, status) {
    const token = randomBytes(32).toString('base64url');
    const accepted = await store.createSession({ accountId: account.id, passwordHash: account.passwordHash, tokenHash: digest(token), expiresAt: now() + SESSION_TTL_MS });
    if (!accepted) return failure(401, 'Account credentials changed. Please sign in again.');
    return result(status, { account: publicAccount(account) }, { 'set-cookie': setCookie(token, secureCookies, SESSION_TTL_MS / 1000) });
  }
  async function authenticate(context = {}) {
    const token = sessionToken(context.cookie);
    return token ? publicAccount(await store.findSession(digest(token), now())) : null;
  }
  const guarded = fn => async (...args) => {
    try { return await fn(...args); }
    catch (error) { if (error.code === 'AUTH_BUSY') return failure(503, error.message); throw error; }
  };
  return {
    authenticate,
    async session(context = {}) { return result(200, { account: await authenticate(context) }); },
    register: guarded(async (input, context = {}) => {
      let { email, callsign, password } = inputObject(input);
      email = normalizedEmail(email);
      callsign = typeof callsign === 'string' ? callsign.trim() : '';
      if (!await allowed('register', context, email)) return failure(429, 'Too many attempts. Try again later.');
      if (!validEmail(email)) return failure(400, 'Enter a valid email address.');
      if (!/^[A-Za-z0-9_-]{3,24}$/.test(callsign)) return failure(400, 'Callsign must be 3–24 letters, numbers, underscores or hyphens.');
      if (!validPassword(password)) return failure(400, 'Use a password containing 12–128 characters.');
      const passwordHash = await hashPassword(password);
      let account;
      try { account = await store.createAccount({ email, callsign, passwordHash }); }
      catch (error) { if (error.code === 'ACCOUNT_CONFLICT') return failure(409, 'Those account details are unavailable. Try signing in or choose a different callsign.'); throw error; }
      return issueSession(account, 201);
    }),
    login: guarded(async (input, context = {}) => {
      let { email, password } = inputObject(input);
      email = normalizedEmail(email);
      if (!await allowed('login', context, email)) return failure(429, 'Too many attempts. Try again later.');
      if (!validEmail(email) || !validPassword(password)) return failure(401, 'Email or password is incorrect.');
      const account = await store.findAccountByEmail(email);
      const verified = await verifyPassword(password, account?.passwordHash ?? DUMMY_HASH);
      if (!account || !verified) return failure(401, 'Email or password is incorrect.');
      return issueSession(account, 200);
    }),
    async logout(context = {}) {
      const token = sessionToken(context.cookie);
      if (token) await store.deleteSession(digest(token));
      return result(200, { account: null }, { 'set-cookie': setCookie('', secureCookies, 0) });
    },
    async forgot(input, context = {}) {
      let { email } = inputObject(input);
      email = normalizedEmail(email);
      const response = result(200, { message: FORGOT_MESSAGE });
      if (!await allowed('forgot', context, email) || !validEmail(email)) return response;
      const account = await store.findAccountByEmail(email);
      if (!account) return response;
      const token = randomBytes(32).toString('base64url');
      const expiresAt = now() + RESET_TTL_MS;
      await store.createReset({ accountId: account.id, tokenHash: digest(token), expiresAt });
      const url = `${origin.origin}/?reset=${token}`;
      // Delivery runs outside the response path. Never return SMTP diagnostics or a token.
      Promise.resolve().then(() => {
        if (!mail?.sendPasswordReset) throw new Error('Password reset email is not configured.');
        return mail.sendPasswordReset({ email: account.email, callsign: account.callsign, url, expiresAt });
      }).catch(() => { try { onMailError({ code: 'RESET_EMAIL_FAILED' }); } catch { /* diagnostics cannot reject a response */ } });
      return response;
    },
    reset: guarded(async (input, context = {}) => {
      const { token, password } = inputObject(input);
      if (!await allowed('reset', context, typeof token === 'string' ? token : '')) return failure(429, 'Too many attempts. Try again later.');
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return failure(400, 'That reset link is invalid or expired.');
      if (!validPassword(password)) return failure(400, 'Use a password containing 12–128 characters.');
      const account = await store.resetPassword({ tokenHash: digest(token), passwordHash: await hashPassword(password), now: now() });
      if (!account) return failure(400, 'That reset link is invalid or expired.');
      await onSessionsRevoked(account.id);
      return result(200, { message: 'Password updated. Sign in with your new password.' }, { 'set-cookie': setCookie('', secureCookies, 0) });
    }),
  };
}
