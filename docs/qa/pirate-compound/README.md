# Hush Exchange production record

Builder: delegated Codex pirate-compound agent. Parent garage agent integrates.
Base23ca619. **Checked development checkpoint, integrated locally at `c7b09ab`.**
Runtime/assets2c2f2fb49fcfbfc65bcfbc4bf012d78d66491375; final browser fixture201588c.
Formal art, physical-device and performance acceptance remain pending. The parent [local integration receipt](local-integration.json) verifies the served
combined hooks, five new asset hashes and healthy APIs. No public deployment.

Cees requested a secret pirate trading/PvE compound and a reduced station turret
on a cylindrical tower. Later supplied Crimson generator, floodlight, workbench,
crate and requested a shade sheet. Four GLBs were present and identified from the
[actual CPU intake render](../../../assets/pirate-props/review/intake.png); the sheet
filename is pending user clarification. Ground pirate combat is a separate owner's
pending module and is not implemented by this compound task.

## Source and contracts

- Original cylinder: [source/manifest](../../../assets/pirate-tower/manifest.json),
  Blender5.2.0LTS,4551tri/4draws/357384B, SHA39799a0d054eecb50c281fc8b6ee12a4a782d9be4382ca20436b236a81148cf9.
- Reuses exact checked `public/models/station-defense.glb` at0.35 scale, all named
  yaw/pitch/recoil/muzzle anchors preserved. Native geometry and texture identity
  remains owned by the station asset record; its earlier visual gates are not
  inherited as acceptance of this placement.
- Crimson user source hashes and embedded texture derivatives are in
  [manifest](../../../assets/pirate-props/manifest.json). Positions, indices, UVs
  and valid authored normals remain byte-identical. Six zero-length normals each
  on the lamp and workbench are repaired from isolated nondegenerate face winding;
  exact exceptions are recorded and every other non-image byte is verified.
  512² lossless WebP, three maps per prop,
  native GLTF `EXT_texture_webp`; no decoder service/runtime dependency.
- Site survey uses canonical Selene surface functions; both raised kit slabs have
  measured support under8m piers, with real0.6m kit ramps to terrain. The outer
  apron has its own protected claim centred on the physical pad.
- Object-local collision trees and render frames retain JSdouble positions and
  subtract the camera origin before GPU uploads. Existing standard materials
  supply log depth. Tripod lamps share the global six-light/two-shadow pool.
- Tower:300m warning/180m engagement/220m disengagement;5s initial warning,
  1.2s visible charge,3shots×18damage at0.75s intervals,5s burst rest. Flight, landed pilots and aboard cabin occupants are targets;
  actual exterior on-foot approach is safe. Shared combat shield/hull/effects/recovery adapter;
  each full-health supported ship survives a complete54damage burst with hull intact.
- On-foot tower isolation unlocks the existing finite-stock trade UI this session.
  Market stock persists in the existing atomic solo commerce save and is seeded
  only once. Public settlement catalog remains four; a weak relay guides discovery.

## Checks and proceedings

| Check | Result |
| --- | --- |
|15 focused balance/physics/market/asset/light invariants|PASS0.463s on frozen runtime2c2f2fb; three focused combat files PASS3.403s|
|Latest author normal unit suite|155 files PASS59.449s on ce033b9, before the narrow normals/cooldown changes|
|Parent private combined normal suite|159 files PASS48.325s on73a7be8, including runtime2c2f2fb; no shared integration implied|
|Production build|PASS in each actual browser launch; existing bundle-size advisory|
|Contributor check|PASS; plan reran against origin/dev/all-features|
|Actual tower renderer, burst survival and retreat|PASS01: Chromium151.0.7922.173, ANGLE AMD Radeon860M/OpenGL ES3.2,1440×900; zero errors/warnings|
|Complete controller approach/isolate/buy/sell/result/return|PASS09,3.6min; actual Gamepad movement after explicit developer approach|
|Keyboard / native phone service and commerce / Resume|PASS09,47.7s; initial390×844 mobile/touch context, controlled nearby poses|
|Repaired-normal HDR comparison and final art capture|PASS09,1.2min:0 nonfinite RGB with repairs,102 after restoring only original six zero normals|
|Parent combined garage/pirate hooks and own captures|PASS04,2.0min on16c73a5/runtime73a7be8; defect review confirms clean lamp|
|Independent art, physical controller, FPS acceptance|Pending|

