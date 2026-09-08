# Disabled Atlas cargo recovery — development evidence

Status: implementation and CPU checks complete; physical browser acceptance in progress.
No local integration, independent visual acceptance or public deployment claimed yet.

Source: initial recovery `3d7bf94`; private combined `0994b83` consumes checked
Garage/Pirate002 `cc1e749`. The merge preserves Pirate external damage, interaction
ordering and the union of both test inventories. Pending Sentry/rotation work is
not copied. No dependency, authored asset, SQL schema or protocol change.

## Checks so far

| Check | Source | Result |
| --- | --- | --- |
| `node --test tests/recovery-missions.test.js tests/transport-missions.test.js tests/cargo-tractor.test.js` | Recovery implementation | All 3 files pass, 0 skipped |
| `npm test` | Initial recovery | 1,205 cases pass, 0 fail/skip, 42.94 s |
| `npm run build` | Initial recovery | Pass, 375 modules, 7.24 s |
| `npm test` | Combined0994b83 | 1,220 cases pass, 0 fail/skip, 31.25 s |
| `npm run build` | Combined0994b83 | Pass, 388 modules, 4.11 s, main-CnRhQ01f.js |
| `npm run check:repo` | Initial recovery | Pass; final metadata check still pending |
| `npm run plan:checks -- --base origin/dev/all-features` | Initial recovery | Plan generated; includes inherited changes, not a test result |

Builds retain the existing large-chunk warning. A preliminary command incorrectly
named absent `tests/tractor.test.js`; no tractor result is attributed to that command.
The corrected three-file command above runs the actual cargo tractor tests.

## Gameplay acceptance

`scripts/recovery-missions.config.js` runs one production5680 Chromium job, one
worker, no retries, maxFailures1. Its actual-launch host executable/argv guard
excludes other Playwright jobs, records source hashes and uses short disk-backed
TMPDIR `.browser-cache/rc`. Raw attempts stay in ignored `test-results/recovery-NN`.
No shared preview, API or database is touched by this QA harness.

The full controller case begins at the supported65m Aeon settlement approach. All
subsequent movement, aiming, entry, acceptance, tractor control, payment and return
use standard Gamepad input. Navigation state is read only for steering feedback.
A separate actual ship fight checks the raider variant, and a keyboard/native phone
case checks contract actions. Phone flight is not implied by that UI case.

Physical-controller hardware, other-hull journeys, online NPC authority and an
independent scored art/performance review remain separate and untested here.

## Attempt01 — fixture ascent correction

Production0994b83, Chromium151 ANGLE gl,1440×900. Browser started and the
controller reached Recovery, accepted Silent Atlas, issued no cargo, and climbed
continuously. The fixture blindly toggled gear even though the supported65m start
already had it retracted. Its own input deployed the gear and imposed the real
35m/s maneuvering limit; the180s ascent timeout occurred at6.17km. Original
contracts/failure PNG+JSON, trace and video remain in `test-results/recovery-01`.
No application error was recorded. Later cases did not run. Runtime source hash
remained unchanged. The fixture now checks actual gear state before issuing the
same controller shortcut, and asserts retraction before ascent. No runtime fix.

Two focused actual-room regressions also pass on0994b83:
`node --test --test-concurrency=1 --test-name-pattern='^(server binds contract|server supports Atlas cargo hull)' tests/server-transport.test.js tests/server-cargo.test.js`.
These cover authenticated personal freight ownership/terminal/deposit/reload and
Atlas cargo/2SBU hand-carry denial. Only the named memory-store cases were selected;
no PostgreSQL migration or full multiplayer-suite result is claimed for this run.
