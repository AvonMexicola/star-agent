# Aeon station exterior production record

2026-09-07 / Europe/Amsterdam. User requested work on the station exterior.
Base: `dev/all-features` `8576e99`; isolated `feat/station-exterior` in
`/home/cees/projects/star-agent-station-exterior`. Existing PR22 refined the
individual hangar asset. This slice addresses the whole port's inherited runtime
spine, connecting arms and two rings. Those are currently 93 mesh draws and
22,116 triangles before bay assets, hub, world and postprocessing.

## Brief

A substantial industrial orbital port with a recognizable paired-ring outline,
engineered bearings, forked structural spokes, pressure modules, service bridges
and radiator banks. Read the complete silhouette from 4–7 km and one structural
junction from 100–300 m. The existing 20 functional hangars remain the human and
ship scale references. First completed view: oblique overview showing the near
ring, spine and outward-facing hangars; then a ring-bearing close view.

Original deterministic Blender geometry. Reference provenance: the existing
Aeon port and its documented industrial Port Olisar influence; no borrowed game
meshes, textures or ship graphics. Retain station ivory/dark polymer/steel,
restrained mint navigation accents and amber service markings from CSS tokens.
This is station infrastructure; the shared Meridian Shipworks ship identity does
not automatically rename the port or establish its manufacturer.

Scope: fixed exterior, two rotating ring assemblies, source/manifest, local-space
collision and actual-game review preview. Preserve bay source GLBs, interiors,
shops, opening, docking, multiplayer frames, physical boarding and controller
input. No new rooms, transport mechanics or combat. Geometry review precedes
final unique painting/texture acceptance; unfinished art remains labelled and
behind a development option.

## Contract before authoring

| Element | Measured or runtime contract, metres / game Y up |
|---|---|
| Port origin | Stable planet-relative double `centre`; GPU receives rebased local offsets |
| Berths | Two banks of ten; X=(index−4.5)×190, Z=−520/+520; second bank yaw pi |
| Bay deck | X −21..21, Y top −8, Z −22..26 in each independent bay |
| Bay anchors | Pad [0,−8,2], approach [0,−4.8,−112], trigger [0,−4.8,−272] |
| Ring bearings | Centres X=−1110/+1110, Y=Z=0; spin about local X |
| Ring speed | Opposite 0.00045 rad/s; current-pose ring-local collision |
| Ring radius | 1450; 2900 m principal diameter |
| Hub | X ±22, Z ±19, floor −8, ceiling +1.5; visible exterior proxy swaps below 140 m |
| Collision | Shared immutable local BVHs; all berths, fixed structure and rotated rings remain solid |
| Visibility | Whole exterior culled beyond 600 km; ring motion independent of visual visibility |

New massing must not obstruct a complete ship envelope in any outward approach
lane or fill the occupied concourse volume. A rotating hull cannot be attached
to a fixed support without a visibly separate concentric bearing. New high-count
parts are batched by material and motion ownership; preserve ring-local pivots.
Target new exterior ≤100,000 triangles, ≤36 draw primitives, ≤4 MB across the
source kit; report both assembled cost and payload, not just an individual part.

## Ownership and proceedings

Root: new exterior builder, runtime assets/loader, narrow architecture integration,
preview, physical tests, captures and PR. Independent Mendel: baseline review and
later separately captured rubric, only under this QA area. Other agents' dirty
station assets in the shared checkout are preserved. New worktree initially
failed in /tmp (insufficient tmpfs space, git rolled it back); home disk succeeded.
`npm ci`: passed, 35 audited packages, zero reported vulnerabilities.

## Acceptance

The bounded CPU functional review passes, and the final hero/LOD checkpoint
renders successfully in Chromium with working controller and touch entry.
Independent silhouette review scores 4.0/5; materials score 2.8/5 and remain
unfinished. Shared-build integration is recorded below when checked. Final
materials, complete art acceptance and hardware frame timing remain pending.
This opt-in development checkpoint is not a production merge or finished asset.


## Iterations and closed defects

1. The first export stored8.8MB and169,244 assembled triangles; it failed the
   initial kit budget. Blender's old MixRGB node also omitted COLOR_0. Switched
   to the documented ShaderNodeMix multiplication and inspected real exported
   colour attributes. Reduced small-part bevel tessellation while retaining
   two-segment radii on the largest structural stock.
