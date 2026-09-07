# Base kit polish — production and acceptance

Started 2026-09-07, Europe/Amsterdam. User request: polish the implemented
base-building assets. Candidate starts at4d934d1 on feat/base-building, PR41,
in /tmp/star-agent-base-work. Prior Opus3.5/5 review remains historical and failed.

## Brief and ownership

Finish the existing small Selene outpost view: readable cast-concrete panels at
walking distance and30m; white armour, dark polymer, steel and restrained mint
service fixtures; authored placement silhouettes; smooth physical pocket doors;
legible console and bounded real light spill in shadowed reveals. Preserve all
eight module dimensions, support surfaces, moving pivots, finite material costs,
local claims, controller routes and saved inventories. No new station/power/
survival systems or extra module types are part of this pass.

Reference/provenance: existing authored kit, local project faction specification
and concrete findings in opus-review.md. Geometry and textures remain original,
deterministic Blender-script work; no third-party imagery or generated concept
art is presented as a game asset.

Materials agent owns blender/build_base.py and exported public/models/base kit,
shared texture derivatives, manifest and geometry tests. Runtime agent owns
BuildSystem, motion, pooled service lighting and collision integration. Root owns
instance finish/ghost/disposal helpers, console/HUD/UI, integration and delivery.
Independent reviewer owns baseline/current in-game captures and bounded acceptance
checks; the completed independent Claude Opus functional/visual report is linked below.

## Contracts

Game metres, Y up, origin at support plane, canonical src/build/definitions.js
colliders and AUTHORED_BOUNDS. DoorLeafLeft and DoorLeafRight retain their wrapper
names and opposed0.8m X travel. Shared GLB geometry/textures stay immutable.
Private instance materials preserve COLOR_0 and native standard-material lighting
and logarithmic depth, while a shared per-instance coverage uniform fades distant
claims. Preview edges own their geometry; disposing a preview must never dispose
the cached placed model.

Door target remains persisted as doorOpen; live eased fraction drives both the
visible leaves and walking/raycast colliders. Block closing when the swept leaf
would hit the player. Reload restores the saved endpoint. Service fixtures have
a bounded light pool; they also illuminate daytime lunar shadows.

## Verification ledger

- Baseline production dist snapshotted to /tmp/star-agent-base-polish-baseline-dist
  before exports changed; reviewer captures use isolated4288.
- Root finish tests pass isolation of two instances sharing geometry/textures,
  preserved vertex colours, private-material disposal, native logdepth/shading
  chunks and late console material integration. Browser shader check pending.
- First production base-scene check passed45.6s with zero browser errors/warnings;
  inspected images exposed coplanar new stair rear trims. Recessed visual concrete
  and separated plate/vent depths within unchanged bounds. A new geometry-ray
  regression verifies separation. Floor marker layers were corrected too.
- Full kit/door/ghost/day/night/fade production route passed1.7m, zero browser
  errors/warnings. First full-resolution measurement530draws/1,374,350tris/45.76ms
  meanRAF on native AMD ANGLEGL; this is a world-frame budget failure, not isolated
  GPU execution time. The tool was visible; subsequent lighting captures holster
  it to separate base lighting from the mining flashlight. Mainframe spill was
  reduced and moved forward after a blown-out close bezel highlight.
- Build UI controller/keyboard/touch and held-trigger route4/4pass11.5s; recipe
  controls/feedback remain visible while its content scrolls, desktop/390px.
- Full npmtest535passed23.77s before final mesh-layer regression; subsequent
  geometry12/12pass covers the changed export, with no support/bounds regressions.
- Material agent reports rebuilt kit within existing bounds, <=10ktris/1MB each;
  measured manifest and loaded-mesh collision/support tests remain authoritative.

## Acceptance

Functional: production base-polish rerun passed1/1 in1.9m after trim/light fixes,
with tools holstered and zero page/console errors/warnings. Shared controller
right-stick scroll regression was found independently: the dialog now delegates
to its explicitly marked inner scroll area. Updated build-ui4/4pass11.1s includes
right-stick scrolling80px with stable focus and visible close action. Root's
final focused finish/motion/geometry suites pass. See polish-functional-review.md.
Visual: independent Claude Opus review passed all six criteria at 4/5, average
4.0/5. See opus-polish-review.md and the dispositions below. Historical Opus3.5/5
is preserved. Performance: affected-scene measurement failed the frame target;
inherited orbit/hangar budget failures remain. No merge approval is claimed.
Physical Xbox: untested. Merge and deployment: not performed.


Reviewer capture notes: final tool-holstered captures are in
/tmp/star-agent-base-polish; record.json contains current counts. Its arbitrary
night saved-base pose sits across uneven terrain (not valid placement evidence),
and night-door-light.png is actually the window side aimed toward the doorway.
Inspect the actual doorway from claim-local[0,1.95,-9] toward[0,1.3,-6] for
threshold light assessment. Prior fullscale535tests pass predates one new mesh
layer regression and sharedcontroller scrollfix; both affected checks pass now.
The fresh-starter physical landing/build journey is historical at4d934d1; these
polish fixtures use imported saved buildings and explicit camera poses.


