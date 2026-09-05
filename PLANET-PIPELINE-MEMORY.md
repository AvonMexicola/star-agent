# Star Agent planet creation pipeline — durable project memory

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
and no atmosphere/sky environment fill. The distant Aeon atmosphere remains visible
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
