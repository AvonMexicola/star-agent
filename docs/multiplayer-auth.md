# Multiplayer accounts and persistence

Accounts store an email address, a unique callsign and a salted password hash.
There is no real-name field. Public account objects contain only `{id, callsign}`;
email addresses and password/session records must never enter room snapshots.
Suit colors belong to connected room slots, not personal identity. The optional
offline game remains independent of account and SMTP services.

## Server integration

```js
import { createPostgresStore } from '../server/database.js';
import { createAuth } from '../server/auth.js';
import { createSMTPMailer } from '../server/mail.js';

const store = await createPostgresStore({ connectionString: process.env.DATABASE_URL });
await store.migrate();
const mail = await createSMTPMailer();
const auth = createAuth({
  store, mail, publicOrigin: process.env.PUBLIC_ORIGIN, secureCookies: true,
  onMailError: ({ code }) => console.error(code),
  onSessionsRevoked: accountId => room.disconnectAccount(accountId),
});
```

`createAuth` is synchronous. Its methods are asynchronous and return
`{status, body, headers?}`; pass the `set-cookie` header through without changing it.
The context argument is `{cookie: req.headers.cookie, ip: trustedRemoteAddress}`.
`createPostgresStore` and `createSMTPMailer` are asynchronous factories.

The PostgreSQL adapter uses Prisma 7 with `@prisma/adapter-pg`, following the
MijnSchoolInzicht project's PostgreSQL/Prisma pattern. `prisma/schema.prisma` maps
the established tables; `npm ci` generates a server-only JavaScript client under
ignored `server/generated/`. No generated database client enters the browser.
The public store methods and persisted account/state formats are unchanged.

| Method | Input | Successful body |
| --- | --- | --- |
| `register(input, context)` | `{email,callsign,password}` | `{account:{id,callsign}}`, status 201, session cookie |
| `login(input, context)` | `{email,password}` | `{account:{id,callsign}}`, status 200, new session cookie |
| `session(context)` | Context only | `{account:{id,callsign}}` or `{account:null}` |
| `logout(context)` | Context only | `{account:null}`, expired cookie |
| `forgot(input, context)` | `{email}` | Uniform `{message}` regardless of account existence or throttling |
| `reset(input, context)` | `{token,password}` | `{message}`, expired cookie; sign in again |
| `authenticate(context)` | Context only | Public account or `null` directly, for WebSocket upgrades |

Errors use `{error: humanReadableMessage}`. Registration returns 409 for an
unavailable email **or** callsign without distinguishing which conflicted.
Registration success inherently reveals whether supplied details were available;
the forgotten-password endpoint never confirms whether an email is registered.
Wrong-password and unknown-email login attempts use the same 401 response and both
perform scrypt. Passwords contain 12–128 Unicode code points (at most 512 UTF-8
bytes), are never trimmed, and use an independent random 16-byte salt with
scrypt N=32768/r=8/p=3 and a 64-byte result. Callsigns contain 3–24 ASCII letters,
numbers, underscores or hyphens. Emails and callsigns are unique ignoring case.

The HTTP owner must enforce same-origin POST requests and WebSocket upgrades,
bound request bodies, suppress auth-response caching, and set a restrictive
Referrer-Policy. Trust forwarded client IP headers only from configured proxies.
Use an explicit HTTPS `PUBLIC_ORIGIN`; never build reset links from request Host
headers. Cookie `star_session` is HttpOnly, SameSite=Lax, Path=/, Secure by default,
and expires after seven days. `secureCookies:false` is for explicit HTTP local
development only. Production rejects insecure cookies and the in-memory store.

Reset emails point to `${PUBLIC_ORIGIN}/?reset=<token>`. The browser should capture
the token and remove it from history immediately, never persist it to localStorage,
and submit it only in the reset request body. The application must redact query
strings from access logs for reset-link requests. Email links expire after 30
minutes, are single-use, and a new request replaces the previous link. PostgreSQL
stores only SHA-256 digests of the random 32-byte session and reset tokens.
Reset and session creation lock the account row to prevent a login verified before
a password change from creating an authenticated session afterward. Reset revokes
all sessions. The HTTP/WebSocket owner must install `onSessionsRevoked(accountId)`
to disconnect existing sockets and periodically reauthenticate live connections.

