# Disabled Atlas cargo recovery — development evidence

Status: implementation, CPU checks and complete controller recovery/delivery/bonus-sale journey pass. Guarded and native phone acceptance remain in progress.
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

The current full controller case begins at the supported Aeon orbit entry.
Attempt02 separately passed the continuous ascent from the supported65m settlement approach. All
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

## Attempt02 — physical wreck reached, tractor lease expired

Frozen4b4bc55/runtime0994b83.9.1min full controller case reached continuous Aeon
ascent, drive arrival, normal approach/parking, actual cabin/ramp exit and a
physical EVA exterior inspection, then aimed at the two original marked crates.
Original1440×900 exterior and open-bay PNGs were inspected: Atlas geometry, ramps,
white/dark materials and amber strips render; no fallback, application error or
new warning. Renderer scale was adaptive0.8 at the exterior capture,396 draws /
162,875 triangles; this isolated snapshot is not an FPS or art acceptance.

The saved receipts show a successful tractor grab and four movement commits. The
trace then has a10.071s screencast gap after499.66s; the1.5s lock expired. Its
presentation silently lost the held state, so the fixture’s later observation
timed out. No renderer/shader/host cause is asserted from that gap alone. Original
PNG+JSON/video/trace retained in `test-results/recovery-02`; later cases did not run.
The correction adds an explicit expired-lock instruction and requires a fresh
release/re-engage, without extending any server lease or moving cargo remotely.
The fixture records up to three actual release/re-engage attempts if that message
appears. The next full journey uses the normal supported orbit start and retains
real entry, travel, EVA, hauling, inbound atmospheric flight, terminal payment and
return to play. No debug pose is assigned after setup.

## Attempt03 — real beam and interruption checks, EVA drift correction

Frozen2a6ab9d; production build03 PASS4.75s/main-CitUshvm.js. Supported orbit
entry, real drive/approach/parking/EVA and original crate pickup pass. The actual
held sealed crate survives menu, native tab focus, disconnect, replacement and
unsupported mapping transitions with no stale beam replay. Its physical haul
clears the Atlas ramp; original active-beam PNGs were inspected. No expired-lock
retry was needed on this run. No application error or warning was recorded.

5.4min case stopped during guiding toward the Nomad. The fixture released LT
before stopping the suit: its saved exit velocity was0.331m/s. During the next
guiding steps it coasted from outside to the real Nomad ramp, attached magnetic
boots, and blocked its own intended crate path. The original crate and tractor
lock remained intact. Raw03 includes exact movement/pose/cargo, two videos and
trace. Fix only the controller helper: hold LT until actual speed<0.01m/s at
each waypoint. Later guarded/phone cases did not run. Static review also catches
the guarded fixture leaving cruise weapons locked; it now uses the real Combat
mode action, and the guarded mission UI supplies that discoverable instruction.

## Attempt04 — short drive observation race

Frozenba1d694/build04 PASS6.28s/main-i3Nn_Fsm.js. The actual short drive completed
during the helper’s controller chord/release frames. Saved failure position is
at the real20km wreck approach with no issued cargo; the subsequent wait for an
active drive timed out. Original04 trace/video/state retained, no app errors.
The fixture now records drive phases/positions before controller activation and
asserts completed displacement plus several distinct observed positions. It does
not require observing the transient drive after the action already returned.
No runtime change or rebuild; later cases again did not run. Draft PR105 opened
on the checked Pirate103 base with all gameplay limits explicit.


## Specific-container and bonus-loot revision

Cees requested one specific required container, optional loot from other crates,
and a grid-size notice instead of capacity-gated acceptance. New contracts now
name one 2 SBU objective (0.6 × 0.6 × 1.2 m); remaining containers are private
optional copper cargo. Secured loot can be sold and remains after completion or
abandonment. Unsecured cargo is cleaned up with the closed wreck. Exact required
identity, guard clearance and physical grid support remain enforced. Earlier
accepted private saves preserve their original manifests.

