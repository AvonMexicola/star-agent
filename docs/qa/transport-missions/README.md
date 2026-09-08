# SA-TRANSPORT-001 — Verification record

Status: implementation checkpoint. Full browser journey, local integration and
independent acceptance are pending. No deployment or physical controller claim.
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
  in `/tmp/star-agent-transport-attempt01`; no gameplay pass is claimed.
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

## Scope and pending evidence

Twelve personal one-crate routes across the four authored worlds. Existing SBU
crate/ship/tool assets are reused. Ordering spawns only at pickup, only for the
accepting owner. Mission stock is separate from ordinary commodity supply. No
shared rewards, job sharing, deadline/failure penalties or new asset production.

The full Gamepad fixture is `scripts/transport-missions.spec.js`, preview5662.
It starts at the supported65m Aeon approach, accepts, lands, orders, walks and
physically loads the crate, crosses the atmosphere and interplanetary space,
lands at Pyre, deposits, inspects payment and returns. It writes only Gamepad
input after setup; navigation reads are steering feedback. Browser result and
1440×900 /390×844 original evidence remain pending, as do native touch checks.
