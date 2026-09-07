# Aeon orbital port: authoring and integration memory

Scope: the `feat/modular-hangar` branch, stacked on `feat/unlockable-freighter`
(PR #14). This is the station counterpart to `SHIP-PIPELINE-MEMORY.md`.
Do not treat this branch as deployed until the manager integrates it.

For the reusable workflow designated by Cees, read
[the asset production standard](docs/asset-production-standard.md) and
[the hangar production record](docs/qa/hangar-production-record.md). The integration
addendum below updates this original modular-port record without erasing its history.

## Product and ownership

Cees requested a much more detailed hangar, clear walking floors, cargo transfer
terminals with Take all, twenty modular bays, a physical elevator entrance with
explicit transit to a central hub, and enormous slowly rotating rings. Port
Olisar supplied the visual direction: industrial port, distinct berths and large
rings. All geometry here is original procedural content; no Star Citizen assets
or textures are bundled.

The twenty berths are physical spaces in the single-player simulation. There is
no player allocation service, multiplayer networking, shared economy or server
inventory authority. All berths use one reusable authoring template. The manager
(Fable 5.1 / Claude) owns integration and deployment; append handoff messages to
root HANDOFF.md without replacing unrelated work.

## Source map

- `blender/build_station.py`: deterministic Blender geometry, materials, anchors,
  main hangar door animation, detailed hero and lightweight LOD exports.
- `public/models/station.glb`, `station_lod1.glb`: generated runtime assets.
- `src/station.js`: one berth's asset setup, world frame, animated doors, deck,
  docking and swept collision. Still independently usable and unit tested.
- `src/station-architecture.js`: twenty berth placements, original ring/core/hub
  geometry, canvas signage, elevator leaves and matching door boxes.
- `src/station-complex.js`: shared asset loading, independent berth instances,
  instanced distant geometry, active/parked berth, hub frame, floating origin,
  rotating ring collision and interactions.
- `src/station-services.js`: F actions, elevator modal and explicit passenger
  transfer. The parked ship does not move with a passenger.
- `src/station-cargo-ui.js`, `station-interior.css`: warehouse/ship terminal and
  elevator styling. `ship-inventory-ui.js` supplies the ship crate's bulk buttons.
- `src/ship-inventory.js`: capacity, conservation, migration and persistence.
- `src/main.js`, `navigation.js`: integration points; these overlap other lanes.

## Coordinates and authoring contract

Blender uses Z up. glTF exports into Three.js Y up; Blender +Y is game -Z.
The bay deck spans game X [-21,21], Z [-22,26], top Y -8. The opening is at
Z -22. Preserve LandingDeck, LandingPad, ApproachPoint, DoorTrigger,
HangarDoor_L and HangarDoor_R, and the `DoorsOpen` animation.

Opening lane's structural slab fix is intentionally retained: the structural
Hull floor ends at Y -8.4; the separate 0.4 m LandingDeck ends at -8. Never put
the structural slab top back at -8: logarithmic depth at eye height reveals
coplanar floor artifacts. Hero and LOD ray tests verify the separation.

All low new furniture stays beside the walls or aft of the ship pad. The side
walking routes at X +/-12 and the cross-route at Z 20 remain clear. Hose reels
are wall mounted; floor hoses have been removed. Hoist equipment stays overhead.
Suspended signs must clear Atlas's docking and launch envelope, not just Nomad.

The cargo terminal screen is at [-12,-6.28,22.69], facing game -Z. Its usable
approach is around [-12,-6.25,20.7]. The physical screen and podium are Blender
geometry; its legible display is runtime canvas signage.

The elevator door plane is Z 22.3, with a cabin behind it around Z 24. Leaves
are 2.04 m wide and slide sideways. The hub cabin uses the same dimensions at
Z 14.3. A player must call the door and walk into the cabin before selecting a
destination. Do not replace regular walking/ship boarding with transit.

Blender aft-facing wall lettering needs `rot(pi/2,0,pi)`; side lettering needs
`rot(pi/2,0,-side*pi/2)`. Inspect the actual export from inside the bay to catch
mirrored text; successful export alone does not establish correct orientation.

## Rebuild procedure

Use an isolated branch/worktree, with Node 22.12+ and installed dependencies.
Do not switch the shared checkout under other agents.

```sh
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_station.py -- --out public/models/station.glb
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_station.py -- --out public/models/station_lod1.glb --lod
npm test
npm run test:browser -- -c scripts/hangar.config.js
```

Blender 5.2.0 LTS was used. This installation emits optional extension/cattrs
and MeshOptimizer warnings; verify process exit, the explicit EXPORTED summary,
asset parsing and actual browser rendering. A warning is not proof of failed
export, and a file appearing is not proof of a successful asset.

The final hero is approximately 2.21 MB / 68,296 triangles; the LOD is about
0.25 MB / 6,896 triangles. Runtime ring and hub geometry is separate. Geometry
batch additions must happen before that batch's `.build()` call. Adding to an
already built batch silently leaves details out of the export.

## Modular runtime and performance

POD_LAYOUT defines two banks of ten, at Z +/-520, spaced 190 m along X.
The second bank rotates 180 degrees so both banks open outward. IDs 01–20 are
stable. All pods share hero/LOD geometry, materials and a single local collider
BVH. Door animation mixers and transforms remain independent.

Only nearby pods use the hero within 180 m. Distant geometry uses InstancedMesh
batches across the twenty berths, including independent door translation. Do
not restore twenty full-detail rendered models or twenty copies of collider
triangles. Do not multiply emissive intensity once per clone: material
preparation tracks already prepared materials with a WeakSet. Point lights are
limited by proximity; hub details are visible within 140 m, with an exterior
shell beyond it. This is a rendering strategy, not an FPS claim.

Two rings have 1,450 m radius (2.9 km diameter), centred at X +/-1110. They rotate
in opposite directions at 0.00045 rad/s: roughly 3.9 hours per revolution.
Ring instances are included in collision. The BVH is authored in the ring's
local frame; sweep points are transformed through the current ring rotation.
Fixed spine and pod collision remain separate. Flight sweeps check all bays,
so changing the active berth cannot make other hulls non-solid.

World origins are JavaScript doubles around the planet. Pod offsets and ring
geometry are local metres. `station.rebase(origin)` updates every group's
camera-relative position. Never restore main.js's former single-group rebase,
and never upload planet-centred positions to Float32 instance matrices.

## Navigation and inventory behavior

In flight, the nearest berth becomes the docking target. A successful dock
records parkedPod. On foot, the active frame stays stable; selecting an elevator
destination changes the passenger frame and position only. Ship position,
orientation and manifest remain parked. Another bay's terminal tells the player
where their ship is; it does not remotely load an absent ship.

F at a terminal opens cargo; F outside the elevator calls the door; F inside
opens the destination picker. Transfer closes the door, fades, explicitly moves
the passenger, opens the destination door and restores input. Escape and close
release modal input; help and quick transit cannot escape an open station modal.
The quick-transit destination buttons are still the game's separate optional
shortcuts, not the normal flight or walking path.

The existing inventory key `star-agent.nomad-inventory.v1` now writes schema 2
with ship, pack and station containers in one JSON write. Valid schema-1 saves
migrate by preserving ship/pack and adding initial warehouse stock. Capacities:
Nomad 120 kg; Atlas 2,400 kg; pack 20 kg; warehouse 10,000 kg. Take all transfers
as many items as fit, in stable item order, leaving excess at source. This is
capacity-aware bulk transfer, not a bin-packing optimizer. Items are conserved.
Storage denial leaves transfers usable for the session and reports that state.
No account, hosted API, paid service or economy is required.

## Validation and evidence

`tests/station-complex.test.js` covers distinct frames, shared geometry/BVH,
independent doors and distant door transforms, aisle/elevator sweeps, hub floor
and wall collision, instanced ring bounds and hero/LOD slab separation.
Inventory tests cover capacity/conservation, one-write persistence, legacy
migration, rejected prototype keys and unavailable storage.

`scripts/hangar.config.js` builds the production app and runs the new services
journey plus existing Nomad, Atlas and station flight/boarding regression tests.
The services fixture begins at a docked ship and then in the clear side aisle;
walking to cargo and through elevator doors uses real play controls. Existing
station/ship tests cover the physical ramp journey. Never describe the fixture
as a full flight from orbit.

Visual evidence is written to `/tmp/aeon-*.png`; station boarding evidence goes
to `/tmp/star-agent-station`. Use the final reviewed images under docs/images
for the PR. Chromium uses ANGLE SwiftShader at 1440x900; movement runs at 0.4
render scale and screenshots at 1.0. Do not report software-rendered FPS as a
hardware performance result. Inspect page errors, shader errors and images.

Final validation for this implementation: 81 unit tests passed. Seven production
browser cases passed across a six-case green run plus the focused station rerun.
The initial station run completed flight/dock/boarding/departure but its final
mobile assertion still expected two rows from the old six-destination menu;
`scripts/station.spec.js` now expects the three rows used by seven destinations.
No runtime UI layout change was needed. Chromium version: 151.0.7922.173.
Final screenshots were reviewed and copied to `docs/images/aeon-*.png`.

## Opening and travel integration addendum — 2026-09-06

PR #20 integrates this port with `feat/visual-fidelity` at `029cae8` in an isolated
worktree. See `docs/qa/hangar-integration.md` for actual combined validation and
review status; the earlier counts above describe the original modular pass.

`StationComplex(scene, openingStationOptions())` shares the authored direction,
orientation and altitude with every pod and the hub. Its opening methods delegate
to a locked active berth and preserve controlled door poses during asset loading.
`station.update(nav.position, origin, sun, dt)` takes the physical player position
separately from the final camera origin. Select a flight berth using the former;
rebase and choose visible LOD using the latter after `opening.placeCamera()`.
Keep `station.nav = nav` connected so cinematic and navigation mode guards work.

Initialize the selected ship layout before constructing the opening. Spawn ahead
of `layout.flightBounds.min[2]`, and keep an Atlas cinematic camera outside its
full width. Preserve `station.up` for walking on the tilted deck. Travel avoidance
uses `station.centre`, not the active berth's changing `worldPosition`.

Input stays paused throughout the elevator's closed-dialog fade. Help and quick
transit must respect `nav.enabled` as well as open modal flags; otherwise the orbit
shortcut starts a competing transfer timer. Normal Help destinations close Help
before initiating their explicit quick transit. The integration browser regression
covers both the forbidden overlap and that normal flow.

The modular GLBs keep the structural slab below the authored deck. The separate
manager hull refinement in PR #22 is not part of this merge candidate. Use
`scripts/hangar-merge.config.js` for combined checks and
`scripts/hangar-integration-tour.mjs` for reproducible production captures.

## Detailed hull and final review checkpoint — 2026-09-06

The preceding 029cae8/PR22 separation describes an earlier checkpoint. Integration
commit `7ddef61` includes default `85aa836`, including the manufactured hull,
recessed coffers, deck plates and baked AO. Keep named Hull/HangarInterior parent
groups over split material primitives; preserve COLOR_0 using cached vertex-color
material variants. Distant geometry may batch only when material, vertex layout,
index format and door ownership agree. Independent berth doors remain separate.

The screenshot comparison at `0d75c3f` caught decorative ceiling sheets covering
the new recessed light apertures. `1eeb302` removes those redundant sheets while
retaining the shell coffers, beams and small service strips. Upward visibility rays
from the walking floor now reach eight sampled diffusers; both LOD deck/floor
checks still pass. This is a reusable integration lesson: material correctness
alone does not prove that an authored light is physically visible.

The current review preview is the host user service
`star-agent-hangar-current-preview.service` at `http://127.0.0.1:5249/`, serving
`/tmp/star-agent-hangar-current-build`. Check it from the browser's host network;
a restricted namespace connection failure is not proof that the service stopped.
The earlier 5239 preview is historical. The independent Opus re-review remains
incomplete after its session limit; root's captures are labelled separately.

Use [the production record](docs/qa/hangar-production-record.md),
[hardware evidence](docs/qa/hangar-hardware-review.md), and
[before/after comparison](docs/qa/hangar-visual-comparison.md) for exact candidate
hashes, real checks, open gates and eventual merge outcome. The reusable
[asset production standard](docs/asset-production-standard.md) remains the
entry point for the next asset; preserve failures and resolved findings as well
as passing screenshots.


## Concourse continuation — 2026-09-06

Cees requested a better elevator, realistic furniture, a weapons shop and ship
equipment shop, and an explanation for low performance. The isolated continuation
from PR20 head 056d20b is recorded in
[concourse proceedings](docs/qa/station-concourse-production-record.md),
[asset contracts](docs/qa/station-concourse-assets.md) and
[measured performance](docs/qa/station-performance.md). This record does not
replace the earlier failed/incomplete visual reviews or imply a merge.

New source boundaries: `station-concourse.js` owns the material-batched hub shell
and shop props; `station-elevator.js` attaches independently animated pressure
leaves and static cabin collision. `blender/build_station_concourse.py` rebuilds
both GLBs and embeds measured assembly budgets and explicit local collision boxes.
Never create a single enclosing collision box for an open shop or cabin.

`station-shop.js` owns finite local catalogues and controller edges;
`station-shop-ui.js` supplies the modal. Inventory keeps the existing storage key
but migrates valid v1/v2 cargo into one v3 manifest with a one-time credit grant.
A purchase writes cargo, money and stock together before committing memory.
Weapons/components are stored cargo; combat and installation remain unimplemented.

Profile CPU work independently of GPU timer queries and presentation cadence.
A hidden model can still consume update time; avoid recomputing unchanged local
door bounds and instance transforms at every origin rebase. Physical finish
materials must not be passed through the legacy whole-model weather shader again.
Generated room UVs should use metres, and small signs/flush decorative strips
should not silently become extra shadow casters.

## Retail identity continuation — 2026-09-06

[The shop branding proceedings](docs/qa/station-shop-branding-record.md) extend
the same pipeline with WATCHKEEP ARMORY and KESTREL SHIPWORKS: actual A5 holders,
framed campaigns, suspended banners, shelf categories and worn carpet. Original
generated masters, exact prompts and runtime encoding live in
`assets/station-shop/`; deterministic type and palette belong to
`src/station-shop-graphics.js`. `loadStationShopGraphics()` awaits shared images
and font readiness, then supplies three locally batched native-material meshes.
Failed image requests keep a usable authored fallback and do not disable the
hangar. Paper normals follow full GLB anchor quaternions; A5 is .148 × .210 m.

Use `--only-concourse` when refining retail geometry so the player-praised
elevator appearance is preserved byte-for-byte. Check banner headroom and print
backings against actual triangles, including all paper corners. Texture sheet
cells must match the physical print aspect ratio; a shared atlas alone does not
prevent stretched type. Read both entry and close walking-height camera views.

Browser evidence must use a dedicated output directory and per-test paths.
Global `/tmp` filenames can be overwritten by another worktree's browser run.
Verify the visible brand and served bundle, not merely a recent file timestamp.
For noisy performance, alternate graphics on/off in one camera and preserve all
pairs. GPU timer values, CPU callback time and RAF cadence remain distinct; other
active browser work can invalidate a comparison across separate runs.

## Shop enclosure and stock correction — 2026-09-06

The [independent Astra review](docs/qa/station-shop-branding-astra-review.md)
rejected candidate `435f116`: affected station/shop quality averaged 3.50/5;
upper shops read as open to space and repeated rifles/canisters looked like
prototype inventory. Cees authorized Astra as the reviewer substitution, without
waiving the numerical quality bar. Keep that failed report. Corrected candidate
`29885c9` is documented in the
[enclosure correction record](docs/qa/station-shop-enclosure-record.md);
independent follow-up remains pending at this entry, not accepted by inference
from the rebuild, tests or author captures.

Give enclosed retail spaces their own physical ceilings. A high station hull
roof does not close the visible gap above a low shop wall. The corrected kit has
continuous ceiling skins, recessed panels, beams and end-wall downstands. Its
lowest underside is Y=-4.68 above floor Y=-8, leaving 3.32 m headroom. Runtime
fixtures sit below that opaque ceiling, around Y=-4.8. Check upward and oblique
entry rays, wall-to-roof overlaps and actual lit walking views; adding a roof can
otherwise hide the lights that previously illuminated the shop.

Stock should communicate different purposes and agree with printed categories:
longarms, sidearms and field equipment in WATCHKEEP; filters, avionics and repair
equipment in KESTREL. The correction uses two long rifles, three independently
constructed compact sidearms, handled/latching cases and varied component
silhouettes. Count major items and measure their human-scale dimensions in the
real export. Labels describe decorative display stock; the purchase catalogue
still belongs to the actual shop modal.

Preserve each print anchor's complete transform, including tilted A5 paper
orientation. Test the mounted face and all corners against actual backing
triangles, not just anchor positions or assembly bounds. A print can have the
right transform yet remain buried in an inherited wall or cloth substrate;
allow clearance for the whole intended cloth wave as well as the static plane.

Give every capture run a unique output directory containing its candidate and
run identifier, with distinct paths per test/view. Retain capture time, served
bundle, camera/backend and source video provenance. Follow the
[motion evidence record](docs/qa/station-shop-motion.md) for timestamped event
windows covering walking, doors, travel and UI transitions. Preserve original
video and extraction commands; sampled contact sheets are not every rendered
frame, and playback cadence is not GPU timing. Motion capture and independent
follow-up were still pending when this correction entry was written.

Shadow follow-up runtime025e587 changes only the two concourse spotlights’ shadow
settings:1024² maps, depth bias−0.001 and normal bias0.04. Astra caught poster/tile
banding on29885c9; root’s bias-only trial cleared paper but left coarse rack
shadows before the resolution refinement. Final GPU medians at1440×900/AMD860M
were5.314ms hub and7.992ms hangar; CPU p95 remains10.1/12ms respectively. Keep
these separate from the earlier slower runs and the recorded29885c9 interaction
journey. Exact provenance and the final independent disposition belong to the
corrective record and Astra follow-up, not an inferred waiver.

Final receipt: independent Astra review of025e587 scores the affected shops4.00/5 (all six criteria4). The broader PR remains unapproved due to inherited world/performance concerns. See docs/qa/station-shop-enclosure-astra-review.md for exact evidence and bounded motion limitations.


## User correction: GPT browser bridge for Meshy

Cees explicitly instructed: use GPT for the Meshy bridge. The initial Claude
Chrome capability check was the wrong route. Its session limit is not evidence
that the GPT bridge or Meshy is unavailable. Use the configured GPT/Astra Codex
browser integration, verify actual connection/login, and retain exact job
provenance. Do not revert to Claude based on older handoff routing notes.


## Meshy soft-prop finishing — 2026-09-06

Cees explicitly authorized texturing and topology reduction on generated Meshy
models. Use the GPT/Astra browser bridge and existing versions. For the bounded
shop pair, Fixed / Custom / Triangle remesh targets of 1,500 and 2,500 produced
UI counts of 1,207 jacket faces and 2,571 tool-roll faces. A target is approximate;
measure actual GLB triangles after export. Preserve originals and rejected versions.

Inspect UV and every PBR map again after reduction. In this run, the jacket's
initial UV generation failed/refunded; UV generation on its reduced version
succeeded. Reducing the textured roll retained colour, roughness and metallic
previews but lost the Normal preview, requiring a final PBR texture pass. Finish
topology first when practical, then verify texturing on that exact derived mesh.
The first jacket texture missed its requested palette; a focused colour retry
restored blue fabric and pale patches. Provider success does not establish art
acceptance, correct exported maps, or game integration.

Meshy 7 Flagship offered a minimum 2K source texture size in this session. Keep
that source outside public and derive the project's 1024² runtime maps during
local intake. Preserve already compliant provider topology instead of applying
a second unconditional Blender decimation. Check angular collars/folds at the
actual fitted counter size and obtain independent Astra review in the game.

Exact settings, prompts, failures and recovery instructions live in
assets/station-shop/soft-props/ and docs/qa/station-soft-props-record.md. Browser
approval rejected the original GLB download; no export or runtime integration
is claimed. Complete authorized provider edits separately, then obtain approval
for that specific rejected download before retrying.


## Cees correction: GPT image before Meshy — 2026-09-07

The two text-to-3D retail props were rejected by Cees despite completed provider
texturing and reduction. Their receipts remain failure history; do not reuse
the provider ready-for-export status as an art approval.

For this organic/soft-prop pipeline, first use GPT image to establish ONE item
in an isometric view on a white background, with no cast/contact shadow or scene
props. Save separate images per item and inspect silhouette, fold construction,
material palette and whole-object framing before upload. Keep exact prompts,
source PNGs and hashes. User direction supersedes the earlier text-first route.

Upload the selected image through Meshy Image to 3D, confirm the visible thumbnail
and record source hash plus provider settings. Compare reconstructed geometry
with that source from multiple angles before remeshing. Retain detailed originals,
then reduce with silhouette checks and verify UV/PBR maps on the final version.
A beautiful reference is not proof of a good generated mesh; provider completion
is not game acceptance. Keep the Blender scale/origin, actual export budgets,
local resource loading, game-render checks and independent review steps.

The first replacement reference pair is in
assets/station-shop/soft-props/image-to-3d-v2/. Root generated and inspected both
with the built-in GPT image tool; Meshy reconstruction remains separately tracked
in that directory's receipt. The previous export denial is not approval for a
new download. No rejected original model has entered the game.


## Upload permission diagnosis — 2026-09-07

Read-only diagnosis found no saved file-access grant for the installed ChatGPT
Chromium extension. Chromium's DOMHandler::SetFileInputFiles returns the exact
“Not allowed” error when allow_file_access is false, and its extension debugger's
MayReadLocalFiles delegates to util::AllowFileAccess. The supported setting to
check is ChatGPT extension Details > Allow access to file URLs. This is the
likely cause; no setting has been changed and no successful retry is claimed.
User should enable that specific permission in chrome://extensions, then use a
fresh bridge attachment for verification. Do not disable browser security or
change global Codex approval policy. Sources:
https://raw.githubusercontent.com/chromium/chromium/main/content/browser/devtools/protocol/dom_handler.cc
https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/extensions/api/debugger/debugger_api.cc
https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions


## File-access permission verified — 2026-09-07

Cees confirmed enabling ChatGPT extension > Allow access to file URLs. A fresh
GPT browser attachment then uploaded the exact jacket PNG successfully through
the documented file chooser. The operator visually verified the thumbnail and
submitted one High Detail / Meshy 7 Flagship Image-to-3D job, with Texture on
and Image Enhancement off to retain the supplied reference. This confirms that
the file-access change resolved the observed upload failure in this workflow.

Keep the pre-permission zero-job receipt intact. The continued operations and
actual charges belong to image-to-3d-v2/meshy-after-file-permission-receipt.json.
Model generation, final appearance, topology, maps, exports and game acceptance
remain separate checks; successful input upload establishes none of those.


Smart Topology follow-up: the same images yielded 4,330-face jacket and
4,145-face roll originals. Their 1,925/3,926-face remesh variants met the caps
but visibly damaged folds and were rejected. Preserve the better originals for
local review; never equate a provider triangle count with art acceptance. Even
a modest Meshy remesh can change topology/silhouette substantially. For a small
export overshoot, the prepared Blender intake trims to the maximum cap, not the
lower aspirational target. A much larger budget difference (this jacket) needs
an explicit author/reviewer decision before cleanup. Actual local GLB fitting,
PBR-file validation and game review remain pending in the production record.

## Aeon exterior geometry checkpoint — 2026-09-07

The opt-in `?dev=1&stationExterior=1` exterior is reproduced by
`blender/build_station_exterior.py` (hero and `--lod`), with editable sources and
manifests under `assets/station/exterior/`. FixedStructure, RingTemplate and
HubShellDetail are required nonempty assemblies. Runtime clones one ring at each
X ±1110 m pivot. Never change the twenty original bay frames to fit new artwork.

Hero and distant GLBs total 3,806,864 bytes; their assembled counts are
96,704/54,944 triangles and 22 draws each. The distant export removes bevel detail,
switches at 4200/3800 m with hysteresis, and follows the exact hero ring poses.
Collision always uses the immutable hero trees. Both ring instances share mesh
resources. Grain UVs are reconstructed once from decoded geometry; Blender keeps
editable UVs, but a unique painting atlas and final material pass do not yet exist.

Validate actual triangle/room intersections, not only vertices: a rejected support
face crossed the concourse while all corners stayed outside the room. Empty named
assemblies must fail before replacing the legacy mesh/BVHs. Independent final CPU
review passes the corrected geometry, optional-load fallback and LOD physics.
See `docs/qa/station-exterior/production-record.md` for exact hashes, failed checks,
actual Chromium images and input coverage. Silhouette 4.0/5 is a geometry-direction
score; materials 2.8/5, final art approval and hardware timing remain pending.