Browser09 completed all three remaining cases in5.7min on clean201588c, with the
runtime unchanged since2c2f2fb. Browser151.0.7922.173, ANGLE AMD Radeon860M
Graphics/radeonsi krackan1 ACO OpenGL ES3.2; desktop1440×900, phone390×844.
Every application error/warning list is empty. The production build passed;
existing Vite chunk-size, test-runner colour and private API SMTP advisories are
not application console diagnostics. One worker, no retries, no backend change.

The full controller route lowers the gear, physically lands on the large pad,
leaves the chair, opens the hatch and walks down the pad ramp. It crosses239m of
canonical terrain and enters through the supported core ramp, isolates the tower,
walks around the actual tripod collider and enters the exchange. It buys one ice
SBU (stock24→23, credits1500→1453), views that crate in Cargo, sells it back
(stock24, crate removed, credits1482), and walks outside. Holding RT across modal
close, actual tab blur/focus, disconnect/reconnect, device replacement and
unsupported mapping keeps input disarmed until neutral. No pose or action method
is injected after the explicit developer start. This is injected standard Gamepad
evidence; a physical controller and phone were not available for this check.

Final lamp comparison captures the actual half-float scene target at1440×900,
ROI[850,190,210,300]. Corrected data produces0 nonfinite samples; temporarily
restoring exactly six original lamp zero normals produces102 and the same black
rectangle; restoring repairs removes it again. This establishes the bad normal
data as the cause in this renderer. Both source originals remain unchanged.
Author inspected the final yard, workbench, overview and control images; parent
independently captured and inspected the same yard on the combined build. These
are scoped defect reviews, not a scored QUALITY art acceptance.

Curated unchanged images: [compound overview](compound-overview.png),
[Crimson work yard](crimson-work-yard.png), [workbench](crimson-workbench.png),
[generator](crimson-generator.png), [controller Cargo](trade-cargo.png),
[return to play](returned-to-play.png), and [native phone Cargo](trade-phone.png).
The [invalid-source-normal comparison](invalid-source-normals.png) and
[initial excessive light pools](initial-glare.png) retain the visible failures.
Generator and initial-glare images are04 and01 respectively; all other curated
images are09. Exact commands, integration boundary and limitations are in the
[checked handoff](handoff.md). Raw logs, screenshots, state JSON and failed videos
remain in ignored `test-results/pirate-01` through `pirate-09`; they are not copied
as generated test reports into the repository.

## Historical failures and corrections

The following entries preserve the state at each attempt. Their pending checks
are resolved by the final09 results above unless a limitation is stated there.

Retained failures in ignored `test-results`: tower export01 exceeded10k/1MB
(16839tri/1.41MB), corrected hidden bevel/bolt tessellation in02. Restricted Vite
cache write EROFS rerun using approved build escalation; no runtime fix. First
focused test expected idle after two retreat ticks; actual warning phase correctly
reset its fresh5second timer, assertion corrected. Contributor check found Blender
backup; source-specific ignore added, backup retained locally. Python Pillow was
unavailable; derivative builder uses installed ImageMagick instead.1024albedo
lossless derivative exceeded1MB;512lossless variant respects shared prop budget.
CPU intake render completed5m53s with two CPUthreads under shared-machine load;
cleanup request arrived after completion and stopped no process. It is an intake
image, not game-renderer or performance evidence.

