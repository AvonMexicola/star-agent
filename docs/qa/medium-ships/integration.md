# Medium ships integration record

Status on 2026-09-08: isolated implementation checkpoint; not browser accepted,
independently approved, integrated into shared development, or deployed.

Stratum is an 18 m medium miner with two actual articulated barrel origins, a
40 m cutting range, a 120-second battery and 30-second recharge. Accepted voxel
worker results atomically save ore into its separate 384 kg bin. Its 32 SBU
freight and 240 kg supplies remain separate inventories. Gannet is a 24 m
transport with 128 SBU freight, 960 kg supplies, a 5.8 m clear vehicle bay and an
ordered rear hatch/elevator. Its carrier adapter follows all four Burrow wheel
contacts, vetoes straddling movement and secures the vehicle for flight.

Both have fleet/development selection, authored access, canonical gear, physical
cabin interaction, four live MFDs and named propulsion origins. The new ships
are limited to solo/development use; no new multiplayer hull or mining authority
is claimed. The normal game remains responsible for ship motion, collision,
surface sampling, input routing and inventory publication.

## Source checkpoints and checks

The integration began on development0a18574, consumed committed tractor638a5e4
and fleet43fadf1, and preserves the new 64 m Atlas/carrier contracts. Stratum
asset d77a015 and Gannet8b5ef41 were copied only from verified frozen allowlists.
Gannet geometry07/98a9eea fixes actual roof/cassette gaps and hatch self-collision;
geometry08 removes its centre mullion and geometry09/12d8152 clears the inner MFD
faces and joins their backing supports. All twelve current Gannet asset tests
pass. Stratum clear-windscreen08aa2b1 removes only its 36-triangle centre mullion;
all ten asset checks pass. Both studio builds pass; this alone establishes
bundling, not image or shader correctness.

Seventeen focused integration/mining cases pass, including actual GLB barrel
transforms, large-coordinate cuts, self-occlusion, twenty-one input/safety gates,
real worker/store/save-failure behavior, persistence, full rover lift movement,
ground exit and reverse loading. A later independent review correction extends
the existing seven medium cases with the real EVA aisle and power restoration;
all seven pass. The development-enabled production build passes. No test
threshold, dependency or warning limit was weakened.

The first full configured unit run reports **1,005/1,010 passed**, with five
failures in older Atlas pad/opening/station fixtures. Four reproduce on pristine
fleet43fadf1; the saved-Atlas opening file is unchanged from that dependency.
After consuming the steward's checked fixture follow-ups79bf96e/fb472725, all
22 adjacent fixture checks pass. The next complete configured run passes
**1,013/1,013** (44.360 seconds, zero skips); the original failure is retained. An earlier three-failure SBU run also reproduced on43fadf1; after
consuming the owner's f3312c correction, all31 SBU/station/medium cases pass.

The checked fleet successor **5f63893** is merged at **eb4a396**, including
protocol5, finite station markets/security and hands-free hub, Atlas ground ramps
and the named meadow start. Semantic conflicts preserve medium storage/input,
Stratum fire routing, rover Menu9, mechanism power and both station/ship touch
controls. On that union, **1,057/1,057 normal tests pass** in35.615 seconds;
multiplayer reports **187 passed, two PostgreSQL-dependent tests skipped**, zero
failures in7.080 seconds. Repository checks pass. These are local CPU checks;
no database migration or service promotion was performed by this lane.

The final eight medium invariant cases also exercise actual whole-hull departure
and return/docking across all20 tilted station bays, with closed-door rejection.
The 40 successful finite journeys establish those paths, not arbitrary docking.

## Findings retained and corrected

- First Gannet lift descent hit its own supporting platform with a rover body
  corner. Walking support now distinguishes its current deck top from an
  underside approach; full descent, terrain exit and reverse loading pass.
- Independent review found new cabins omitted from the touch controls,
  missing exterior EVA solids and a power-off interaction that latched the
  Gannet mechanism off. Eligibility/labels, exterior solids and canonical
  Navigation power synchronization were corrected.
- Whole-part fairing boxes then blocked a physically empty aft EVA aisle.
  Those conservative boxes are split around the authored clear room volumes;
  measured walls, floors and gates remain solid. Independent replay passes
  113/113 EVA steps,326/326 Gannet walking steps and199/199 Stratum steps, while
  the actual drive obstacles still block. The actual Navigation vehicle branch
  synchronizes mechanism power before its early return on191 sampled ticks.
- Cees prohibited central cockpit struts. Both new assets now omit their centre
  mullions and retain their glazing and functional layout. Burrow's exact
  44-triangle removal is committed in d2f7eb0 and consumed here. Its paired native
  comparison passes at the same seated eye; the existing PR66 contains the
  [before/after evidence](../mining-rover/windscreen-open/README.md).
- Full medium flight touch controls add translation, brake and launch/landing.
  Native canvas drag uses tracked pointer coordinates, owns its gesture, and
  cancels on pointer loss, focus loss and actual dialog transitions. Review found
  that an unmoved held pointer could survive a menu round trip; the final dialog
  observer closes that path and requires a fresh press.
- Occupied Burrow now routes controller Menu9 before its vehicle early return,
  matching the steward's checked cfe69b7 fix. Ship mining also publishes its stopped
  state immediately on focus loss, when the animation loop may be suspended.

- First Gannet controller gameplay reached physical cabin/rover boarding, hatch
  opening, lift lowering and four-wheel terrain exit, then failed after its turn:
  the observed mineral required yaw−0.4403 beyond the real cutter limit±0.4.
  The fixture now extends the physical5m-radius arc toward the observed mineral;
  all eight50–150ms CPU route planners pass, including reverse loading. The
  failed native receipt remains; actual mining/return/flight was not reached.
