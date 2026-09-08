# Hush Exchange production record

Builder: delegated Codex pirate-compound agent. Parent garage agent integrates.
Base23ca619. **Development candidate; browser and independent review pending.**
No local integration or deployment claimed by this branch.

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
  [manifest](../../../assets/pirate-props/manifest.json). All geometry/index/UV/normal
  buffer payloads remain byte-identical.512² lossless WebP, three maps per prop,
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
|10 focused balance/survey/market/asset/light invariants|PASS; own test file|
|Normal unit suite before props hook|155 files PASS42.82s|
|Production build after four props|PASS6.46s; existing bundle-size advisory|
|Contributor check|PASS38 changed paths|
|Suggested check plan|Ran against stale remote integration; broad488path stack informational|
|Actual tower renderer, burst survival and retreat|PASS01: Chromium151.0.7922.173, ANGLE AMD Radeon860M/OpenGL ES3.2,1440×900; zero errors/warnings|
|Complete controller / corrected native phone|Pending|
|Independent art, physical controller, FPS acceptance|Pending|

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