The default rate limiter bounds requests per IP and hashed identity within a
15-minute window. Forgotten-password limits are 12 per IP and 3 per email;
registration limits are 10 per IP and 5 per email; login/reset limits are 40 per IP
and 10 per identity. A maximum of four password calculations can run concurrently;
overflow returns 503. The limiter map is bounded to 10,000 entries. Inject
`rateLimit({action,ip,identity,now}) -> boolean | Promise<boolean>` for a shared
limiter if running multiple server workers. Periodically call
`store.pruneExpired(Date.now())` to remove expired database tokens.

## Email configuration and delivery limits

The SMTP adapter is provider-neutral and uses Nodemailer. Configure these only in
the server environment; never add credentials to source control or browser bundles.

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP hostname; required |
| `SMTP_PORT` | Port, default 587; 465 uses implicit TLS, other ports require STARTTLS |
| `SMTP_FROM` | Sender address or formatted sender; required |
| `SMTP_USER` | Optional authenticated SMTP username |
| `SMTP_PASSWORD` | Required with `SMTP_USER` |

Creating the adapter sends no mail. `mail.verify()` checks SMTP connectivity and
authentication explicitly; it does not establish inbox delivery or sender-domain
DNS correctness. `mail.close()` closes pooled transport connections. File/URL
attachment access is disabled. Messages are plain text and identify players only
by callsign.

The forgotten-password response does not wait for SMTP delivery. Sending runs
asynchronously; failures invoke `onMailError({code:'RESET_EMAIL_FAILED'})` without
raw SMTP errors, addresses or tokens. This initial implementation has no durable
mail queue: a process exit can lose an in-flight message, and SMTP rejection is
reported to the operator rather than the requester. A new reset request retries
delivery after applicable limits. Account lookups and reset writes still run on
the response path; no constant-time network response is claimed. SMTP delivery
has not been verified against a real provider by the unit suite.

## Database lifecycle and saved state

`store.migrate()` retains the numbered SQL migrations transactionally, with a Postgres
advisory lock and `schema_migrations` version record. It is safe to call again or
from concurrent startup processes. The database role needs schema creation/table
permissions during initial deployment; applications should run against a dedicated
database. Startup must fail if configured persistence is unavailable; there is no
automatic ephemeral fallback. Call `store.close()` during shutdown. When supplying
a `pg.Pool` via `{pool}`, the caller owns pool shutdown.

Prisma model queries use that pool's current PostgreSQL schema. Row locks and
literal case-insensitive email equality use bound SQL through Prisma; `%` and `_`
in an email are never treated as wildcard patterns. The existing lower-case unique
indexes and check constraints remain authoritative. Prisma's schema-push/reset
commands do not replace the deployed migration history.

`loadPlayerState(accountId)` returns the saved JSON object or `null`.
`savePlayerState(accountId, state)` atomically replaces that account's JSONB object,
up to 1 MiB, and updates its timestamp. This is generic server-owned player state;
the authoritative room chooses the inventory/economy/world-state schema and must
validate it. There is no client-write HTTP endpoint in this module. Concurrent
read-modify-write gameplay operations must be serialized by the room per account;
the store's atomic replacement does not merge independent updates.

`createMemoryStore()` implements the same persistence contracts for explicitly
chosen tests/local development. It copies saved objects and cannot be used by
production authentication. Never select it because a database connection failed.

The shared `npm run dev:all` preview now uses persistent native PostgreSQL with
Prisma, not the memory adapter. Its private data directory is outside worktrees
and survives process restarts. See [local development](local-development.md) for
location, configuration and backup/restore. Previously lost RAM-only accounts
cannot be recovered from this new database.

## Verification

Run `node --test tests/server-auth.test.js` for account, password, cookie, forgotten
response, fake-mail, token reuse/expiry, concurrent reset, credential-revocation,
rate limit and saved-state boundaries. No real email is sent. The PostgreSQL test
is skipped unless **`TEST_DATABASE_URL`** is set explicitly; it never falls back to
`DATABASE_URL`. It creates and drops a unique test schema and checks real migration
locking, case-insensitive uniqueness races, saved state, reset consumption and
session revocation across separate store instances. Use a disposable test database
whose role can create schemas. Browser/controller acceptance belongs to the auth
UI and multiplayer integration; these server tests do not establish that journey.

## HTTP/WebSocket entrypoint and deployment

`node server/index.js` starts the API and WebSocket server. The CLI requires
`PUBLIC_ORIGIN` and a working `DATABASE_URL`, runs migrations before listening,
and creates the real authoritative world and room. `PORT` defaults to 8084 and
`HOST` defaults to 127.0.0.1. `STAR_AGENT_MEMORY=1` explicitly selects the ephemeral
adapter for local development; production rejects that flag. Missing SMTP allows
registration, sign-in and multiplayer, with an operator diagnostic that password
reset delivery is unavailable. Partial SMTP configuration fails startup.

