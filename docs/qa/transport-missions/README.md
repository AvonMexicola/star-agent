# SA-TRANSPORT-001 — Verification record

Status: implemented and developer-validated. Full controller and keyboard/native
touch journeys pass. Locally integrated at `f294a98`; independent acceptance, public
deployment and physical controller testing remain pending.
Owned worktree `.worktrees/transport-missions`, branch `feat/transport-missions`.

## Checks already performed

- Model/cargo suite: 31 individual cases pass, zero skips, 1.00s.
  `/tmp/transport-model-tests03.log`. Ten new transport cases include private
  issuance, exact seal identity, duplicate requests, terminal reach, stow/carry,
  supporting stacks, abandonment, failed-save/reload and continuous drive planning.
- Actual room/two-account authority and isolated PostgreSQL tests: 2 individual
  cases pass, zero skips, 2.00s. `/tmp/transport-server-tests06.log`.
  Checks server-derived terminal/ship reach, private snapshots, forged IDs/pose,
  database rollback, reconnect, server drive integration, concurrent issuance,
  restart and single-use destination payment. Unit poses are explicit fixtures,
  not controller flight evidence.
- Combined runtime `c9d1561` retains settlement, HUD, foundation, rover and
  floodlight updates. All 154 normal test files pass, zero skips, 26.89s
  (`/tmp/transport-final-unit01.log`). The combined production development build
  passes in 4.03s (`/tmp/transport-build04.log`), with the existing chunk advisory.
- Combined multiplayer suite passes 193 individual cases, with two existing
  optional skips, in 22.55s (`/tmp/transport-multiplayer02.log`). Includes the
  new actual-room and isolated SQL transport cases.
- Private-cargo collision follow-up `51332b3`: all 11 focused cargo/transport
  server cases pass, zero skips, 5.68s (`/tmp/transport-private-collision02.log`).
  The owner's crate retains collision; other players cannot hit an invisible
  sealed crate through the walking or EVA adapters. The first numerical EVA
  probe was above the crate's collision envelope and was corrected; that failed
  fixture is retained in `/tmp/transport-private-collision01.log`.
- Terminal union `623d80e` retains checked projected-screen owner `23ca619`.
  Preserve its identity/header, scroll reset, exchange panels and real handlers;
  add Freight through the existing view router. Freight text uses the new paper
  panel's readable dark palette. The production development build passes 4.77s
  at browser-fixture checkpoint `311f866`; its ignored `.env.local` sets
  `VITE_DEV_TOOLS=1`. Repository and whitespace checks pass.
- Final combined normal suite at runtime `623d80e`: all 155 test files pass,
  zero skips, 142.69s with file concurrency one. The Node runner reports files
  here, not 155 individual assertions. `/tmp/transport-final-union-unit02.log`.
- Repository checks and whitespace checks pass on the implementation checkpoint.

## Original failures and corrections

- The first failed-save test tried to continue through MiningStore's deliberate
  blocked state. Corrected the fixture to reload before retrying; the save gate
  remains unchanged. Initial model29/30 was a failed run, later31/31 passes.
- The first actual shared drive request returned a plain cloned plan from the
  memory transaction. Server vectors now regain their methods after commit;
  actual room ticks verify continuous flight. Initial server test failed.
- SQL05 lacked the generated Prisma client in this new worktree. Generated it
  with the existing `npm run prisma:generate`; also made fixture cleanup run if
  store initialization fails. Only the orphaned private test PostgreSQL1107727
  was stopped with SIGINT. `/tmp/transport-server-tests05.log` retains the failure;
  corrected SQL06 passes. No production or shared preview SQL was changed.
- The broad multiplayer run initially passed 192 cases and failed its existing
  legacy commerce fixture: it deleted all markets while retaining the newly
  initialized settlement-version marker. A real pre-market fixture must omit
  both initialization markers. Corrected that fixture; malformed versioned saves
  still fail closed. The full corrected suite above passes.
- A sandbox build could not write Vite's temporary config into the linked shared
  dependency directory. The approved build path passes; no dependency changes.
