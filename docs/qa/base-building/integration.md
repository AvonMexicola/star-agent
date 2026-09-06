# Materials and construction integration record

Candidate: `feat/base-building`, based on integrated `6f80fc0`. The mainline
integration already contains the current station, equipment and energy effects;
using the earlier visual-fidelity branch would drop those dependencies. This PR
therefore targets `integrate/main-2026-09-06`. No merge or deployment is claimed.

## Scope and test boundaries

The first slice supplies common mineable outcrops on Aeon/Pyre, field processing,
shared material inventory, mainframe authority and eight authored building types.
The roadmap in `docs/design/base-building-plan.md` includes future engineering,
power, progression and Miasma resources; those are not part of the runtime claim.

Three evidence routes answer different questions:

- The actual Gamepad journey lands on Selene, physically exits the hatch, builds
  with finite imported stock and hauls additional materials from ship cargo.
  It uses no movement/placement debug calls. See `controller.md` for the latest
  completed stages and whether the complete kit is covered.
- The Aeon/Pyre material journeys start at explicitly selected deposit poses,
  mine actual finite fields, process only mined ingredients, and spend those
  outputs through real placement UI. They do not establish a full survival or
  travel expedition. See `materials-acceptance.md`.
- `scripts/base-scene.spec.js` loads an explicit valid ten-module saved base to
  inspect all eight assets together, walk into/through its doorway, configure
  mainframe supplies and inspect desktop/phone UI. This is a renderer and physical
  interaction fixture, not evidence of constructing all modules with a controller.

The artist's Blender source, manifest, material maps, studio captures, exact mesh
budgets and geometry tests are documented in `assets.md`. The local preview is
served by `star-agent-base-building.service` at `http://127.0.0.1:5296/`.

## Defects found and resolved during integration

1. The original single-leaf doorway swept outside its 4 m wall and obstructed
   neighboring walls. Opposed pocket leaves now remain within the jambs. Tests
   cover both inline and perpendicular neighboring walls and actual mesh rays.
2. Gameplay showed overlapping construction and equipment hints. Placement now
   owns its HUD; phone placement leaves the aiming centre clear with touch actions.
3. A complete piece could overlap the ship although its pivot cleared the ship
   reservation. Validation now transforms the whole authored envelope into the
   ship frame. Rotation is also applied to rectangular terrain support probes.
4. Flight collision originally tested only the ship's centre ray. It now sweeps
   the ship's actual boarding-layout bounds relative to its seat, with an expanded
   base broad phase covering high structures and long ships. EVA sweeps a capsule
   envelope. Conservative rotated AABBs can stop slightly early, and changes of
   orientation are not swept; these limits are not hidden as full hull physics.
5. The mainframe's authored front initially faced away from the placer. Default
   facing is now toward the player; a live token-coloured display shows actual
   owner, module count, radius and supply status. Polar claim frames have a
   non-degenerate fallback when the player looks vertically.
6. The controller's precisely centred foundation approach found a real curved-
   terrain contact bug: a 24-micrometre difference exceeded the prior tolerance
   for a 0.3 m step. A consistent 1 mm tolerance now permits the intended step;
   a 0.305 m riser still rejects a 0.3 m step budget. The saved-base doorway check
   independently met the same defect at its foundation edge. Both actual browser
   routes subsequently traversed their first step successfully; the complete
   controller-kit route is tracked in controller.md.
7. Pyre changes orbital position and tidal orientation between page epochs.
   Claims now save body-fixed anchors and materialize them in the current frame.
   Pyre outcrop cells, IDs and orientations use that same canonical frame, retaining
   nearby depleted fields instead of regenerating different ore at a base on reload.
   Unknown historical Pyre world coordinates are retained and paused. Malformed
   saved world frames are rejected before restoration, not silently repaired.

## Verification ledger

The broad pre-final unit run passed 67 configured files. After the contact,
collision and persistence fixes, the targeted geometry/navigation/state/anchor
run passed 30 individual assertions. These include real navigation climbing,
remaining on an upper floor, descending, obstruction, save rollback and a one-day
Pyre orbital change. The latest full-suite and browser results are recorded below
when completed; earlier checks are not silently promoted to later source versions.