First browser guard attempt deferred before launching because Transport04 acquired
the GPU during approval. No compound browser startup or gameplay pass occurred.
Browser01 ran after a fresh host executable/argv guard; raw evidence remains in
`test-results/pirate-01`. The tower case passed in1.1min: actual Nomad hull240
remained intact, shield180→126 after exactly3shots, retreat prevented further fire.
Native phone failed before interaction because the controlled-pose fixture called
`.copy` on a pre-landing null ship position; corrected fixture assigns the vector.
The first overview was reviewed by both author and parent. Two short tripod pools
were too bright: add bounded optional per-fixture intensity/range to the existing
shared pool, preserving mast defaults, and use90cd/28m for the short tripods.
This lighting correction awaits its actual rendered comparison. Six additional
Crimson crates group the workbench and cover without blocking the known approach.

Final unit run04:1178/1179 individual checks passed; the sole failure was inherited
model-cache temporary-file write errno122 from the host `/tmp` quota. The exact
failed file passed when rerun with task disk-backed TMPDIR, without source changes.
Original failure retained. The latest focused pirate/light files pass after the
lighting correction. Contributor check and plan reran against updated remote
`origin/dev/all-features`:40 changed paths, no broad unrelated stack.

Browser02 on d32b8a3 completed actual controller landing and cabin walking. The
helper stopped at ship-local(-0.146,2.75,2.814), within its22cm tolerance, where the
existing side-specific cargo interaction correctly opened storage. The revised
physical waypoint(0.2,2.75,3.55) checks the actual hatch hint before activation.
No ship navigation or reach rule changed. Instancing diagnostics in this real
run report412 source static draws→19 instance draws within the compound. Final
same-camera performance and complete route are still pending.

Only readonly wall/floor/roof/ramp render parts are instanced, in claim-local
metres. Original collision, doors, lights, displays and transparent pieces remain
independent. Parent source review required matching effective material values
and texture identities instead of labels; corrected and tested with different
colours, roughness and texture maps, including a guard against pixel encoding.
Bastion source hash verified8d0dcbb6395479ad083cd609217833b97c74008acdd15b72ed9182ced46b64ae.

During the03 queue, deeper source inspection found a real collision initialization
error: world claims had been supplied to the player-save-validating BuildSystem
constructor. It rejected that content, so prior controller landing was on terrain;
prior physical-pad assumptions are invalidated. The fix follows the checked normal
settlement pattern exactly: construct from empty state, then supply readonly world
claims outside player save authority. No player validation was weakened. Actual
BuildSystem invariants now prove both claims exist, the large landing surface is
accepted, walls stop the walking capsule, the exchange door is traversable, and
both ramp runs continuously support physical0.1m walking steps. Twelve focused
tests PASS in0.726s (`test-results/physics-01.log`). Live03 must verify this correction.
The preceding full155file suite passed62.803s on4b63505 before this correction.

Browser03 on the corrected collision runtime5f95b44 physically landed on the pad,
opened the real hatch, exited the ship, crossed the outer apron and descended its
supported ramp. The long terrain segment failed: the test helper independently
clamped camera-local X/Z, changing the desired vector direction. It drifted back
towards the pad side. Normalizing the vector before transforming to camera space
preserves the requested direction; no game movement or timeout was changed.

Full normal suite07 passed all155 registered files in50.575s on5f95b44, with a
disk-backed TMPDIR. Production build and contributor check passed. Browser04's
tower case passed in1.4min with the corrected collision, reduced tripod lighting
and grouped crates. Actual Nomad hull240 stayed intact, shield180→126; retreat
prevented additional fire. All application errors/warnings were empty. The same
overview camera shows corrected light pools. The warm five-second RAF sample
reported29.3ms median/31.7ms p95,773 draw calls including shadows and2,160,279
triangles at0.85 scale in1440×900 (render1224×765), Chromium151.0.7922.173,
ANGLE AMD Radeon860M/radeonsi OpenGL ES3.2. The first overview snapshot had2145
draws; only the latest has a comparable duration sample. Project frame/triangle
budgets remain unmet; these are development measurements, not performance acceptance.