## Final author captures

The final controlled full-resolution sample measured 474 draws, 1,165,410
triangles and 41.24 ms mean RAF at 1440×900, render scale 1, Chromium
151.0.7922.173 on native AMD Radeon 860M ANGLE GL. This remains above the surface
frame-time target. Counts include the whole rendered world and the renderer's
shadow-pass accounting; the near and distant fixtures/streamed terrain vary
between samples. Neither this nor the preceding sample isolates asset GPU cost.

- [Walking-distance kit](polish/day-kit-walk.png) and [approximately 30 m](polish/day-kit-30m.png).
- [Door during motion](polish/door-mid-motion.png) and [open doorway](polish/door-open-outside.png).
- [Authored stair preview](polish/ghost-stairs.png) and [window preview](polish/ghost-window.png).
- [Live console with separate interaction hint](polish/mainframe-status.png).
- [Recipes desktop](polish/recipes-desktop.png) and [phone](polish/recipes-phone.png).

Export: 21,228 triangles and 1,869,528 GLB bytes across eight pieces; largest
piece is 5,616 triangles / 489,128 bytes. Two shared 256² WebP maps. Repeated
Blender export was deterministic; source, manifest hashes, named door pivots,
vertex colours and measured envelopes are checked together. Optional local
Blender-addon/deprecation warnings did not block export; null OpenAL avoided an
audio-shutdown hang after the first export had already written artifacts.


Final author verification at commit `9ea6b32`: `npm test` passed all **536 tests
across 75 configured files** in 27.46 s. `npm run build` passed with 156 modules
in 3.42 s (existing chunk-size advisory). The persistent 5296 preview returned
HTTP 200 and its index matched the final dist byte-for-byte.


## Completed independent review and delivery disposition

[Independent Opus report](opus-polish-review.md), with 18 self-captured images,
records a **4.0/5 visual pass** and its separate functional examination. Reviewer
identity is harness-reported `claude-opus-5`; the CLI completed successfully. It
independently rechecked the phone paused-door wrapping fix on a fresh build.
Original observations and recommendations are retained without rewriting them.

Author dispositions (these are not a new reviewer score):

- Phone clipping is fixed and independently verified. Final build-UI suite passes
  **5/5 in 11.3 s**, including D-pad focus/activation, right-stick inner scrolling,
  held-trigger suppression, keyboard/touch and the longest phone interaction copy.
  These use a focused fixture, not a new full physical construction journey.
- Delivered preview was rebuilt after the final CSS fix: 156 modules, 3.46 s,
  `main-DSorPQyt.js` / `main-Bfq4WWOU.css`. HTTP 200 from port 5296 and exact index
  comparison to `dist/index.html` pass. This clears the stale-delivery observation.
- The report cites older mainframe lighting values. Current source already uses
  offset `[0,1.50,-.56]` and base intensity 1.25, reduced before commit `9ea6b32`.
  Doorway intensity remains 8. Visible housing brightness and nighttime readability
  remain art-tuning observations; changing the corrected console to the suggested
  intensity 4 would increase its light. No further lighting change was made.
- Ghosts keep native `depthTest:true`; `depthWrite:false` does not disable testing
  against opaque foreground geometry. Transparent self-overlap can still reduce
  readability. Preserve this distinction before implementing a depth prepass.
- D-pad browsing is exercised by `focus()` in the UI suite. The full physical
  eight-piece controller journey in controller.md is a historical pass, predating
  this polish and carrying rebalance. The fresh-starter route passed at `4d934d1`.
  Neither is relabelled as a fresh full-kit run. Physical Xbox remains untested;
  current complete-journey acceptance remains an integration gate.
- Broader HUD-offset/layout optimisations, longer nighttime fixture visibility,
  stronger distance material separation and whole-world performance remain follow-up
  findings. The draft is unmerged; no budget waiver or deployment is claimed.

## Refreshed isolated asset studio

Reproduce with `node scripts/capture-base-kit.mjs http://127.0.0.1:5305
 docs/qa/base-building/polish-studio` while the dev server runs on 5305.
This Three.js authoring studio is separate from production game captures and has
its own ground, lighting and 1.80 m reference. Desktop 1440×900, native ANGLE GL
on AMD Radeon 860M: 70 draws / 30,110 triangles in the assembled studio; zero
browser errors. Source/export totals above exclude the studio/reference geometry.

[Kit](polish-studio/kit-desktop.png), [doorway](polish-studio/doorway-desktop.png)
and [mainframe](polish-studio/mainframe-desktop.png) were inspected. Concrete casting,
armour, rails and fixture details are visible; the mainframe studio face is an
asset placeholder, while the production game attaches its live status display.