2. The first96,660-triangle checkpoint079f7262 rendered in production with zero
   page/shader warnings or errors. Seven author captures are retained in
   `iteration-01/`. Independent Mendel took ten paired legacy/authored views:
   silhouette3.0→4.0. Materials2.8, lighting3.5, cohesion4.0; no final aggregate,
   function/motion approval or finished-art certification. See
   [the independent record](baseline-review/review.md).
3. Independent CPU review found a concourse support crossing the room with all
   its vertices outside the tested volume. The original vertex test missed it.
   A new actual-triangle/Box3 SAT regression failed on the old asset. Supports
   and brace ends now remain below the room, with a floor cradle underneath.
   Empty named assembly groups were also accepted by the first loader; these
   are now rejected before replacing the complete legacy fallback.
4. The full-detail overview reached439,858 triangles in the independent fixture,
   above the400k orbit limit. A separately authored distant export removes small
   bevels, retaining the same primary structure. The visible geometry switches
   beyond4,200m and returns inside3,800m; both wheel poses remain synchronized.
   Collision always uses the hero. Reconstructing metre-scale grain UVs once on
   the shared decoded geometry keeps BOTH runtime assets within the original4MB
   kit target. Editable Blender sources retain their UVs; there is no unique
   painting atlas and no Meshy painting job yet.
5. Reviewer capture attempts preserved in the baseline record include a stopped
   5178server, then an unfinished dev-transit transaction/cockpit occlusion.
   The corrected paired run asserts actual camera position and a hidden player
   ship. Author fixtures use the same safeguards.
6. The first combined controller/touch check hit its180-second harness limit
   after completing the desktop controller path. The corrected fixture closes
   that desktop context before loading the phone and allows300seconds for four
   application loads. This is recorded as an incomplete check, not a runtime
   pass or a proven phone failure. A subsequent run supplies the final result.

## Current source and runtime assets

Rebuild from repository root (Blender5.2.0LTS / Node26.7.0 used):

```sh
env ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio --python-exit-code 1 --python blender/build_station_exterior.py
env ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio --python-exit-code 1 --python blender/build_station_exterior.py -- --lod
npm test
VITE_DEV_TOOLS=1 npm run build
STATION_EXTERIOR_OUTPUT=/tmp/station-exterior-qa npm run test:browser -- -c scripts/station-exterior.config.js
```

Serve that production build on5400, with its optional local memory API on5401.
The review config accepts `STATION_EXTERIOR_URL` for another owned preview.
A normal build keeps the inherited exterior; the new kit requires explicit
`?dev=1&stationExterior=1`. The local launcher offers a labelled geometry preview,
with a one-shot overview start. Subsequent test-location choices clear that
camera preset and retain the selected exterior. Shared multiplayer cannot use
that overview helper to override its authoritative placement.

| Export | Bytes | Stored / assembled triangles | Visible material draws | SHA-256 |
|---|---:|---:|---:|---|
| Hero |2,600,828|68,816 /96,704|22|`5b39b183030d529a710de0b2dad308a36a8e597b067d3061d82f01bb721b76e6`|
| Distant |1,206,036|34,640 /54,944|22|`ec98e225e57bbadb18c4c4567614bab2c5a23694e16effeeba99a4ce0b5ffdcb`|

Combined runtime payload:3,806,864bytes. Both rings reuse one geometry/material
set per render level. LOD reduces triangles; it does not reduce the22material
draws. The original exterior used93draws and22,116triangles. The kilometre-scale
batches use KHR_mesh_quantization (maximum position storage error38.47mm; normals
within0.322degrees). Bay/door/room assets are separate and were not quantized by
this change. The generic packer is derived from the existing Atlas implementation;
no decoder or external runtime dependency is added.

## Final rendered views and remaining gates

The revised hero/LOD production capture records Chromium151.0.7922.173,
AMD Radeon860M ANGLE OpenGL ES3.2, DPR1, seed7291, render scale1. Desktop1440×900,
phone390×844. Author capture fields include the exact camera, served hash and
full-scene counts, including shadow passes. No hardware frame-time claim is made;
other browser work on the machine prevents a clean benchmark.