Both author and parent inspected04's tower, yard, generator and locked exchange.
Lighting glare was corrected, and crate/bench contact reads clearly. One perfectly
black upright rectangle obscures the near tripod in the work-yard frame; it is
absent from the source intake. Its actual scene source remains under diagnosis,
so that frame is not accepted. Native phone04 successfully isolated the tower,
opened the exchange and bought one SBU of ice with actual finite stock decrement.
It then failed because a Cargo selector matched both the hidden inventory dialog
and visible trade dialog. The selector is scoped to the trade dialog for05.

Parent garage integration review found Burrow's occupied cabin uses walk mode
with insideShip=true.6ba6611 adds a shared ship occupancy predicate explicitly
excluding roverOccupied, used by targeting, external damage and destruction.
The actual flag combination resets a burst and cannot damage the parked carrier;
real landed/ship-cabin occupants retain targeting. Focused pirate, space-combat
and momentum files passed in0.679s. The pending Sentry vehicle contract has not
been consumed. Formal independent art review requires the reviewer's own captures;
parent inspection of author frames is recorded as defect review only.

Browser05 reached the actual isolator by controller and disabled the tower. The
next fixture segment at z=-8 crossed the second tripod's real foot, stopping at
local(16.236,6.791,-7.935). Actual GLB triangle collision now proves that rejected
lane is blocked and the revised z=-10 lane is clear. The complete journey remains
pending. Native phone was skipped by the first-failure limit.

Browser06's diagnostic disproved the embedded-emitter hypothesis: the same lamp
rectangle and102 non-finite RGB samples remained after moving the source in front
of the casing. The physical emitter clearance is retained, but it is not a fix
for this artifact. Raw half-float HDR samples and before/after images are retained.
Subsequent independent CPU scans by both author and parent found six zero normals
on the lamp (11–13 and1322–1324), plus six on the workbench (317–319 and1297–1299).
Each set consists of two opposite-winding, nondegenerate triangles with isolated
vertices. The derivative builder repairs only those twelve vectors; originals
remain untouched, other non-image bytes are identical, and all runtime normals
now have finite unit length. A signed-negative-zero assertion failed first and
was corrected to treat both IEEE zero signs as zero; the full14 focused checks
then passed in0.557s. The upcoming renderer comparison temporarily restores only
the old six lamp normals to test causality. Native/controller now precede this
diagnostic so it cannot repeatedly skip those independent journeys.

The last complete normal suite passed all155 files in59.449s on ce033b9 before
the isolated normal derivative repair; contributor and plan checks passed.

Runtime2c2f2fb also fixes a source-review finding: losing line of sight or aim
during the five-second burst rest must not skip that rest. The rest timer now
finishes before a fresh1.2s aiming charge. A focused invariant proves the complete
rest plus charge even when the pilot turns or moves behind cover. Fifteen own
invariants pass; the three focused pirate/combat/momentum files pass in3.403s.
Parent privately composed this clean frozen runtime with checked Garage,
Transport and Handheld at73a7be8; all159 registered files passed48.325s. Shared
integration remains gated on the browser journeys below.

Browser07 passed keyboard and native service isolation, then found that resizing
a desktop context to390px does not create a coarse pointer: the normal mobile
Open trade action correctly remained hidden. The phone test now creates its
390×844 mobile/touch context before application startup and asserts actual coarse
pointer capability. Browser08 then passed visible Open trade, actual purchase,
finite stock24→23 and Cargo1/6SBU. Its final close selector targeted the hidden
standalone trading header inside the shared Pilot Interface. Fixtureaac75db uses
the actual visible Resume button; no runtime input or dialog rule changed.
Both attempts retain images, JSON, errors, video and runner logs. Controller and
HDR cases were skipped by the single-failure limit and are still pending.
