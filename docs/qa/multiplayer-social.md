# Multiplayer social validation

Date: 2026-09-07. Worktree: `feat/multiplayer-chat-friends` from combined review
`4694776`. Backend checkpoint: `c619dd0`. The integration steward reviewed identity
derivation, block filtering, SQL locks, explicit consent and the admission queue.
This is a source review, not a browser or deployment approval.

Completed CPU checks:

- `npm test`: 834/834 pass.
- `npm run test:multiplayer`: 106 pass, two explicit PostgreSQL fixture skips at
  that checkpoint. Both SQL fixtures ran separately against a disposable cluster.
- `TMPDIR=<short writable directory> npm run test:social:database`: 26/26 pass,
  zero skips, including auth and social migrations, concurrency, rollback and reopen.
- The later focused social/client suite passes 17 checks with one SQL-only skip.
  It adds list-capacity refusal and real-room presence/kick/reconnect verification.
- `npm run build`: pass; inherited large-chunk warning retained.
- Browser fixture syntax and three-case discovery pass. These do not establish
  browser acceptance.

The WebSocket regression delays social storage after room welcome, sends early
chat and hangar requests, and verifies acknowledgements after admission. A second
case closes during admission and proves cleanup before reconnect. The real-world
two-pilot case checks actual room IDs, mutual acceptance, live/offline presence,
withholding before a 4003 kick and exact inventory preservation on reconnect.

The SQL fixture creates and drops unique schemas in its own PostgreSQL instance.
It never falls back to `DATABASE_URL` or reads the shared cluster. It verifies
cross-store request/accept/block races, durable friendship after reopening the
store and rollback of block insertion when friendship deletion is forced to fail.

Browser status: queued, not yet run. Required cases are controller text entry and
friend lifecycle/neutral gates; keyboard and touch plain-text safety, reload and
private kick reason; ten real admitted fixture accounts and thirty stored friends
with bounded phone pages and a 400-character draft. Tests use one real game page
and real Node WebSocket peers against the isolated account/room server. Injected
Gamepad input is distinct from physical-controller testing.

No physical controller, real-user messages, public service test, permanent ban,
SMTP delivery or production deployment is claimed. Rule-based moderation is
English-first and incomplete; see the [decision](../decisions/0003-multiplayer-social.md).
