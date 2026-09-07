# Handheld Blender and material pass

Integrated development pass from `art/handheld-tool-pass`, based on checked tractor `b1ed035`, wildlife `20e9f1b` and player-performance
`8552d44`. Final browser-checked runtime/export is `a50c060`. This is a builder's quality check and
local development checkpoint, not independent visual acceptance or public deployment.

## Measured exports

| Asset | Triangles | GLB bytes | Draw primitives |
| --- | ---: | ---: | ---: |
| Laser rifle | 9,611 | 917,060 | 3 |
| Sidearm | 2,404 | 315,472 | 3 |
| Mining cutter | 7,868 | 771,980 | 4 |
| Cargo tractor | 5,164 | 545,768 | 3 |

Three authored1024² WebP maps, shared between equipment assets; estimated16MiB
RGBA+mip residency. Exact hashes, bounds, axes, hand/muzzle coordinates and source
paths are in `assets/handheld-tools/manifest.json`. Individual editable Blender
sources and rebuild scripts are retained. The character builder now preserves the
independently authored rifle instead of replacing it with its historical UV-free
stock-fitting output.

## Checks and correction record

- Baseline three props: no UVs, five to seven draws; tractor mode reused cutter.
  Existing rifle stock was already shortened and its fit was preserved.
- First atlas used independent pixel grain and cost818,172 bytes for maps alone.
  A repeated micrograin reduced this to118,830 bytes without enlarging textures;
  no prop budget exception was taken.
- First Blender export dropped contact colours because they were not wired into
  the material node graph. Set explicit active vertex-colour export; the shipped
  GLBs now contain `COLOR_0`, checked in the binary and respected by the loader.
- Export warning about multiple texture nodes applies to the shared ORM sampler;
  all three nodes use the same filtering/wrapping. No missing UV warning remains.
- Initial equipment contract suite correctly flagged the new sixth item and its
  non-firing shot kind. Updated the equipment contract to include the tractor and
  explicitly keep cargo as its beam authority. Subsequent focused42checks pass.
- Shipped GLB/UV/normal/PBR/hash/budget/anchor assertions, texture reuse/vertex AO
  preservation, actual expedition rig fitting and tractor non-firing checks pass.
- Full unit suite:880passed, zero skipped/failures,39.1s. Production build passes;
  inherited large-JS-chunk advisory remains. Repository/whitespace checks pass.
- Repository intake first caught an invalid multi-part task ID and `.blend1`
  backups. Task is SA-ART-001; owned backups removed and builder disables future
  backups. The previous cargo task retains the same owner's mining hook claim.

- First browser fixture's launch command used the config directory; explicit root
  CWD corrected this before Chromium started. The first renderer check then found
  only two maps: substring detection matched `orm` inside `normal`. Packing now
  derives channel identity from actual glTF material slots; exact source WebP bytes
  are asserted for each slot. Original failed result is retained in browser-02.log.
- Geometry audit removed43 microscopic/zero-area rifle triangles and48 cutter
  triangles at <=1e-10 square metres, and repaired one rifle triangle winding.
  This cleans boolean tessellation; it is not silhouette decimation. Others had
  none. Current counts above include cleanup, recorded in the measured manifest.
- Reconciliation with the live player-performance source initially truncated two
  merge tails and failed module parsing. Restored complete files from the three-way
  source; kept cached aim vectors with the tractor's tool offset, and retained the
  cargo-held fire guard with optimized player iteration. Final combined887units
  pass in40.0s. No shared application served either failed candidate.
- Multiplayer combined run:121passed, two existing opt-in SQL cases skipped; its
  automatic cargo SQL setup failed in `/tmp` with PostgreSQL disk/quota53100.
  Writable task TMPDIR exposed missing generated Prisma files in this new checkout.
  Generated the declared local client, then all8cargo server/actual SQL tests passed
  in2.8s, including detached-crate reopen. Stopped only owned failed fixtures;
  shared5178/API8087 and the existing account database were untouched. Missing
  generated client failures and an initially wrong script name remain in logs.

## Final browser and appearance check

All4final cases pass on `a50c060`,3.4minutes, Chromium151.0.7922.173,
ANGLE OpenGL on AMD Radeon860M. No page/console errors. Recorded viewport1440×900,
phone390×844, isolated HDR canvas1000×700. This is rendering/count evidence, with
no frame-time or hardware-controller claim.