- Browser01 reached the game but settlement assets failed before entry. The
  recorder reported EDQUOT, and its trace contains no network events. `/tmp` had
  a user quota despite filesystem free space. Another owner's guard also allowed
  an overlapping browser under memory pressure. The original PNG/state remain
  in `test-results/transport-attempt01` (moved intact from `/tmp` after its
  quota later prevented sandbox startup); no gameplay pass is claimed.
- Browser02 moved profiles/evidence onto the project disk, but the deeply nested
  temporary path exceeded Chromium's Unix socket limit. Chromium1531804 aborted
  before a page existed, with an explicit `process_singleton_posix.cc:313`
  socket-path error; coredump metadata confirms SIGABRT. This is distinct from
  the known Crashpad startup restriction. The launcher now uses the short ignored
  project `.browser-cache/t` path; no browser flags or runtime code changed.
- Browser03 loaded all assets, accepted without creating cargo, physically landed
  and reached Greenbank's terminal, ordered one crate and locked the tractor.
  The fixture then raised the crate into the hatch header while walking uphill
  with a fixed aim angle; the cargo slot correctly refused it. Original captures
  and video were inspected. Test-only `e3e77c9` stays behind the ramp and guides
  the actual crate through its clear centre before securing. No collision rule
  was weakened. Browser02/03 originals are in the ignored worktree
  `test-results/transport-attempt02` and `transport-attempt03` directories.
- Browser04 passed actual acceptance, landing, ordering, tractor loading,
  securing, reboarding, launch and the 20km atmospheric climb. It then timed out
  at 51.7% of the continuous 22.9Gm drive, with the original sealed crate still
  aboard: the fixture allowed 45s for a flight whose plan required about 89s.
  Test-only `6492976` now derives its bounded wait from the actual drive ETA.
  Original state, screenshot, video and trace are retained in
  `test-results/transport-attempt04`; no full-journey pass is attributed to it.

## Final browser acceptance — 2026-09-08

`npm run test:browser -- -c scripts/transport-missions.config.js` passes both
cases in 14.1 minutes, one worker, no retries. Attempt05 ran19:28:11–19:42:21UTC
on fixture `1df4438`, runtime `623d80e`; launch/end hashes report no source changes.
Chromium151.0.7922.173, ANGLE/GL, AMD Radeon860M/radeonsi,1440×900 and390×844.
Both receipts contain zero application errors and warnings.

- Complete standard-Gamepad journey passes in12.0min: accept with no crate, actual
  landing/walking to Greenbank, order one sealed crate, tractor it through Nomad’s
  ramp, secure, reboard, climb20km, fly22.9Gm continuously, descend/land at Pyre,
  walk to Ember Works, deposit, inspect2300CR from1500CR and empty cargo, then
  reboard and launch. All901 drive samples retain the original `sbu-2` crate.
- Held RT remains suppressed across dialog closure, actual native focus loss,
  disconnect, replacement and unsupported mapping until released.
- Keyboard contract entry and native390touch terminal case passes in1.9min:
  physical landing/walking precedes touch ordering and abandonment; one crate
  appears, is recalled, and credits remain unchanged. Native swipes expose the
  real action before tapping; keyboard closes the dialog and returns to play.

Original images were inspected without alteration: [acceptance](accepted-before-pickup.png),
[physical loading](crate-at-grid.png), [destination](destination-terminal.png),
[payment and empty hold](phone-completion.png), [native order action](touch-ready-transport-order.png).
Full logs, state, original screenshots,901 flight samples and videos remain in
the ignored worktree `test-results/transport-attempt05`; no raw reports are committed.

## Scope and remaining limits

Twelve personal one-crate routes across the four authored worlds. Existing SBU
crate/ship/tool assets are reused. Ordering spawns only at pickup, only for the
accepting owner. Mission stock is separate from ordinary commodity supply. No
shared rewards, job sharing, deadline/failure penalties or new asset production.

