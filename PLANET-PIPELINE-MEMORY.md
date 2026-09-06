# Star Agent planet creation pipeline — durable project memory

Updated 2026-09-06: the current expedition combines lunar terrain v4, resource
geography, surface/space mining, controller navigation, containers and character
EVA with the sparse ring generator v2. See `docs/selene-expedition.md` for current
boundaries. Earlier dated delivery records and the original mining research below
describe their historical branch state; their decorative-only ring scope and
former population counts are not current implementation limits.

Recorded 2026-09-05 for Fable 5.1, the project manager, humans and future coding
agents. Reference bodies: Aeon and landable Selene, [moon PR #7](https://github.com/AvonMexicola/star-agent/pull/7).
This records the implemented pipeline and delivery lessons. Read current source
and contribution handoffs before reusing historical parameters. Roadmap entries
and assets on disk are not proof that a feature is wired into the running game.

## Start here

1. Claim concrete files in `HANDOFF.md` and use an isolated branch/worktree.
2. Define body centre, radius, seed/version, surface function and navigation domain.
3. Make one deterministic surface function authoritative for geometry and contact.
4. Build six cubed-sphere roots, then stream local-coordinate terrain patches.
5. Retain complete parent coverage until all four children are ready; add skirts.
6. Layer materials at orbital, landscape and walking scales without moving the floor.
7. Integrate sunlight, log depth, atmosphere and floating-origin coordinates together.
8. Wire body-relative altitude, gravity, landing, walking, jumping and physical boarding.
9. Make destinations explicit: course setting preserves position; quick transit teleports.
10. Verify numerical invariants and a complete rendered player journey.
11. Commit focused source, tests, screenshots and limitations; submit a reviewable PR.
12. File the memory and completion notice in `HANDOFF.md` for Fable. The manager
    coordinates review, merge and deployment; a local notice is not a read receipt.

The [Selene guide](docs/selene.md) covers player controls. The companion
[ship pipeline memory](SHIP-PIPELINE-MEMORY.md) owns authored ship assets, cargo
and MFD details. This document covers the environment those systems operate in.

## Source map

| Concern | Source of truth |
|---|---|
| Team ownership, manager queue | `AGENTS.md`, `HANDOFF.md`, contribution handoffs |
| Aeon constants and public surface API | `src/world.js` |
| Seed parsing, generator version and deterministic helpers | `src/generation.js` |
| Aeon terrain shape | `src/terrain-v2.js` |
| Aeon quadtree, worker scheduling and patch lifecycle | `src/planet.js`, `src/terrain.worker.js` |
| Aeon ground materials and procedural texture layers | `src/surface-materials.js`, `src/ground-textures.js` |
| Water at Aeon sea level | `src/water.js` |
| Aeon atmosphere, HDR/depth composite and clouds | `src/atmosphere.js`, `src/cloud-volume.js` |
| Local light and shadows | `src/lighting.js` |
| Gesture-started engine/wind sound, airless wind suppression | `src/audio.js` |
| Trees, grass, rocks and distance representations | `src/vegetation.js`, `src/tree-lod.js` |
| Lunar constants, deterministic crater surface and swept contact | `src/moon-world.js`, re-exported surface API in `src/world.js` |
| Lunar geometry, quadtree and geometry cache | `src/moon-terrain.js` |
| Lunar albedo, regolith material and eclipse approximation | `src/moon.js` |
| Body selection, surface position, altitude and contact normal | `src/celestial.js` |
| Movement modes, flight, landing and walking | `src/navigation.js`, `src/flight-model.js` |
| Physical chair, cabin, hatch/ramp and interaction bounds | `src/boarding.js`, `src/ship-walkable.js` |
| Scene, floating origin, destinations, HUD and diagnostics | `src/main.js`, `index.html` |
| Collision damage, when integrating the separate crash contribution | `src/impact.js`, `src/crash-effects.js` |
| Reproducible moon journey | `tests/moon.test.js`, `tests/navigation.test.js`, `scripts/moon.spec.js`, `scripts/moon.config.js` |

Alternative modules such as `lighting-csm.js`, `ocean.js` and advanced terrain
transition materials may exist on other branches. Follow imports from `main.js`
and `planet.js` to establish what actually runs. The terrain-transition contribution
has its own review lane; its geomorphing/hysteresis must not be attributed to the
initial lunar quadtree. Likewise, a GLB in the props manifest is not automatically
scattered or collidable in the game.

## Body and terrain contracts

All distances are metres. CPU world positions are JavaScript doubles, currently
relative to Aeon's centre. Aeon radius is 1,592,750 m, the atmosphere boundary is
70,000 m, and the sun is 25,000,000,000 m from the origin. Aeon uses a URL-selectable
uint32 seed (default 7291), generator version 2 and terrain version 2. A seed
identifies a world only together with the generator version and constants.

Selene has radius 434,350 m and a fixed centre 24,000,000 m from Aeon, in direction
normalize(-0.1, 0, -1). Its independently seeded 96-crater layout remains unchanged
when the Aeon seed changes. Lunar generator version 2 adds walking-scale relief.
The former flyby perimeter is superseded by terrain collision; 4,000 m now denotes
a conservative upper terrain bound for collision broad-phase, not a landing barrier.

`moonSurface(unitDirection)` returns height relative to the lunar reference radius
and linear albedo. Broad noise forms highlands/dark plains, crater bowls lower the
floor, Gaussian rims raise it, and local hills/gravel supply small relief. Negative
heights are valid land. Never apply Aeon's sea-level clamp to an airless crater.
The same sampler feeds the mesh, normal estimation, collision and walking floor.

Aeon combines smooth rotated noise at continental scales with ridged mountains,
hills and fine roughness. Continental frequencies 3 and 9 establish broad geography;
145 supplies mountain structure, 560 hills, and 4200/17000/72000/225000 progressively
smaller surface detail. Biome, vegetation and destination selection use this shared
world data. Navigation clamps submerged Aeon terrain to sea level; open water
rejects landing and polar ice remains walkable. Wave shading does not move that floor.

For a new body, specify physical/gameplay constants and deterministic shape first.
Sample a sphere using a uniform distribution, plus poles, seams and crater extremes.
Record bounds used by broad-phase collision and test them when changing the generator.
Do not copy a roadmap concept's dimensions over a working body's constants silently.
The larger solar-system roadmap is aspirational; fixed Selene is the current implementation.

## Precision and mesh pipeline

1. Select a cube face and quadtree cell `(face, level, ix, iy)`.
2. Map its grid to unit directions with `cubeDirection` from `world.js`.
3. Evaluate the canonical height and multiply direction by radius plus height.
4. Choose a double-precision patch centre on the actual terrain, including its height.
5. Subtract that centre before writing position offsets to `Float32Array`.
6. Estimate normals by tangent finite differences of the same surface function.
7. Add indexed grid triangles and perimeter skirts; compute local bounding volumes.
8. Set the mesh translation to `patchCentre + bodyCentre - cameraOrigin` in doubles.
9. Keep the camera at render origin while simulation positions stay in world metres.

Never upload a 24-million-metre lunar world position as a float and subtract the
camera in a shader afterward. Fine lunar tests reconstruct vertices after rebasing
and check their floor error below 0.00001 m. A patch centre on the base sphere
instead of the actual surface wastes precision when the crater floor is kilometres
below that sphere. This was caught and corrected during implementation.

Both bodies use 16-cell grids and a maximum level of 17. Aeon dispatches patches
through a small worker pool (1–3 workers), transfers typed buffers and prioritizes
nearby work. Its minimum refinement is level 3. Selene currently builds at most eight
new patches per frame on the main thread, refining toward the observer with a
1.8 patch-width distance criterion and minimum refinement level 2. All six roots
exist immediately. This is bounded work per frame, not an asynchronous lunar worker.

A node can replace its parent only when all four child meshes exist. Hemisphere
culling must remain conservative around patch size and local relief. Skirts conceal
neighbour resolution gaps; they do not remove geometric popping. Lunar geometry
is evicted when the node map exceeds 900 entries and a nonvisible node above level 2
has been unused for eight seconds. Metadata is retained so child references cannot
point to orphaned duplicates. The threshold is a soft geometry budget; retained
metadata can grow with exploration. A strict memory cap and geomorphing remain work.

## Material, light and atmosphere pipeline

Use broad color for orbital identity, terrain geometry for landscape silhouette,
and local material variation for walking detail. Do not use a painted crater texture
as the only ground when players can land on it.

Aeon's 1024×512 albedo is generated from the world sampler. Its ground layers are
procedural soil, fractured stone, moss and sand, with albedo/relief data and
triplanar blending by slope/biome. Use linear data conventions consistently.
Stable small coordinates (surface position modulo 256 m plus patch-local offsets)
prevent fine texture patterns from crawling during origin rebases.

Selene bakes 1024×512 linear albedo from the crater sampler; the material samples
longitude/latitude from normalized direction, avoiding a UV seam through a patch.
Near ground, a repeating procedural grain texture adds triplanar regolith variation
and fades out with distance. Height is geometry; grain is visual material detail.
The standard material retains Three.js log-depth chunks and uses a distinct program
cache key. Preserve that contract in every custom shader hook.

The scene renders to an HDR half-float target with logarithmic depth. The atmosphere
reconstructs distance using `exp2(depth * log2(far + 1)) - 1` and the view ray's
negative Z component, then works at planetary scale. Do not divide an inverse-
projection direction by homogeneous W at the near-infinite far plane: W can be zero.
Depth changes must update scene writers and the atmosphere reader together.
A successful bundler build does not validate GLSL or the composite.

Aeon's atmosphere uses approximate single scattering; seeded clouds occupy a
1.8–4.6 km layer and integrate against scene depth. Current cloud sampling can
show grazing-angle banding. Water uses an analytic sky reflection and shading
waves, without scene reflection/refraction. Those effects belong to Aeon and must
not be repositioned around Selene when the active navigation body changes.

For Selene, local sunlight uses the lunar up direction, neutral weak ambient light
and no atmosphere/sky environment fill. Wind audio is muted in vacuum; cockpit
engine hum remains available after the player enables sound. The distant Aeon atmosphere remains visible
around Aeon. A whole-moon eclipse approximation dims sunlight when Aeon occludes it;
this is not detailed penumbra simulation. Shadow casting near the ground must agree
with local altitude, and the ship must remain grounded after origin rebasing.

## Population pipeline

Aeon's vegetation is deterministically sampled from the canonical terrain/biomes,
with instanced grass/rocks and detailed, middle-distance and crossed-silhouette tree
representations. Existing tree transitions overlap roughly 95–140 m and 360–460 m,
with the distant fade around 1.2–1.4 km. Position stability across LOD, seed and origin
changes matters more than inventing a separate visual scatter floor.

Respect the parked ship exclusion region. Check the current props contribution
before placing imported flora or boulders, and test draw calls, scale, slopes and
bounds. Selene currently has regolith terrain only: no flora, scattered rock GLBs,
resource nodes, settlements or caves. Do not imply those systems are implemented.

## Navigation, contact and exploration

`celestial.js` selects Selene within eight lunar radii of its centre; otherwise
navigation uses Aeon. This is an explicit prototype domain, not an N-body solver.
Position stays continuous at the boundary. Suppress gravity-frame camera transport
on the switch so flight does not rotate the camera through 180 degrees.

Compute altitude as distance to the active body's centre minus its radius and
sampled terrain height. Use body-relative radial up for walking and controls.
Use the actual terrain slope normal to orient a landed lunar ship. Selene gravity
is 1.62 m/s² at the reference radius with inverse-square scaling in flight, and
its flight environment has zero atmospheric density/drag. Assisted flight still
compensates gravity; inertial flight does not. Walking jump acceleration uses the
body's surface gravity (station decks retain Earth-like gameplay gravity).

Swept lunar contact first intersects a sphere enclosing all terrain, then samples
the actual heightfield along the segment. It handles fast rays whose endpoints
both lie outside Selene. A conservative slope allowance, small contact tolerance
and refinement locate the first contact at the ship's 3.2 m flight clearance.
If the tracing budget is exhausted, movement stops at the checked point instead
of trusting the unexamined remainder. Keep the radius-only `moonAltitude` helper
out of terrain clearance decisions; use `bodyAltitude` there.

Contact leads to the existing landing/boarding states. The ship root is placed on
the surface; the eye is placed using `SHIP_LAYOUT`, not by setting the whole model
at eye height. `boarding.js` defines cabin floor, chair, hatch and ramp. Walking
uses that local floor while aboard, transitions down the ramp, and uses canonical
terrain outside. Interaction never teleports an outside player into the chair.
Space jumps and returns to a 1.75 m eye height on lunar terrain. Returning physically
to the chair permits sitting and launch. Reusing the same state methods preserves
controller support; test the complete journey rather than only individual bindings.

When composing with the independent hard-crash contribution, assess pre-contact
velocity against the lunar terrain normal before zeroing velocity or touching down.
Its threshold is 12 m/s into the surface; tangential speed alone is not impact speed.
Preserve crashed-state input guards, effects and orbit reset. The initial standalone
moon branch has gentle-contact behavior until that contribution is integrated.

## Destinations, diagnostics and player presentation

Selene's optional transit arrives 180 m above the selected near-side terrain.
Shift-click only sets a course; it must leave position unchanged. Continuous flight
uses the same collision and body selection as transit. Allow terrain to refine
under the transit cover, with a bounded wait. Return-to-orbit clears landed/boarding
state and restores Aeon's environment.

HUD altitude, latitude/longitude, mode and terrain patch count refer to the active
body. Moon diagnostics must say lunar terrain, not an Aeon biome sampled using
lunar coordinates. `window.starAgent.state` exposes body, lunar LOD, altitude,
flight environment and boarding state. Mutable navigation is exposed only in dev
or with `?debug` for reproducible tests; avoid presenting implementation details
in normal player controls.

## Verification and delivery recipe

Run in the actual target worktree, using the repository Node requirement:

```sh
npm test
npm run build
node --test --test-isolation=none tests/moon.test.js tests/navigation.test.js
npm run test:browser -- -c scripts/moon.config.js
```

When shared boarding, flight or shader code changes, also run the existing relevant
station, crash, controller or physical-boarding checks. Count actual test cases,
not just test-file subprocesses. A sandbox may require permission for a local
preview listener; use the approval mechanism instead of bypassing restrictions.

The moon browser mission uses real UI/keyboard interactions to set a course,
transit, land, leave the chair, open the hatch, walk outside, jump, return up the
ramp, sit, launch and return to Aeon. It checks body/environment, terrain refinement,
walking height and browser errors, and captures the surface, parked ship, Aeon
from the moon and orbital view. Numerical tests cover high-speed crossings,
negative-height ground, poles/seams, adjacent patch edges, normals, precision and
body-domain continuity. Visual review must inspect terrain/ship alignment and
sky/depth as well as console errors.

Evidence goes under `/tmp/star-agent-moon-evidence`; curated screenshots belong in
`docs/`. Record browser, GPU backend, viewport and render scale beside screenshots.
Reference validation uses Chromium 151, ANGLE/Vulkan SwiftShader, 1280×800 at render
scale 0.55. Software rendering proves rendering behavior here; it does not prove
laptop GPU frame-rate targets. Give slow machines bounded but realistic timeouts.

Preserve concurrent work through a three-way merge against the exact known base.
Save shared files before editing and verify they have not changed before writing
resolved results. Never copy isolated `main.js` or `navigation.js` wholesale over
a shared checkout with ship, crash, inventory or other contributions. Integrate
semantic conflicts explicitly, rerun the combined build/journey and record differences.
A green isolated branch does not prove the combined checkout is green.

Submit a focused PR with final scope, controls, test results, screenshots and known
limits. If the manager requests a base change, rebase in the isolated checkout,
preserve other contributions and repeat relevant validation. Update the title/body
when the feature grows from flyby to landing. Post a completion notice linking this
file, the PR and evidence in `HANDOFF.md`; don't claim that Fable has read it or that
the feature is live unless a real acknowledgment/deployment result establishes that.

## Remaining limitations and safe next steps

- Two fixed bodies; no orbit evolution, N-body gravity or generic body registry.
- Lunar terrain generation is synchronous and has visible discrete LOD changes.
- Geometry cache is soft-bounded; long-session metadata pruning is future work.
- Contact is a radial heightfield approximation with a tracing budget, not rigid-body
  landing gear physics, caves, overhangs or terrain deformation.
- No lunar resource interaction, footprints, oxygen simulation or survival systems.
- No lunar rock assets or vegetation population; procedural grit is visual detail.
- No broad hardware performance evidence; optimize only after profiling the target GPU.

For a third body, first generalize the body descriptor/surface sampler and swept
contact without regressing Aeon water, Selene crater floors or station decks.
Then add a distinct generator, local patch renderer, atmosphere/material policy,
explicit destination and complete land–walk–reboard regression journey.

## Delivery record — lunar landing, 2026-09-05

- PR #7 was rebased onto `origin/feat/visual-fidelity` at `0e9e921` per the manager's
  queue. It retains the controller contribution, originally PR #3, as a dependency.
- The shared checkout includes separate crash work; lunar contact integration uses
  its real impact policy. Preserve that composition when merging the review branch.
- Final unit checks: 70 cases in the rebased review branch; 76 in the shared checkout
  including the six independent crash cases. Builds pass in both.
- Complete production lunar browser journeys pass in both: 40.5 s isolated and
  39.8 s shared, without page/console errors. Landed terrain reaches lunar LOD 17.
- Surface, ship/ramp and distant Aeon screenshots were inspected. Curated evidence:
  `docs/selene-landing.png`, `docs/selene-aeon.png`.
- Wind audio was subsequently made body-aware and verified with a focused audio
  regression plus the full unit suite and production build.
- Memory is filed locally and announced in `HANDOFF.md`; review/merge/deployment
  remain in the project manager's queue. No manager read receipt is asserted.


## Lunar landscape pipeline update — 2026-09-06, generator v3

Cees requested more interesting terrain, slopes/craters, sunlight-reflecting ice
particles and majestic asteroid rings, using Cellin as a visual reference. This
supersedes v2's regolith-only visual scope and the old 4,000 m terrain bound.

`moon-world.js` now owns a 16,000 m conservative upper bound, deeper global crater
profiles with ejecta/central peaks, local impact basins, fractured ridges and compact
basalt outcrops. All are in the canonical heightfield, so navigation and rendering
still share the floor. The original landing direction now has a shelf on a large
crater rim; a 35 m flat centre blends into the terrain by 150 m. Its absolute height
changes with generator version 3. Do not reuse old recorded landing coordinates.

`moon-terrain.js` evaluates a one-cell halo and reuses those samples to compute grid
normals. This avoids four extra heightfield calls per vertex and filters normal
detail to the rendered grid spacing. Parent fallback and skirts remain; nearby
orbital views use minimum LOD 3 while distant views keep minimum LOD 2. The expanded
terrain bound also feeds conservative horizon culling. The maximum LOD remains 17.

`moon.js` shades cool basalt, height bands, frost and fine regolith relief. It owns
`MoonRings` (`moon-rings.js`) and `MoonIce` (`moon-ice.js`). `main.js` supplies elapsed
time and whether the player is outside the ship, and exposes effect counts in
`state.moon.effects`. Ring bands are a transparent annulus with gaps and filtered
radial striations, plus 1,800 instanced asteroids. Dust-band opacity fades between
20 and 80 km from the observer to avoid an opaque-looking sheet inside the belt. Both shade the moon's obstruction
of sunlight. Rock instance translations subtract camera origin in doubles before
float upload; close-range precision is covered by a regression.

Ice cells are keyed in absolute lunar coordinates. The effect samples the real
terrain to keep initial particles above it, uses a small drift/glint animation,
fades at its bounds and is disabled in the ship. A fixed-capacity position/phase
buffer is updated in place as cells change. Replacing BufferAttributes on every
cell rebuild would leave old GPU buffers difficult to reclaim; reuse is deliberate.

Rendering lesson: a transparent object with depthWrite=false disappeared against
empty sky in the previous atmosphere composite, which selected only stars when
scene depth was clear. Writing opaque depth to force visibility produced speckled
rings and dark particle dots. The HDR target now clears to alpha zero, retains its
premultiplied scene color, and composites stars/sun through remaining coverage.
Normal ring alpha blends normally; additive ice changes RGB without masking the
sky. Log-depth reconstruction is unchanged. This shared shader change requires
checking Aeon water/sky as well as the moon; a build alone cannot validate it.

The terrain bounds still fit inside the separate travel contribution's 20 km lunar
exclusion margin. The ring is decorative and is not a new travel target or collision
hazard. Mining, moving orbital bodies, terrain deformation, particle thermodynamics,
ring shadows on the lunar surface and rigid-body asteroid impacts remain future work.
For merge ownership, review results and screenshots use `LUNAR-LANDSCAPE-HANDOFF.md`.


## Surface identity and extreme relief — 2026-09-06, generator v4

Cees found Selene visually uniform and difficult to navigate by landmarks. Two
causes were identified: the supplied preview address (5178) served opening-work,
and v3's 1024-wide global albedo map represented kilometres per pixel on foot.
Always verify the service working directory, successful startup and served asset
hash against the built dist; HTTP 200 alone does not identify a branch.
The lunar production preview now has its own star-agent-selene-geology service
at http://127.0.0.1:5180/; opening's server remains untouched.

V4 removes the orbital albedo texture dependency. moonSurface returns linear RGB
material colors shared by terrain vertices and skirts. Fixed geographic masks
produce dark Obsidian Crown, blue-white Glass Rift, Copper Ejecta and icy Frostwall.
moonRegion names those districts plus Crescent Rim/Basin, Twin Spires and the
highlands in the existing lunar biome label/state. Labels do not teleport players.
Broad color fields avoid aliasing on distant meshes; sub-metre detail uses a
periodic, mipmapped triplanar fracture/relief texture. Do not sample sub-metre noise
only at distant terrain vertices: this produces a patchwork grid when interpolated.

The canonical heightfield adds a winding 180 m ice-fault trough, deepens local
impact bowls, and raises three mountain groups with 6.2–7.6 km contributions.
Peaks are several kilometres from the shelf so the sky and ring remain visible.
The 35 m level landing area, shared walking floor, low gravity and physical ramp
remain. The conservative 16 km upper bound and travel exclusion contract remain.
Heightfield geometry still cannot form overhangs or caves.

Streaming lesson: horizon-culled siblings still form part of a visible parent's
all-four-children replacement dependency. Evicting them repeatedly rebuilt meshes
and exposed coarse mountain fallbacks. Mark required siblings recently used, even
when they are culled. A regression advances the cache clock beyond expiry and
checks a stationary view requires zero new builds. Visual tours wait for zero
terrain builds before taking surface/survey evidence; maximum LOD alone only
proves that some nearby patches are loaded, not the mountain landscape.

Verification covers distinct material/region identities, shared material edges,
more than 7.5 km local relief, collision/landing/walking, cache stability and actual
Chromium shaders. Full suite: 77 unit cases across nine test files. Production
lunar journey and render tour pass; the final shader/cache refinements receive a
new render tour. Evidence includes docs/selene-geology.png and updated crater view.
Use LUNAR-LANDSCAPE-HANDOFF.md and PR #15 for integration boundaries and delivery.


## Mineable assets and mountain research — 2026-09-06

Cees requested No Man's Sky-inspired mineable rocks and Selene ridges/mountains,
with freedom to choose an alternative to voxels. The primary-source research and
proposed implementation are in [docs/selene-mining-research.md](docs/selene-mining-research.md).
This is research only, not an implemented miner or a measured performance result.

Recommendation: keep the global heightfield, improve connected ridge morphology,
and introduce smooth scalar-field chunks for local mineable rocks/outcrops. Start
with worker Marching Cubes; compare Dual Contouring if sharp faces warrant it.
No Man's Sky's 2024 notes name Dual Marching Cubes, a distinct algorithm. Retain
WebGL2 initially because renderer migration would require porting custom shaders.

Read Phase 6 and the shared equipment lane before implementation. The existing
onMine callback reports a beam endpoint and m³/s budget; it needs a validated hit,
coalesced removal budget, actual removed-material accounting and ore inventory.
Mesh geometry alone is not a mineable asset. Local rock metadata and reproducible
chunk memory arithmetic are filed in docs/selene-mining-asset-audit.json and
scripts/research/audit-mining-assets.py. Topology and runtime speed remain untested.

Key contracts: retain matching mesh/collision revisions, reject stale worker jobs,
keep edits across distant proxy swaps, compact growing edit logs, and prevent
repeated empty-space mining/replay from granting resources. Terrain excavation
must replace both visible surface and radial collision in its owned domain;
shader-only holes leave an invisible floor. Prototype an independent rock first.
A 32-cell chunk needs 33 corner samples per axis; choose 0.125–0.25 m cells for
small rocks, and budget mesh/collision/halo memory in addition to density arrays.
The roadmap's <4 ms meshing claim is a target awaiting measurement.


## First mineable rock implementation — 2026-09-06

Playable implementation is documented in [docs/selene-mining.md](docs/selene-mining.md).
A single 4 m volume at Crescent Rim uses 32³ cells / 0.125 m sampling, interior
copper/ice/basalt fields, budgeted subtraction, saved sample containers and the
existing Equipment mining laser. The first mesher uses a consistent tetrahedral
split, not the research's proposed Marching Cubes/optional Dual Contouring path.
Closure tests cover the uncut and carved mesh. This is a bounded proof of mining,
not a whole-planet voxel conversion.

The worker prepares geometry, packed triangle collision hierarchy and compact
float snapshot together. Main publishes the mesh/collider only after saving the
matching field + cargo transaction. Stale results cannot overwrite current state.
The first render exposed a main-thread stall from building collision and encoding
JSON there; moving both preparations into the worker reduced publication overhead.
Measure worker and publish latency separately; no <4 ms worker claim is established.

Navigation's optional surfaceObstacles hook sweeps the player capsule and adds
support-aware jumping. Removing support makes the player fall under lunar gravity.
Ship contact uses a conservative clearance sphere. Material color at cut faces is
procedural in rock-local coordinates, independent of exterior UVs. The survey
pouch/locker has dedicated 12/48 kg capacities and is accessed through cargo UI.
Resource mass represents gameplay concentrate, not actual bulk geological density.

Preview is a dedicated star-agent-mining service on http://127.0.0.1:5203/.
The existing 5180 geology preview is preserved. Save ID and generator version are
separate from the planet seed. The snapshot is browser-local, single-volume and
not coordinated across tabs/network peers. No debris physics, cave-floor replacement,
mining of ring rocks, or resource crafting is claimed. See the guide for merge hooks,
source provenance, validation and remaining independent manager/visual review.


## Expedition follow-up: controller, containers, EVA and populated rings

Cees tested first mining and identified missing visible beam/texture, controller
access and backpack UI. Explicitly authorized a multi-agent implementation team.
Controller, inventory and EVA lanes are integrated by the expedition root; see
docs/selene-expedition.md for the concrete feature and storage boundaries.

- All new interactive features require controller actions, visible bindings, modal
  navigation, disconnect/focus/re-arm safety and a controller-only acceptance route.
  The contract is now in AGENTS.md and docs/controller-contract.md.
- One slot/box inventory schema and dialog serve backpack/ship/station/base caches;
  resource transfers and density edits remain one atomic browser save. New boxes
  add slots and mineral capacity; the real Crescent field cache exercises base storage.
- Laser custom shader uses the scene logarithmic depth convention; material wear
  is generated locally and sampled in tool coordinates. A beam in empty space
  produces no resources, and impact effects require a validated hit.
- Current ring generator v2 retains 14,336 stable descriptors in a 20 km radial
  by 2 km vertical band, with at least 2,132.11 m neighboring bounding clearance.
  It supersedes the initial expedition's 20,971,520-descriptor v1 population.
  Large rocks have 24 fractured variants and three geometry LODs out to 80 km;
  original small-rock shapes remain editable. Excavation retains two live ring
  workers and eight persisted additional survey snapshots shared with provinces.
- Large asteroids remain procedural collision geometry pending chunked mining;
  small representatives of all six families are hand-mineable in EVA. Preserve this
  distinction in UI/docs. No massive unbounded mesh allocation or pristine LOD over cuts.
- EVA uses real hatch/ramp exit and return, suit inertia/thrust/braking and shared
  obstacle hooks. It adds no remote teleport-to-chair shortcut. Fuel/oxygen and
  orbital mechanics are not claimed as implemented.

This update replaces no manager review requirement. Final test/evidence counts are
recorded in the expedition review handoff, not inferred from earlier mining PR #21.


## Resource geography is visible from orbit

Cees requested surface color patches that reveal where to find resources. The
canonical `moonResources(direction)` now supplies normalized basalt/copper/ice
weights, a dominant mineral and province name. Both orbital fallback and streamed
ground patches use `moonSurface` colors from those weights; no separate texture or
heightfield is introduced. Resource version 1 is separate from terrain version 4.
The existing crater/mountain height fixtures and Crescent landing shelf are intact.

Blue-white marks ice, rust-red copper and dark slate basalt. Five broad provinces
are large enough to survive orbital mesh sampling. Existing near-Crescent named
geology overrides those broad masks locally. A HUD legend reports the region below
the ship, and the shared command menu offers controller-accessible survey routes.

Each province has a deterministic mineable outcrop, with at most one additional
surface worker. The landing approach is offset from its collider. The outcrop's
profile drives discrete mineral seams, mesh colors, shader classification and
worker yield together. Shared atomic saves preserve cuts and collected cargo;
changing visual LOD cannot regenerate a pristine shell over an edited deposit.
Crescent retains its saved geometry and now follows the local resource profile.
The eight additional saved deposit slots are shared by provincial and ring rocks.

The surface heightfield is not itself excavatable. Province fractions describe
regional composition, not a guarantee that every individual cut returns that exact
mixture. Keep future assets, scanners and resource yields on this same classifier.
See docs/resource-geology.md and docs/selene-expedition.md; renderer evidence and
current acceptance status belong in docs/qa/expedition/ and the review handoff.


## Player-reported expedition regressions

Tool availability must depend on player/equipment mode, never distance to a mineral
node. The first expedition incorrectly hid the tool beyond 90 metres from a deposit;
this gate is removed. The player can equip and beam into empty space without reward.

Spacecraft yaw/pitch and assisted vertical thrust use the ship's local frame.
Using lunar radial up at the ring turned horizontal stick input into roll or pitch.
Gravity-relative walking and atmospheric ascent remain distinct; travel in space
must not silently transport the ship attitude to follow the moon's radial normal.

Mining preparation prioritizes the asteroid under the aiming ray independently
of the two-nearest streaming heuristic. Tool rays and nearby collision must use
visible asteroid geometry; broad spheres are only candidate filters. Static large
asteroids must explicitly report unavailable hand mining. Retain bounded workers,
pending-job safety and atomic edits; a targeting fix must not duplicate resources
or silently restore a pristine shell over an excavated rock.


## Sparse navigable ring revision — 2026-09-06, ring generator v2

Cees requested a sparse Yela-style belt with approximately two kilometres between
asteroids, longer draw distance and sunlight glinting from nearby ice. The current
layout is 2,048 angular cells × 7 radial cells × 1 vertical cell × 1 body: **14,336
bodies**. Adjacent radial rows are staggered by half an angular cell. Tangential
and radial jitter stay within ±70 m, with height jitter within ±500 m. The nominal
band remains 20 km wide and 2 km thick at radius 903.448 km, giving an outer
physical diameter of **1,826.896 km**. Do not confuse that diameter with draw range.

V2 neighboring-cell checks cover every potentially nearest pair and the ring seam.
The minimum measured clearance between bounds of radius `1.95 * descriptor.size`
is **2,132.1115 m**. Keep every rendered variant inside that bound when changing
geometry. Three quarters of descriptors are large rocks with size parameters
24–140; one quarter is small and mineable. `ringRock(5)` remains a small survey
target. Six families × four variants supply 24 large geological shapes with
fracture planes, layered surfaces and triplanar mineral/stone/ice materials.
The original `asteroidField` remains the small-rock geometry and mining authority.

`MoonRings` retains the full deterministic v2 descriptor population. Local cells
select interaction candidates; they must not replace the population used for
long-distance drawing. Individual rocks remain visible to 80 km. Near/mid/far
geometry boundaries are nominally 4/16/80 km, with complementary fades through
3.2–4.8 km and 14–18 km, and a visibility fade through 64–80 km. A camera cell
crossing must preserve unrelated distant IDs and geometry. Positions continue to
subtract the double-precision camera origin before entering GPU buffers.

Saved v1 cuts are not migrated onto v2 asteroid positions. `asteroidDescriptorV1`
reproduces their original positions, orientations and family exactly. MiningField
attaches at most eight saved legacy descriptors to `rings.legacyDescriptors`
before the first frame. Their runtime IDs are `-(oldId + 1)` and their storage
keys remain `selene-ring-v1-*`; v2 uses positive runtime IDs and `selene-ring-v2-*`
keys. Hidden instances and collision fallbacks retain both generations without
awarding resources during restoration. Legacy player-edited deposits are an
explicit exception to the v2 spacing rule because preserving their positions and
cuts takes priority. Provincial and ring snapshots still share the eight-slot cap.

`src/ring-ice.js` owns `RingIce`, separate from the larger rock population and from
surface ice in `moon-ice.js`. Its deterministic 32 m world cells anchor slow-moving
sunlit facets; rendering keeps at most 1,200 particles inside a 104 m observer
radius and excludes the inner 12 m around the cabin. Radial/vertical ring edges,
inner clearance and outer distance fade smoothly. Camera turns and origin rebases
must not reset particle identity, position phase or sunlight response. Shader
facets produce glints and dim in lunar shadow using the existing logarithmic depth
and additive compositing conventions. These particles are visual only: no solid
collision, excavation or resource awards.

The original 20-million-body design and earlier screenshots remain historical
v1 evidence. Do not cite those runs as validation of this revision. Numerical
spacing, legacy-save and descriptor tests support their specific invariants;
final v2 shader, LOD, visibility, ice and controller browser evidence belongs in
the current expedition QA record and manager handoff. Independent visual approval
is a separate review result and is not claimed by this memory update.

Final v2 verification: all 26 numerical files pass; five distinct production
browser checks pass across the integrated run and targeted reruns, including
actual ice pixels, full ring dimensions, LOD continuity and space mining. Current
review evidence and exact fixture provenance: `docs/qa/expedition/sparse-ring/`.
Preview asset: `index-N8I1Odnu.js` at http://127.0.0.1:5213/ .


## Proposed progression — crafting, training, Pyre and Aeon caves

Cees requested material tiers, crafting and skill training, with valuable ore on
the hot inner planet requiring suit upgrades, plus dangerous Aeon cave fauna and
special loot. The concrete design draft is
[Expedition progression](docs/design/progression-crafting-skills.md). This is
future design, not a claim that crafting, Pyre hazards or creature combat exists.

Use four material tiers, with parallel Pyre industrial and Aeon cave/biological
branches. Build the first heat-protection kit entirely from accessible materials;
never require Pyre ore to unlock the first Pyre expedition. Training should credit
committed recovery, practical milestones and discoveries, not held-trigger time.
Reuse the shared box UI and controller router for recipes, modules and loot.

First proposed slice: migrate the three-resource/fixed-supply save model safely,
add station refining and a useful mining-laser heat-sink recipe, fit the result,
and validate the full controller mining/crafting/reload journey. Then prove suit
thermal behavior before the first Pyre site. Prove one cave entrance and unified
collision before adding a creature and its biological recipe. Preserve all old
cuts/cargo/boxes, atomic transactions, save identities and input suppression.