- Full Nomad2SBU controller route57.3s: physical cabin approach, menu equip,
  RT beam movement, modal interruption, held-input suppression, relock, X secure,
  holster and phone cargo page. Actual new tractor mesh asserted.
- FourGLB before/after plus expedition hands/side/walking inspection11.0s.
  Actual browser sees exactly3shared atlas objects across all four equipment
  models and3/3/4/3asset draws. All maps compile and render.
- Selene physical controller route1.2minutes: land, stand, walk aft, open ramp,
  exit, aim/move to deposit, toggle cutter, mine, cycle and fire both weapons,
  then use the shared first/third-person shortcut. No pose teleport in the test.
- HDR55.5s: base/normal/roughness variation changes actual pixels; beam ends at the
  target, a foreground obstruction fully occludes the sampled beam, and a miss
  suppresses hit effects. Logarithmic depth retained.

Inspected final images: the tractor's open three-pole cage/teal shell differs
from the finned cutter/coolant tank; ivory panels, dark grips and reflective metal
read separately. Label glyphs were initially stretched: the final atlas/UV crop
matches each plate's physical aspect and uses4×anisotropy. Both grips remain
attached in the sampled aim/walk views; the fitted rifle stock stays outside the
shoulder. Actual first-person tractor/cutter beams and firearm flashes originate
at their visible emitters. Phone cargo controls fit without scrolling. The
resource accounting, heat and cargo controls remain functional.

The [comparison](handheld-tools/comparison.png) uses identical fixed cameras and
lighting per tool, before on the left. Baselines are original raw GLBs; the old
cutter's separate runtime wear decorator is not in that isolated comparison.
Actual legacy cargo gameplay is retained in the earlier cargo-tractor QA record.
See the [evidence manifest](handheld-tools/evidence.json) for image hashes, renderer,
asset metrics and check details. Original motion WebMs/logs remain in the unique
`/home/cees/.cache/star-agent-tool-art/run04/` directory; curated images are checked in.

One earlier run accidentally proceeded after a failed GPU preflight due to shell
fall-through and overlapped the public owner's browser for17.6s. It is retained
only as diagnostic evidence. Corrected launches separate inventory and execution;
final run04 held the declared window and completed before releasing to HUB.
The pre-label Blender rebuild reproduced all4GLB hashes exactly. Factory reset
also restored Blender's backup preference, so the builder now sets no-backup after
each reset; `.blend1` files were removed before delivery.

Latest changed-asset/equipment/performance checks:33passed. Earlier combined
887units and122distinct multiplayer/server checks are retained; the single
initial cargo SQL setup failure was separately corrected and all8cases passed.
The two opt-in general/social PostgreSQL suites were not rerun in this art lane;
no new schema or SQL behavior is introduced by the art pass.

Builder self-inspection only. Independent visual rubric/release acceptance,
physical controller hardware, a new native-touch firing journey and performance
frame budget are not claimed. Existing native two-finger tractor QA remains
at its original source in the preceding cargo feature record.

## Local delivery

Merged into `dev/all-features` as `638a5e4` on 2026-09-07. Its `src`, `server`,
`public/models` and `assets/handheld-tools` trees are identical to final
browser-tested `a50c060`; the merge preserves current wildlife/player-performance
source and incoming shared handoffs. Production build passes in5.16s, and
repository/whitespace checks pass. Review: [draft PR79](https://github.com/AvonMexicola/star-agent/pull/79),
stacked on the checked tractor PR74 and reconciled with performance PR77.

One graceful persistent-preview restart completed at21:09:42UTC, MainPID3640890.
Frontend5178 and API8087 are healthy; the client and restarted API use protocol4.
No schema migration, account reset or import was performed. The existing database
cluster inode947632 remains. At21:11:11UTC, all four served GLBs matched exact
reviewed SHA/bytes and eight key served source modules matched after normalizing
Vite import paths, injected environment and source-map comments. The first
verification helper incorrectly consumed a same-line import with Vite's injected
environment assignment; narrowing that normalization passed without application
changes. Raw receipt: `/home/cees/.cache/star-agent-tool-art/live-verification.json`.

Refresh http://localhost:5178/ to test. This local promotion does not incorporate
the separately owned future Atlas/station refit, change public deployment, or
establish independent asset acceptance.