The first root browser launch could not bind a preview inside the sandbox; the
host rerun rendered the base. A 20-second startup allowance was insufficient for
initial terrain readiness, so startup now uses the established 90-second allowance,
while interactions have short bounded waits and capture failure state. Door-open
state was correct; the next movement stopped at the tiny foundation contact bug
above. No failed/interrupted run is counted as a pass.

Build tooling reports the existing >500 kB GLTFLoader chunk advisory. Playwright's
Node processes also report FORCE_COLOR/NO_COLOR interaction; these are tooling
warnings, distinguished from browser console errors or graphics warnings.

Independent Opus visual review and the fixed-viewpoint performance tour are final
review gates. A passing unit test, asset-author score or software-renderer frame
interval is not a visual approval or a laptop GPU budget pass.

## Completed saved-base renderer and interaction check

The corrected `scripts/base-scene.config.js` run passed: one test, 51.9 seconds
including build/server startup, Chromium151.0.7922.173, AMD Radeon860M through
ANGLE GL (radeonsi krackan1 ACO), 1440×900 and390×844. Zero browser page errors,
console errors or console warnings. The fixture physically presses into the closed
door, opens it with F, walks through, opens the mainframe, enables its buffer,
checks both UI sizes and opens its actual shared supplies container.

The last failed storage check exposed a real dialog ordering error: native
`dialog.close()` dispatches its close event asynchronously, so inventory's disabled-
navigation guard rejected the immediate handoff. A one-shot close callback now
runs after normal input restoration. The focused UI test also enforces that guard
instead of using an always-successful storage callback. Physical storage entry
additionally selects Cargo explicitly even if Equipment was previously open.

At the exterior viewpoint the whole scene reports179 draws /989,254 triangles,
auto renderScale0.85, mean90-frame RAF interval41.76ms. This is not an isolated GPU
timer, nor a full-resolution12ms surface-budget pass. The authored kit's small
mesh count does not waive the whole-scene frame budget. A separate fixed tour
records unaffected and affected world viewpoints without resetting baselines.

Root inspected these actual images:

- [Complete kit in lunar lighting](in-game/base-exterior.png)
- [Open doorway after traversal](in-game/doorway-open.png)
- [Mainframe desktop](in-game/mainframe-desktop.png)
- [Mainframe phone](in-game/mainframe-phone.png)

One preceding test process ended withSIGTERM before reporting completion and left
its two owned preview processes on4296. No cause was established and it was not
counted as a pass. Root identified and stopped only those orphan processes, then
reran the bounded check above. Other agents' previews and the stable5296 service
were preserved.

Two final code-review corrections also landed: malformed null claim/piece entries
now pause construction instead of escaping into fatal startup, and a floor slab
may seat into its two supporting wall tops while duplicate/unsupported floors
still reject. The independent review verified both; actual placement transactions
and malformed-save initialization regressions pass. Floor level selection also
clamps at a whole storey rather than entering a fractional negative offset.

The final broad `npm test` run after the runtime validation, dialog and opening
entry corrections passed all68 configured test files (39.7 seconds, zero failures).
The unit runner counts configured files at this reporting level. The complete
fixed-viewpoint tour exited successfully with zero aggregated browser errors or
warnings; [its measured budgets and comparison limits](tour.md) remain explicit.
The map's renderer counters are stale from the prior world frame; source skips
3D scene rendering while that map is open, so those counters are not modal draw
measurements. The new Build shortcut/entry is now suppressed during the opening.
An inherited mining-tool visibility issue in that cinematic remains recorded.

The independent Opus inspection also reproduced a rotation carry-over defect:
after a quarter-turn on a foundation, wall rotation kept an odd turn index that
the socket calculation ignored. Wall sockets now use the index's half-turn bit,
so either bumper flips the facing for every previous rotation. The regression
checks all three wall types, all four carried rotations and both directions,
including unchanged socket positions. `node --test tests/build-state.test.js`
passes after this bounded correction; the final controller route uses this code.

## Completed independent Opus review

