# Multiplayer social validation

Date: 2026-09-07. Isolated branch: `feat/multiplayer-chat-friends`, based on
combined review `4694776`. Backend checkpoint `c619dd0` received an independent
source review of identity derivation, block filtering, SQL locks, mutual consent
and the admission queue. Final kick cleanup is in `006c35c`; the UI/controller
checkpoint is `801a11b` with nested-dialog fixture corrections in `2543c86`.
This branch does not update the shared preview, accounts or public deployment.

## Server and database

Local runtime: Node 26.7.0. Completed checks:

- `npm test`: **834/834 pass**.
- Full multiplayer suite with every PostgreSQL fixture enabled: **110/110 pass,
  zero skips**. Command: `TMPDIR=<short writable path> node
  scripts/social-database.mjs tests/server-*.test.js tests/remote-players.test.js
  tests/multiplayer-ui.test.js tests/multiplayer-social-ui.test.js`.
- `npm run build`: pass, including the production build served for each browser
  job. The inherited large-chunk warning remains.
- `npm run check:repo` and `git diff --check 4694776`: pass. The scoped check plan
  includes unit, multiplayer, database, build, browser, controller, touch and
  visual verification. Prisma's social schema was checked through real migrations.

The WebSocket regressions delay social loading after room welcome and send early
chat/hangar requests, then verify acknowledgements after admission. Another case
closes during admission and proves cleanup before reconnect. A hostile client
that refuses the close handshake is removed from room presence immediately and
cannot run stale commands. Actual room IDs drive the friend presence checks.
The real two-pilot case verifies mutual acceptance, online/offline transitions,
withholding before a private 4003 kick and exact inventory preservation on rejoin.

Moderation regressions cover permitted profanity, neutral identity/history
discussion, quoted/reporting/condemnation contexts, distinct abuse outside a
quote, clear obfuscation, normal substrings and bounded Unicode processing.
Server cases cover sender spoofing, unauthenticated admission, replay, reconnect
rate budgets, generic unavailable-target responses and fail-closed block caches.

The database script starts and removes its own PostgreSQL instance and creates
unique test schemas. It never falls back to the shared `DATABASE_URL`. It verifies
cross-store request/accept/block races, durable friendship after store reopening
and rollback when friendship deletion fails during a block transaction.
The disposable server/database accounts and all chat messages are test fixtures.

## Production browser journeys

Environment: Linux Chromium **151.0.7922.173**, one Playwright worker, native
**ANGLE / AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2**.
Viewports: **1440 × 900** desktop and **390 × 844** phone, touch enabled. Gamepad
events are injected through `navigator.getGamepads`; no physical controller was
tested. The real production game connects to an isolated authenticated server
on ports 5544/8094, with real Node WebSocket peers and stored fixture accounts.

The complete controller case **passed in 1.3 minutes** at `e37eb74`: enter Comms,
compose arbitrary letters/space/numbers/punctuation (`hi 7!`) with the on-screen
keyboard, send and receive server-confirmed chat, request/accept/decline/remove/
block/unblock friends, withhold blocked chat, and verify presence after reconnect.
Nested keyboard bumpers preserve the parent. Returning with held movement/fire,
blur/focus, disconnect/replacement and unsupported controller mapping causes no
movement or ammunition use; a neutral release rearms controls. No captured page
or console errors. Parent review of these captures found legible controls and
visible focus inside the existing gameplay chrome without clipping. The scoped
independent review rated cohesion and information/function 4/5; geometry,
materials and scene lighting were not applicable to these UI views:

- [Controller keyboard](multiplayer-social/controller-keyboard.png)
- [Desktop friends](multiplayer-social/controller-friends-desktop.png)
- [Phone friends](multiplayer-social/controller-friends-phone.png)

Keyboard/touch and ten-pilot/30-friend phone paging completion are pending.
The keyboard/touch fixture has already reached safe plain-text rendering, touch
acceptance, reload and successful reconnect, but those partial stages are not a
completed browser pass.

The first fixture launch failed before Chromium because Playwright resolved its
server command from `scripts/`; explicit working directories fixed it in
`e37eb74`. The first real job was interrupted after the passed controller case
when another owner's job overlapped the reserved slot; the interrupted case was
not counted as a pass. A second job reached reconnect but exhausted its timeout
trying to tap a hidden legacy account close button. `99fa858` uses the visible
shared Resume control and limits individual actions to 15 seconds. No application
shader or startup change was made for either fixture failure. No FPS or exclusive
GPU performance claim is made.

## Limits

Rule-based moderation is English-first and incomplete; it does not understand
all intent, languages, harassment, extremism or evasion. It withholds matched
reported terms without automatically kicking; there is no report inbox, archive,
direct/offline messaging or permanent ban. See the
[authority/moderation decision](../decisions/0003-multiplayer-social.md).

No physical-controller, SMTP delivery, real-user communication, public-service
validation or deployment is claimed. The integration steward owns promotion and
the combined-source check; this record covers the isolated social branch.