The prior four browser attempts remain useful physical/render/input evidence for
the earlier revision, not acceptance of these changed cargo terms. Recovery05 was
withdrawn from the GPU queue before launching. The new complete controller case
loads optional loot first, retrieves the required container, deposits only that
container, retains and sells the bonus, then returns to play. CPU cases cover
leaving all optional loot behind, full-hold acceptance, selling bonus before
completion, abandonment, identity/privacy, corruption and old-save compatibility.
Final revised checks/build/browser results will be recorded below.

Initial revised focused run:34/36 pass; the two new bonus-sale fixtures used an
unregistered station ID and failed with Unknown station market. Corrected them
to the real station:1 berth; no application or market-policy change.


Revised focused36 individual cases PASS0.971s, zero fail/skip. Full normal suite
`npm test -- --test-concurrency=2` PASS all160 registered files,31.397s, zero
failed/skipped files; this runner reports file totals, not individual-case totals.
Production build05 PASS4.57s,388modules,main-BFvQqjpN.js, existing chunk advisory.
Repo12changed-path check and explicit-origin/dev suggested plan pass; that plan
includes207 inherited paths and is not gameplay certification. The revised
three-case browser batch is ready on the final source below; no pass claimed yet.


## Attempt05 — complete revised recovery passes; guarded fixture paging

Frozen runtime6b43092/build05. Full9.3min standard-Gamepad journey **PASS**:
mission-size notice and named objective, acceptance with no cargo, sampled drive
(66 positions/phases), actual close flight/parking/cabin/ramp/EVA, both tractor
transfers through the real hull openings into supported grid slots, physical
reboarding, sampled inbound drive (53 samples), continuous atmospheric descent,
landing, terminal walk, required-container-only payment900CR, retained original
bonus copper container, actual ordinary sale108CR, result inventory, reboard and
launch. Menu/native tab focus/disconnect/replacement/unsupported held-input checks
pass. Zero application errors/warnings. Chromium151.0.7922.173, AMD860M ANGLE gl,
1440×900 plus390×844 completion. Physical-controller hardware was not used.

Original source/state/PNG/three videos and controller-receipt.json remain in
ignored recovery-05. Selected original images below were inspected and copied
unchanged. They show the named REQUIRED marker, actual beam/grid, readable size
notice, retained bonus and terminal receipt. Adaptive renderer scale is not an
independent FPS/art acceptance.

The second case stopped before departure1.2min: the fixture searched the first
Ship page for weapon-laser, while the actual Pilot interface correctly put it on
page2. The final DOM/trace records the real Next ship systems page control. The
fixture now uses controller input on the actual next/previous arrows for hidden
Ship actions, including switching Combat mode back on after travel. No runtime
or renderer change. Native phone case did not run. Total05:1pass/1fail/1unrun,
10.6min, source hashes unchanged. Narrow06 selects only guarded recovery and
keyboard/native phone; the passed quiet journey will not be repeated for this
fixture-only correction.

The two named authenticated actual-room freight/Atlas cargo regressions also
pass on6b43092 (3.281s). This is not a new full database-suite claim.


## Checked local-base composition before06

Private61c4f08 merges only checked local faction/Pirate003 e25c7d0;
8bb82f3 retains its final delivery metadata2a6e405. The only runtime overlap was
two additive main hooks; recovery, cargo, trading and combat bytes are unchanged.
The package conflict preserves all162 registered normal test files. Full combined
`npm test -- --test-concurrency=2` passes all162 files, zero failed/skipped,
71.945s. Production build06 passes6.11s,395modules,main-Cl0jsdm5.js. The initial
sandbox build could not write Vite configuration in the shared node_modules;
the already-authorized build succeeded. No browser had started for that failure.
Explicit-origin/dev repository check passes271 paths and the suggested plan runs.
These are combined CPU/build checks, not another full quiet gameplay pass.
Narrow06 remains guarded flight and keyboard/native390 actions on this build.