- The same native view showed the unanchored rover chase camera clipping into
  the carrier. Its existing collision clip now applies whenever a ship clipper
  is present. The captured-pose actual-GLB probe shortens the obstructed boom by
  2.022m; actual native rerun remains pending. Gannet pilot FOV changes52→60 at
  the unchanged seated eye to include the outer flight MFD text.
- Independent input review passes15 source-extracted event cases, including
  stationary held-drag cancellation through the actual dialog observer, plus10
  actual mining safety cases. See [the bounded review](input-review-01.md);
  this does not replace native keyboard/touch gameplay.

Read-only review receipts, original failures and source hashes are retained in
`/tmp/star-agent-medium-review`. Build/unit/dependency receipts use
`/tmp/star-agent-medium-*.log`. Asset records retain their own earlier failures.
These finite CPU checks do not certify continuous arbitrary collisions, native
input, full pressure simulation, image quality or performance.

## Remaining acceptance

Corrected assets must render with their actual textures/shaders and clear
settled pilot views. Complete controller, keyboard and native-touch journeys
must cover landing/flight, boarding, real extraction and saved ore, and physical
rover unload/reload/carry/landing. Check full cargo and actual station fit,
held-input suppression, source stability and console diagnostics. Independent
art review and the contributor checks precede a review PR and steward handoff.
The one shared GPU queue is coordinated in HANDOFF. Stratum's first desktop
studio run captured twelve views but failed on one HTTP404; phone was not run.
The isolated HTML now uses an inline favicon and failed-response logging includes
URLs; the corrected native rerun is pending. The independent static image
[review](stratum-native-review-01.md) fails: mean3.26, silhouette3.4 against the
brief's4.5 target, materials2.6. An authored hull/material refinement is active.
Motion, portrait and actual gameplay remain pending for Stratum. Gannet's
geometry09 native studio passes1/1 in26.3seconds, yielding13 native desktop and
portrait screenshots with zero diagnostics. Portrait was a resized desktop
pointer context, not native touch. Its [independent image review](gannet-native-review-09.md)
fails: partial static mean3.08, silhouette3.2, materials2.4. A later source audit
found an actual exported UV atlas-row inversion behind the unexpected gold floor
and trim; a corrected mapping/form revision and physical bay diffusers are being
authored. The first controller attempt's legitimate aiming-route failure and
runtime camera/lighting findings above remain recorded. No full gameplay pass
or final art approval is claimed.

Historical development build03 passes in6.01 seconds (`main-Dw8Hai8Z.js`), including
the final drag observer added after the full unit run. Existing chunk-size
advisories remain recorded. Its isolated preview5582 uses a disposable in-memory
test API8582; shared services, databases and the user's5596 tab are untouched.

Build03 predates the wider pilot FOV, camera fix and checked fleet merge. The
final authored revisions and attached powered cabin lighting require a new build
and actual native gameplay acceptance.

## September 8 follow-up checkpoint

The checked fleet union is retained. Stratum Art02 (`b2660a8e`,41,048 triangles,
3,407,756 bytes) and Gannet Art10 (`ca49eb99`,41,302 triangles,2,251,080 bytes)
are integrated, with the current clear-view Burrow `831b9569`. Forty-one final
asset/runtime checks pass, and the actual-mesh lamp probe verifies nine powered
fixtures and nineteen unobstructed room-light paths. These are finite CPU checks.

Native isolated Stratum views pass both desktop and phone cases in33.3 seconds;
Gannet passes its desktop/resized-portrait case in29.5 seconds. Original images,
video and diagnostics are retained under `/tmp/star-agent-stratum-native-art02`
and `/tmp/star-agent-gannet-native-art10`. Both use Chromium151/ANGLE AMD860M
and record no errors or warnings. Gannet portrait is a resized pointer context,
not a native-touch gameplay pass. [Independent Gannet Art10 review](gannet-native-review-10.md)
still fails: static mean3.62, silhouette3.7 against4.5. The incorrect gold material
mapping is visibly corrected; primary hull forms and surface finish need another
pass. Hatch/gear motion was off-camera, so its motion score remains unassigned.
Stratum's independent Art02 review is pending.

The first actual Stratum controller journey used source `7664b19`, production
build05 `main-D-Ls_xay.js` (build4.79 seconds), and the exact Art02 GLB. It reached
Y landing with deployed gear, continuous ramp egress onto canonical terrain,
physical reboarding, relaunch and a26m flight approach. It failed before mining:
the fixture read browser localStorage while this explicit development flight
uses an isolated Map-backed practice save. The original2.2-minute failure, video
and screenshots remain at `/home/cees/projects/.medium-ships-qa/stratum-controller-01`.
Source hashes were stable; no page errors, warnings or failed HTTP responses
were recorded. Ore extraction, transfer and interruption gates were not reached.

The correction exposes actual adapter bytes through a read-only debug getter,
with an explicit storage-kind label. Revised fixtures must parse those committed
practice bytes independently. This establishes serialization within the practice
session, not retention across reloading a development flight. The original
pilot screenshot also exposed cropped lower MFD rows and a mining panel covering
the port display; a fixed-eye camera tilt and compact controls are under native
verification. No full six-input-route or final visual acceptance is claimed.

A separate independent bounded runtime review found Fleet reporting a ready
Gannet despite a failed Burrow spawn. Commit `7664b19` prepares the rover before
selection and reports failures according to the actual selected hull. Six
source-extracted success/failure cases and a real callback switch-away/retry
sequence pass. This is callback evidence, not a full physical gameplay pass.
