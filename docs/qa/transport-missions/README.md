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
- Earlier build passes 9.11s at `/tmp/transport-build01.log`; later source changes
  require a new build before browser validation. Existing Vite chunk advisory.
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