The full Gamepad fixture is `scripts/transport-missions.spec.js`, preview5662.
It starts at the supported65m Aeon approach, accepts, lands, orders, walks and
physically loads the crate, crosses the atmosphere and interplanetary space,
lands at Pyre, deposits, inspects payment and returns. It writes only Gamepad
input after setup; navigation reads are steering feedback. Browser result and
1440×900 /390×844 original evidence pass as recorded above. This validates one
complete solo Nomad Aeon→Pyre route, plus model coverage of all routes and four
canonical sites. It does not establish a rendered two-client online flight,
physical-device testing, all-hull/all-route gameplay, independent review or FPS
acceptance. Actual-room/two-account and PostgreSQL authority evidence is separate.

## Local integration — 2026-09-08

Checked development sync `524b729` has the identical tree to retained terminal
`23ca619`; merging its ancestry changed no runtime. A guarded native
`git merge --ff-only --autostash f294a98` integrated this feature into local
`dev/all-features`. All19 changed runtime files match the tested worktree.
The unrelated append-only HANDOFF suffix was backed up and verified byte-for-byte:
56,247bytes, SHA256 `3bf320f09e28c4d384e811998fc68a7724ab0093d01fc486c0454eb91e7f9abe`.

Only `star-agent-persistent-preview.service` was gracefully restarted at20:18:10UTC.
It reopened the same persistent local PostgreSQL cluster and port51224; no tables,
schema, account data or inventory were reset. This is not a table-row-count audit.
Both8087/api/health and5178/api/health returned `ok:true`. HTTP source comparisons
confirm protocol7, the exact route catalog and the new Contracts entry. A first
source-map-only probe found Vite does not include a map on every transformed
module; the corrected raw-source comparison passes alongside actual module checks.
Local receipts/backups remain in ignored `test-results/integration`.

`npm run check:repo` and `git diff --check` pass. Final
`npm run plan:checks -- --base origin/dev/all-features` reports40 feature paths
and the expected gameplay/controller/database checks; it is a plan, not a result.
No public deployment, protected release merge or independently reviewed acceptance
is implied. The local paired preview remains available at http://127.0.0.1:5178/.

## Development merge follow-up: PostgreSQL shutdown

The first PR99 hosted run34274422075 passed source and browser checks but failed
`server-base-commerce.test.js` during private database cleanup with
`terminating connection due to administrator command`. The earlier development
sync had the same error in the cargo database fixture. These failures remain
recorded; they were not mission gameplay failures or passing checks.

A native connection-lifecycle probe against the existing store reproduced
`afterStoreClose: [false]`: the store returned before its client's `end` event.
The installed pg-pool removes clients before their socket callbacks complete.
Stopping PostgreSQL immediately can therefore interrupt those remaining clients.
The existing community persistence fixture already accounted for this lifecycle.

The owned store now tracks active client disconnects from pool creation, waits
for them after `pool.end()`, and releases its listener. Initialization failure
uses the same cleanup. Caller-supplied pools retain caller ownership. No database
error is suppressed, and no migration, mission, protocol or renderer changes.
The same native probe now reports `afterStoreClose: [true]`.

`tests/server-pool-close.test.js` checks delayed/concurrent disconnects, drain
failure propagation, actual SQL reopen durability and initialization failure,
and continued use of caller-owned pools. All17 focused pool/base-commerce/cargo/
transport cases pass in7.78s, including actual isolated databases. Full local
restart/cold-backup/unavailable-database checks pass3/3 in25.19s. Machine logs
remain in `.worktrees/dev-updates-sync/test-results/`; no shared database is used.

The first parallel full local multiplayer run passed195 cases with2 existing
optional skips but timed out opening the transport fixture's private SQL
connection (5s limit) while several isolated databases started under shared
machine load. The focused same transport SQL already passes. The ordinary
connection timeout is retained. The same full suite with `--test-concurrency=1`
passes196 cases with2 existing optional skips, zero failures, in33.22s. This is a
separate failure from the fixed administrator-termination shutdown race.