| View | Render level | Full-scene draws | Full-scene triangles |
|---|---|---:|---:|
| Quarter overview |LOD1|148|370,494|
| Broadside overview |LOD1|142|350,014|
| Ring-face overview |LOD1|163|393,406|
| Bearing close view |Hero|164|449,118|
| Spine close view |Hero|164|449,118|
| Berth05 |Hero|345|605,330|
| Phone overview |LOD1|110|312,894|

Distant overview counts now fit the300draw/400k triangle orbit limit. Near-structure
and berth images are reported separately; they do not fit a400k triangle limit,
although their counts fit the600draw/900k station-interior budget. Hardware timing
and approval of all near-exterior budgets remain open. The shader/image checks
are actual production renders, not Blender turntables. The camera fixture is not
proof of a physical flight from orbit or boarding journey.

The first complete full unit suite passed655tests before final loading/LOD fixes;
subsequent targeted suites are recorded with their own candidates. Independent
CPU review and revised full verification are appended when complete. This remains
a development-only geometry checkpoint. Final surface painting, centre-mass
hierarchy, bearing panel/shaft treatment and finer ring-seam hierarchy are open
art work. A silhouette4.0 score cannot approve materials scored2.8 or replace the
required final reviewer-session gate. No main merge or deployment is claimed.

## Independent functional closure and input entry

The [independent CPU review](functional-review/review.md) passes on the final
hero and distant exports: 22/22 station tests, 21 occupied rooms clear at both
render levels, 48 sampled ring poses and 60 full-envelope approach sweeps clear.
Thirty collision/render transform poses include distant origins. Eleven LOD
transitions retain the identical hero-only collision trees and hits; four optional
load/fallback cases preserve a usable station. Both initial P2 defects are closed.
These CPU probes do not establish an art or hardware timing pass.

The [final author capture record](geometry-checkpoint/README.md) retains seven
scene views plus controller and touch entry images. Both browser cases passed
in 3.8 minutes with zero page/console errors or warnings. The controller case uses
an injected standard Gamepad through launcher entry and ordinary flight, menu
return and held-direction suppression. Touch uses the actual launcher link at
390×844. Physical controller testing remains unperformed.

## Shared-build integration verification

Feature geometry commit `261ebab` was reconciled with the latest local and remote
`dev/all-features` at `7bd4bd5`, including patrol combat, in `0880516`. The two
conflicts were additive HANDOFF entries and the test list; both lanes are retained.
The narrow main/launcher integration was reviewed against that base. All four
station runtime modules from the independent CPU review are byte-identical.

Final integrated `npm test`: **664/664 pass**, zero failures/skips, 33.247 seconds
on Node 26.7.0. `VITE_DEV_TOOLS=1 npm run build`: pass, 5.34 seconds; Vite's
existing large-chunk advisory remains. Root's logs are local in
`/tmp/station-exterior-integrated-unit-01.log` and
`/tmp/station-exterior-integrated-build-01.log`.

The [independent LOD follow-up](lod-review/review.md) closes the sampled distant
triangle concern without changing the earlier material/art gate. Both own captures
verify actual LOD draw callbacks and the exact served assets. Quarter: 126 draws /
319,806 triangles; ring face: 163 / 393,406. World streaming changes whole-scene
counts, so only the exact kit reduction is attributed to the new LOD. Both images
preserve the silhouette. No hardware timing or transition-motion approval follows
from two fixed screenshots.

Final combined Chromium verification: **3/3 cases pass in 4.9 minutes**, zero
browser console errors/warnings or page errors. In addition to the seven rendered
views and injected-controller/touch entry, a Kestrel physically climbs out to the
bay, reboards and secures, launches, retracts its gear and flies clear. Only its
initial hangar start is a developer preset; the subsequent journey uses keyboard
input. [Selected integrated evidence](integrated-flight/README.md) retains the
current overview, input frames, ladder/departure images and receipts. All seven
scene counts match the earlier final-kit table. The phone HUD remains crowded by
inherited combat panels and the temporary start toast; entry success is not full
UI art approval. The GPU was released to the queued Aeon-stones QA owner afterward.
