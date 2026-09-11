# Field cutter production record

2026-09-08. Author implementation, native rendering and the full gameplay journey
pass on `d1078be`. The final portrait framing and combined gameplay follow-up
passes at `d666490`. Local integration at `0abc2f7` is served and verified;
independent acceptance remains pending.
See the [brief](../../briefs/field-cutter.md).

Current exported Mk1: `dc078fe73e0d46d32bbdf8a63db82f41231454178297ae6104d62db0cbece967`,
9,444 triangles, 915,800 bytes, five draw primitives, three 1024² WebP maps.
Normal and ORM reuse the existing handheld textures; the yellow basecolor has a
distinct cache identity. Named body/head assemblies and common mount survive
material batching. Editable Blender source and original user reference are kept.

Author01 exceeded the 10k geometry limit (12,196 source triangles); author02 was
also rejected by the binary packer (10,308 triangles / 992,904 bytes). Author03
reduced ring/bearing and bevel tessellation, preserving the three-pod silhouette.
The packer removed 192 zero-area export triangles and repaired no winding.
Blender exited 0; optional local extension `cattrs` and MeshOptimizer availability
warnings were retained, plus the inherited multi-image sampler warning. No
extension-dependent export or compression was used.

Four affected unit files pass in `assets/field-cutter/.staging/unit02.log`:
actual exported PBR/UV/normal/AO/budgets; 24 rotor phases, nine clear aperture
rays per phase, body/shaft radial and axial clearance; per-player clone isolation;
acceleration/coasting; actual equipment heat gate and holster. The first test
attempt began before packing completed, and an equipment assertion sampled its
world origin before the first update. The sequenced rerun samples after normal
initialization; runtime coordinates were not changed to satisfy it.

The supplied medical GLBs are preserved separately under `assets/medical-items`.
They are not evidence of implemented medical-use animations.

Combined checkpoint `534907b` retains the checked projected terminals and builder
phone refinement. All 156 normal test files pass with two CPU workers (68.46 s),
and the production/native-viewer build passes (76 s under shared memory load).
Repository checks pass; the suggested plan is retained in ignored
`.staging/check-plan02.log`. Shared helper claims transferred from SA-TOOL-001
to SA-TOOL-002 within the same parent; the builder retains its dedicated modules.
One serialized combined browser job covers both tools without parallel GPU jobs.

The checked, locally integrated freight dependency `f294a98` is included in
`d1078be`. The test-list conflict retains both owners' files. All 157 normal
test files pass with two workers (63.87 s, `.staging/all-unit03.log`), and the
combined production/native-viewer build passes in 36.39 s
(`.staging/production03.log`). Repository checks and the suggested plan pass;
the latter selects checks and does not establish gameplay acceptance.

Combined02's native renderer case passes: Chromium 151.0.7922.173, ANGLE AMD
Radeon 860M / OpenGL ES 3.2, 1440×900. The actual cutter renders in five draws
with 9,444 triangles and three textures. Each medical prop is one draw with
three textures (bandage 762 triangles; injector 534). No browser errors,
warnings or failed requests were recorded in the native case.

Author review inspected the [new cutter](native-mk1.png), [grips](rig-grips.png),
[bandage](prop-bandage.png) and [injector](prop-stim.png). The fixed emitter,
receiver finish and both grip contacts are visible; the medical meshes retain
their original geometry/UVs. [Previous cutter](native-before.png) and
[rotated cartridge](native-head-phase.png) are isolated renderer views, not
gameplay proof. Physical controller and independent art acceptance are separate.

## Actual gameplay receipt

Combined02 passes all three selected cases in 2.9 minutes with stable source and
GLB hashes. The cutter's 1.2-minute controller journey starts at the normal
development Selene arrival (seed 7291), lands Nomad, walks out through the hatch,
aims and approaches the actual deposit, equips the cutter, mines, opens the
collected-material inventory and returns to play. Head phase changes while the
actual beam is active, then speed reaches zero after release. The recorded rock
revision advances from 0 to 11; the pack grows from 0 to 0.419 kg over controller,
keyboard and native CDP touch cuts. Held-trigger modal/focus/disconnect gates,
holster/re-equip and keyboard/touch release all pass. No pose or action callback
is injected. No application errors, warnings or failed requests are recorded.

Author game review confirms the beam starts at the actual fixed emitter and
meets the mined surface. The original phone frame clips most of the rotating
head; a portrait-only mount adjustment brings it toward the centre and farther
from the camera. Its production build passes in 10.33 seconds
(`.staging/production04.log`); the focused gameplay/phone follow-up passes below.
The earlier passing builder/native cases are not repeated for this adjustment.

Combined03 at `d666490` includes the checked Garage `83e10ae` and validates the
final mount in the complete controller/mining/keyboard/touch journey: one case
passes in 1.3 minutes, with zero application errors, warnings or failed requests
and stable source/asset hashes. All 158 combined normal test files pass in
72.02 seconds; final production/native-viewer build passes in 45.03 seconds.
Repository checks pass, and the suggested plan is retained in `check-plan05.log`.

Author review of [actual mining](game-mining.png), [collected inventory](game-inventory.png)
and [final phone framing](game-phone.png) confirms the emitter/beam connection,
collected material and visible head. The phone's existing crowded HUD remains;
this change adjusts tool framing without redesigning the HUD. No further browser
run is needed for documentation-only delivery changes. Raw final receipt:
`assets/field-cutter/.staging/qa-combined03`.

## Local integration receipt

The existing `dev/all-features` preview fast-forwarded from `83e10ae` to
`0abc2f7`. At 20:55:05 UTC on 2026-09-08, the frontend on 5178, its proxied
API health route and the direct API on 8087 all returned HTTP 200. Served hashes
match all four new GLBs and five affected source modules; all 15 guarded source,
model and test paths match the final browser receipt. The development model
revision map contains the new asset hashes. The [curated receipt](local-integration.json)
records these checks.

The first verification attempt looked for the revision map inline in
`src/model-cache.js`; Vite serves object-valued development defines through
`/@vite/env`. The unchanged config timestamp had already refreshed the map.
The corrected verifier reads the actual development map and passes without a
second refresh. The failed verifier log is retained with the successful raw
receipt in ignored `test-results/handheld-delivery/0abc2f7e89e4/`.

The exact 519,025-byte dirty shared journal, config bytes and three existing
service identities were preserved. No backend protocol, database or schema
change accompanied this merge. Independent review, physical controller testing,
performance acceptance and public deployment are not claimed.