The browser and backend must share an origin. Proxy `/api/*` and `/ws` to the
backend while serving the built game from the same HTTPS hostname. Keep the
backend bound to loopback. Set `TRUST_PROXY=1` only when the proxy replaces the
forwarded client-IP header and clients cannot reach the backend directly. Set
`Referrer-Policy: no-referrer` on the static game responses too, and redact reset
query strings from proxy access logs. Do not enable permissive CORS.

Routes are `GET /api/health`, `GET /api/auth/session`, and
`POST /api/auth/{register,login,logout,forgot,reset}`. WebSockets upgrade at `/ws`.
All POSTs and upgrades require the exact configured Origin; POSTs accept only
JSON objects up to 16 KiB. WebSockets require a valid session, disable compression,
limit incoming messages to 16 KiB, and disconnect malformed or excessive traffic.
HTTP allows 180 requests per IP per minute, upgrades allow 30, and authentication
has the stricter limits described above. Each socket accepts at most 120 messages
per second with at most 64 commands queued; the room also enforces its own command
limits. Accepted and pending upgraded connections are capped at 64 while the room
admits at most ten players. Room-full admission returns an explicit error and
closes with code 1013; an already-connected account closes with code 1008.

Heartbeats run every 30 seconds, require pong responses and recheck stored session
validity. Logout closes the presented session's sockets; password reset closes
that account's sockets immediately and invokes room revocation. SIGINT/SIGTERM
stop admission, close sockets, wait for queued commands and departures, then close
the room, mail transport and database pool. Operator diagnostics omit cookies,
passwords, reset tokens, email addresses and raw database/SMTP errors.

The embeddable API is
`await createServer({store,mail,room,publicOrigin,secureCookies,trustProxy})`, returning
`{server,wss,listen,close}`. `listen(port=0,host='127.0.0.1')` resolves to the bound
address. `close()` is idempotent and owns the supplied room/mail/store lifecycle.
Tests can override `heartbeatIntervalMs` and provide a sanitized `logger`.

For the isolated preview, the prepared environment is
`/etc/staragent/multiplayer.env`, mode 0600, with
`PUBLIC_ORIGIN=https://multiplayer.staragent.site`, production mode, loopback
binding, port 8084 and trusted-proxy mode. It refers to a dedicated
`staragent_multiplayer` database and login role; credentials were generated on the
server and are not included in this repository. The existing game database was
not modified. `/opt/staragent/multiplayer-candidate` initially contains only the
server verification files and a minimal dependency package. Runtime deployment
must replace that candidate package with the repository package/lockfile and run
`npm ci`; it must also install the built game, the server modules and required
runtime model assets. Never copy the environment file into that tree or browser
assets. Service setup, HTTPS proxy publication and SMTP verification are separate
deployment steps; preparing this environment alone does not publish the preview.

Server verification on 2026-09-07 used Node 22.23.2 and the dedicated PostgreSQL
database. The auth suite passed all 15 tests, including real migration/uniqueness/
reset races with zero skips, and the initial HTTP/WS suite passed all 13 tests.
The PostgreSQL test created and dropped a unique test schema; it left the default
application schema empty for startup migrations. Additional HTTP hardening tests
cover request/upgrade rate limits and cleanup after a room shutdown failure.
A local smoke check used the real world and room through HTTP registration and
WebSocket admission: 20 station pods, a ten-player cap, one admitted player and
live authoritative snapshots, with no room/server diagnostics. These checks did
not exercise real SMTP or establish browser/controller/visual acceptance.

### Final integrated preview status — 2026-09-07

`https://multiplayer.staragent.site` now serves the isolated reviewed candidate;
`staragent-multiplayer.service` runs as `staragent` on loopback8084. Caddy handles
HTTPS and same-origin API/WebSocket proxying. Existing play/next hosts and the
original database remain separate. Final integrated tests on Node22/PostgreSQL
pass80/80; public HTTPS registration, session cookie, WSS join and hangar request
also passed with the synthetic fixture subsequently removed. SMTP remains
unconfigured. See `docs/qa/multiplayer-browser.md` for browser evidence and limits.

Build the dedicated multiplayer frontend with
`VITE_MULTIPLAYER_ENTRY=1 npm run build`. This opens sign-in after loading on the
bare URL, while preserving an explicit Continue offline choice. Without this
build flag, the regular offline intro remains the default. Deploy `dist/` to the
candidate's static directory; a frontend-only change does not need an API restart.