The second CLI session completed successfully on 2026-09-07 local time. Its
assistant messages and final model usage identify `claude-opus-5`; the review
session is `e550d49b-4c1c-4540-a616-343ab915631a`. The exact authored report is
[opus-review.md](opus-review.md), with twelve independently captured images.
The reviewer ran its own production build, saved-base interaction check, fixed
tour and additional placement/recipe/mainframe captures, sequentially on native
AMD ANGLE GL. All completed with zero browser errors or warnings. The first
session-limit attempt remains preserved as history.

Scores are 4 / 4 / 3 / 4 / 3 / 3, averaging **3.5/5**. The visual merge gate is
**not passed**. The reviewer independently reran and verified the wall-facing
fix while writing its report; that correction does not rescore the candidate.
Whole-scene draw budgets and representative frame-time acceptance also remain
open. No merge, deployment or user waiver is claimed.

The remaining visual work includes door animation, visibility transitions at
distance, base lighting, an authored placement silhouette, and clearer display
and scrolling layouts. These are recorded follow-up requirements for acceptance,
not features silently described as finished. Current controller results and
subsequent UI corrections are recorded separately in controller.md.

Two review diagnoses need context: the runtime kit has several authored material
families, although it shares one concrete finish; “one material for all eight”
describes the perceived sameness, not the actual GLB material count. The cause of
different RAF samples between runs was not isolated, so machine contention is
the reviewer's hypothesis, not an established explanation. The review's original
wording and score are preserved.

After the wall-facing and bounded UI corrections, the delivery `npm test` run
again passed all 68 configured test files in 39.3 seconds, with zero failures
(`/tmp/star-agent-base-tests-delivery.txt`). This is the latest broad unit result;
controller and visual acceptance still have their own independent outcomes.

## Complete controller kit, then mining-loop follow-through

The full controller construction journey passed in 10.7 minutes: all eight piece
types (nine placed modules), four physical ship cargo trips, pocket-door and crate
interactions, Equipment-to-mainframe Cargo handoff, buffer transfer, upper-floor
walking and complete claim/container reload. No runtime pose or inventory grants
were used. Its finite imported stock and old 12 kg boxes / 4 kg stacks are stated
in [controller.md](controller.md). The later carrying-balance changes do not
retroactively change that fixture or its measurements.

Cees then reported filling the backpack before finishing a rock and requested
longer mining trips, mining skill and a ship Deposit all button. Typical measured
whole rocks recovered 95–165 kg with the old conversion. New cuts now recover
1 kg concentrate per cubic metre instead of 12, with 48 kg boxes and 16 kg material
stacks. Three complete large common outcrops total 41.235942 kg and fit a starter
backpack with its normal supplies; a fourth requires the second box. Existing
saved cargo and edits retain their values.

Mining XP commits with accepted material and edited density. The inventory shows
levels/progress and exposes **Deposit all resources** beside ship storage selection.
Deposits move every material type in one write, preserving carried supplies,
loadout and XP; full cargo or a failed write retains the entire load. New tests
exercise actual generated whole fields, migration, malformed XP, stale results,
capacity/slot denial, quota rollback and no XP from processing/transfers.

The final broad suite after these runtime changes passes **71 configured files**,
zero failures, 48.0 seconds (`/tmp/star-agent-base-tests-mining-loop.txt`). Read
[mining-loop.md](mining-loop.md) for the measured fields and current mining browser
result; new input/visual evidence is recorded separately. The prior Aeon/Pyre
mining-to-mainframe runs used the old recovery balance and remain historical.
The Opus score also predates this additional inventory UI; no new visual approval
is inferred from unit tests or the earlier review.

Current browser acceptance is complete: **4/4 Deposit all cases** pass controller,
keyboard, 390 px touch, full-ship rollback and reload; **4/4 building UI cases**
pass with 16 kg stacks; actual mining recovers 0.1582977785 kg and saves
15.82977785 XP, shows the skill bar and preserves XP/cargo/cuts through reload
(58.2 seconds, zero browser errors/warnings). Root inspected the desktop deposit,
phone deposit and actual mining-skill images. These are functional and layout
checks; the independent visual merge gate remains open.
