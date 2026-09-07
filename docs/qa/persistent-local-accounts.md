# Persistent local multiplayer accounts

Validated 7 September 2026 on `fix/persistent-local-accounts`, based on `a748be1`.
The previous local runner discarded its RAM-only accounts on restart. The new
runner starts native PostgreSQL 16.14 in a named private directory outside Git.
Prisma 7.9.1 accesses the established account/session/reset/player-state tables;
existing SQL migration history, hashes, unique indexes and row locks are retained.

## Checks

- `npm test`: 668 passed.
- `npm run test:multiplayer` with an explicit isolated native PostgreSQL target:
  88 passed, no skips. Includes migrations, case-insensitive uniqueness races,
  literal `%`/`_` email lookup, old SQL records, password-reset consumption and
  stale-session locking, saved JSON bounds, HTTP/WebSockets and authoritative room
  inventory/failed writes. Test schemas are created and removed only on that target.
- `npm run test:database`: three passed. The full preview and native database are
  stopped and restarted after HTTP registration and a real room inventory transfer.
  Account identity, cookie session, password login and exact inventory survive.
  A cold cluster/credentials backup is restored under a different name and checked
  through the same HTTP/WebSocket route. Directory/file permissions and explicit
  startup failure without RAM fallback are also verified.
- `npm run prisma:generate`, production build, 12 contributor-helper tests and
  repository checks pass. `npm audit` reports no vulnerabilities after the scoped
  CLI dependency overrides. The existing build chunk-size advisory remains.
- Production multiplayer browser suite against the native SQL store: both tests
  pass in 3.2 minutes. Desktop/controller/touch account access and the two-pilot
  journey exercise Join, COMMS, transfers, jump, physical EVA exit/return and held
  input across menu, focus and controller disconnect/reconnect. No debug pose writes
  or injected inventory grants. Page/console/request failures: zero. Vite logs two
  ECONNRESET messages while the test servers tear down their WebSocket proxy.

Browser: Chromium 151.0.7922.173, ANGLE/OpenGL ES 3.2 on AMD Radeon 860M.
Capture viewport 1440x900 DPR1; phone check 390x844. Injected standard Gamepad;
no physical-controller, FPS, new visual-art acceptance or independent-review claim.
No gameplay rendering/input code changed in this task. Raw local test reports and
images remain outside Git; no account credentials or real identifiers are retained
in this record. Controller/gravity visuals are also documented by the existing
multiplayer hangar QA record.

## Failed trial and correction

The first local engine trial used Prisma dev/PGlite. It passed simple restart
checks but failed simultaneous registration with PostgreSQL code 08P01: an unnamed
prepared statement expected zero parameters while a Prisma request supplied five.
The implemented runner uses full native PostgreSQL, and the same race test passes.
No pool-size restriction or altered auth expectation was used to hide the failure.
The portable binary package is development-only and pinned; PostgreSQL production
continues to use the configured server connection. System Docker access required
administrator credentials, so the implemented runner uses user-owned binaries.

## Delivery limits

See [local development](../local-development.md) for data location and backup/restore.
Previously discarded RAM accounts have no recovery source. The active RAM preview
was inspected without logging credential values; it had zero accounts. A private
final-shutdown snapshot was prepared to preserve any account created before cutover.
Shared-build cutover and its exact integrated commit are recorded in HANDOFF.
This is local development delivery, with independent review pending. Production
deployment and SMTP delivery are outside this change.

## Shared preview integration

Source `b100d8f` is integrated in `4ebf807`, retaining controller source `741d82a`.
Clean `npm ci` regenerated the Prisma client. The merged runner passes all three
persistence/restore/failure tests, repository checks and build. Its production
two-pilot controller journey passes again in 2.0 minutes with zero recorded browser
errors. A synthetic HTTP account/session also survived a controlled restart of
the actual shared service at port5178 and its native PostgreSQL database51224.
The fixture was deleted by exact ID/email afterward; pre-existing/remaining
accounts both0. All hosted checks on PR59 are green. The running local preview is
managed by `star-agent-persistent-preview.service`; see HANDOFF for restart details.
