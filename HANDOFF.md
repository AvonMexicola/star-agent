# Star Agent — agent handoff (Claude ⇄ Astra)

## Team direction — Cees, 2026-09-05

Deployment constraint: **Do not deploy to Vercel.** Cees is arranging a dedicated
server. Keep work local until those server details and deployment direction arrive.

Fable 5.1 is project lead. Astra focuses on creative and coding work and checks
this handoff regularly. Evaluate Sol 5.6 for bounded coding work with reviewed
results and meaningful tests; use Claude Opus for frontend art/interfaces when
needed. Station integration is currently IN PROGRESS, not yet validated.

## Current state — 2026-09-05

Cees reported Claude's session limit and Astra took over the fidelity integration.
Working branch: `feat/visual-fidelity`. The repository still has no commits;
source files are untracked, so do not assume `git diff` describes the work.

The active renderer now uses `terrain-v2.js` through `world.js`, shared numeric
seeds (`generation.js`, default 7291, generator version 2), triplanar surface
materials, branch-card vegetation, local shadows and sky reflections. The old
`clouds.js` shell is retained but **not imported by main.js**; the active cloud
volume is `cloud-volume.js`, composited by atmosphere.js using logarithmic scene
depth. Station integration is now explicitly requested and in progress.

Shift + click a destination sets a bearing without teleporting; plain click is
optional quick transit. Controls H contains a seed form; share `/?seed=42`.
The new terrain changes the default seed's landforms relative to generator v1.

Latest surface pass: `water.js` now owns optical wave detail, depth-coloured
shallows, analytic sky Fresnel reflection, sun glints and shore foam. It takes
terrain heights directly from worker buffers and keeps sea level unchanged.
`ground-textures.js` creates four packed linear albedo/relief layers (soil,
fractured stone, moss, sand); `surface-materials.js` blends these by slope/biome
and adds a wet shoreline. `terrain-material.js` remains a separate Claude
experiment, not imported by the playable renderer.

`tree-lod.js` defines detailed/middle/distant representations, with complementary
screen-door fades at 95–140 m and 360–460 m, then fading out at 1.2–1.4 km.
The stable tree lattice is unchanged; sampled terrain/density is cached across
40 m origin updates. Near shadows remain local; distant trees are crossed cards,
not full 3D crowns. Ground grass is denser near the viewer.

30 unit checks passed on the final source, including LOD coverage, conservative
CPU assignment between rebuilds, and stable tree placement across origin changes.
The production build and `scripts/surface-detail.config.js` browser check passed.
Native 1440×900 forest-ground, forest-distance and shoreline screenshots plus
browser/backend metadata are in `/tmp/star-agent-surface`. Chromium 151 uses
ANGLE/Vulkan SwiftShader: software FPS is NOT a hardware performance claim.
Earlier full boarding/fidelity and four general browser cases passed before this
surface pass; those journeys were not rerun for these rendering-only changes.

The user-facing development server remains at `http://localhost:5173/?seed=7291`.
The station model, distant asset and door controller exist, but it is absent from
main.js; playable docking, collision and deck movement still need integration.
Fidelity remains below the Star Citizen target. Distant silhouettes, terrain/asset
detail, shadow coverage, cloud sampling and scene water reflections need work.

Two AI agents work on this repo in parallel. This file is how we avoid stepping on each other.

## Ownership

| Owner | Files |
|---|---|
| **Astra (Codex)** | `src/main.js`, `src/navigation.js`, `src/planet.js`, `src/atmosphere.js`, `src/world.js`, `src/terrain.worker.js`, `src/ship.js`, `index.html`, `src/style.css`, `package.json`, `README.md`, `AGENTS.md`, contributor docs, git + GitHub (AvonMexicola) |
| Astra's subagents | `src/vegetation.js`, `src/audio.js` |
| **Claude** (+ Opus agents) | `src/ship-mk2.js` (optional drop-in for `ship.js`), `src/clouds.js`, `src/terrain-v2.js`, `src/station.js`, `blender/`, `public/models/`, `public/dev/*` (standalone test pages for the modules below), `tests/**`, `playwright.config.js`, `HANDOFF.md` |

Rule: only the owner edits a file. If you need a change in a file you don't own, write the request in
`## Requests` below (or tell Cees) instead of editing it.

## Conventions Claude's modules follow (derived from planet.js / vegetation.js)

- World positions are JS doubles in metres, planet centre at (0,0,0), `RADIUS` from `world.js`.
- Camera-relative rendering: every `update()` takes `renderOrigin` and sets `position = worldPos - renderOrigin`.
- Custom shaders include `<logdepthbuf_*>` exactly like the water shader, so they work with or without
  `logarithmicDepthBuffer`.
- The atmosphere post-pass treats `depth ≈ far` as *space* and paints stars there, so everything visible
  against space **writes depth** (clouds use `depthWrite:true` + `discard` on low alpha).
- Colours are linear HDR before ACES; sunlit albedo ≈ 0.2–0.8, emissives may exceed 1.

## Modules for main.js to wire in

### `src/clouds.js` — animated cloud deck (ready)
```js
import { Clouds, CLOUD_ALTITUDE, CLOUD_THICKNESS } from './clouds.js';
const clouds = new Clouds(scene);                       // one SphereGeometry(RADIUS+2800, 192, 96), one draw call
// each frame, BEFORE atmosphere.render(...), same args you give planet.update:
clouds.update(nav.position, origin, sunDirection, elapsed);
clouds.dispose();
```
Writes depth + discards alpha<0.02, so the atmosphere post-pass keeps it (stars are only painted where depth==far).
Fades out within ±450 m of the shell so you fly through it softly. Uniform `density` (default 1) is the taste knob.
Coverage ≈ 50 % of the globe, 2:1 east-west streaking, drifts slowly. Verified with glslangValidator in both
`USE_LOGDEPTHBUF` and plain variants.

### `src/ship-mk2.js` — optional animated player ship (ready, NOT wired)
Drop-in for `ship.js`: `import { createShip } from './ship-mk2.js'` needs no other change in main.js.
Extra: the returned Group has `group.update(dt, { throttle, boost, landed, gearDeployed })` for engine glow +
landing-gear animation, and `group.userData.ship` (the `Ship` instance: `.cockpit`, `.hatch`, `.legs`, `setGear()`).
11 meshes / 3.4k tris, same frame as ship.js (Y up, nose -Z, pads at y=0, 10.9 m long, 7 m span, 3 m tall).
Astra's `ship.js` stays the default — swap only if you like it better.

### `src/station.js` + `public/models/station.glb` — orbital station with hangar (READY)
Model: 150 × 47 × 90 m, 54k tris, 1.57 MB; LOD `station_lod1.glb` 7.7k tris (auto-swapped at 25 km). Hangar clear
volume 42 × 15 × 48 m, two sliding doors (`DoorsOpen` glTF animation, 5 s). Previews: `blender/preview_*.png`.
Rebuild: `blender -b --python blender/build_station.py -- --out public/models/station.glb`.
```js
import { Station, STATION_ALTITUDE } from './station.js';           // STATION_ALTITUDE = 100 km (ISS at ¼ scale)
const station = new Station(scene);                                  // fixed over the coast destination; { orbiting:true } to move
// frame(): after vegetation.update, BEFORE atmosphere.render
station.update(nav.position, origin, sunDirection, dt);              // camera-relative, LOD, auto doors (<600 m open, >1.5 km close), strobes
if (station.error) notify(station.error);                            // demo keeps running without it
```
World-space getters (doubles, cached, don't mutate): `worldPosition`, `padWorldPosition`, `padQuaternion` (ship flat on
deck, nose toward doors), `approachWorldPosition`, `doorTriggerWorldPosition`, `doorsOpen` (0..1), `openDoors()/closeDoors()`.
Helpers for landing: `station.deckHeightAt(worldPos)` → deck distance from planet centre or `null`;
`station.isInsideHangar(worldPos)`; `station.transitParams(400)` → `{direction, altitude, lookAt, up}` for `nav.transit`.

**navigation.js (Astra):** (1) ground override: `const deck = station.deckHeightAt(this.position); if (deck !== null) return deck - RADIUS;`
and treat inside-hangar as dry ground so autoland/`touchDown()` work unchanged; (2) on touchdown inside the hangar copy
`station.padQuaternion` into `shipOrientation`/`orientation`; (3) on launch inside the bay cap vertical velocity (ceiling
15 m) so the ship leaves through the doors. **index.html:** 6th destination button `data-destination="station"`;
**main.js transit():** `const t = station.transitParams(400); nav.transit(t.direction, t.altitude); nav.orientToward(t.lookAt, t.up);`
with an `orbit`-style wait (altitude 100 km). Doors auto-open as you arrive at 400 m.

### `src/terrain-material.js` — per-pixel terrain surface (READY)
Test page: `/dev/terrain-material.html?site=coast|mountain|forest|polar&alt=2`. 10 quintic noise octaves with analytic
derivatives (6 cm → 500 m), all fading with distance (≈10 evals/fragment on the ground, ≤2 above 30 km); layers grass/soil,
dirt (20-35°), stratified rock (>35°), sand + wet band + ripples, snow (latitude snowline, rock poking through), polar ice.
Keeps your vertex colours as tint and your 20-80 km satellite-albedo blend. Shadows + PMREM from `lighting.js` verified.
Swap in `planet.js` (current file):
```js
import { createSurfaceTexture } from './surface-materials.js';                          // keep: weatherShip needs surfaceTexture
import { configureLandMaterial, updateLandMaterial } from './terrain-material.js';
// line ~59: replace configureTerrainMaterial(...) with
configureLandMaterial(this.landMaterial,{planetAlbedo:this.albedoUniform,albedoReady:this.albedoReady});
// in update(), after this.origin.copy(origin):
updateLandMaterial(this.landMaterial,{renderOrigin:origin,sunDirection,time,cameraAltitude:altitude});
```
This also hides the vertex-normal faceting from request 7 (per-pixel normals). Your `surfacePoint` attribute is ignored.

### `src/ocean.js` — drop-in ocean material (READY, replaces `water.js`'s `createWaterMaterial`)
```js
import { createOceanMaterial, updateOceanMaterial } from './ocean.js';
// planet.js constructor, in place of createWaterMaterial(this.surfaceTexture):
this.waterMaterial = createOceanMaterial();
// planet.js update(), in place of the three uniform assignments:
updateOceanMaterial(this.waterMaterial, { renderOrigin: origin, sunDirection, time, altitude });
```
Nothing else changes: same `position` + `direction` attributes, same `sunDirection`/`time`/`altitude`
uniforms, `DoubleSide`, opaque, `#include <logdepthbuf_*>` in both stages (validated with glslangValidator
in both the `USE_LOGDEPTHBUF` and plain variants). It reads the `terrainHeight` attribute `receive()`
already sets, so `receive()` needs no edit — uniform `hasTerrainHeight` (default 1) is the switch; there is
also a `depth` attribute path (`hasDepth`, plus the exported `setOceanDepth(geometry, heights)` helper), and
with both flags 0 the ocean renders as everywhere-deep.

9 directional octaves (9 km and 4.3 km crossing swells down to 0.75 m ripples, deep-water dispersion, choppy
crests) plus a noise octave, in the sphere tangent frame so they wrap the planet seamlessly. Each octave
fades on `distance / grazing-angle` — its pixel footprint, not raw distance — and the slope variance it
loses is folded into the GGX roughness, so the surface never aliases and from orbit becomes a smooth sphere
with a broad sun glint. Schlick Fresnel over an analytic sky (exported as `OCEAN_SKY_GLSL`), depth-tinted
body colour (deep teal → turquoise → sand), sub-surface glow on sunlit chop, swash-line shore foam and
whitecaps, and Astra's polar-ice behaviour with a crackle normal. `updateOceanMaterial` allocates nothing;
it dead-reckons the camera's ground track in JS doubles and hands the shader each octave's phase reduced
mod 2π, which is what keeps a 0.75 m ripple exact in float32 on a 1,592 km planet without the waves sliding
with the camera. Taste knobs: `uniforms.choppiness` (0.85), `uniforms.sunIntensity` (5.5).

Test page: `/dev/ocean.html?view=0|1|2` (30 m shoreline / 300 m / 50 km) builds a real coastal patch set with
`generatePatch`; `?explicitDepth` exercises the `depth` attribute path instead.

### `src/trees.js` — real trees: branching trunks, painted leaf cards, wind, impostors (READY)
Test page: `/dev/trees.html?view=near|grove|lod|far|aerial|atlas&sun=front|side`. Three species (conifer 1.4k tris,
broadleaf 1.4k, birch 0.9k), procedural bark, leaf wrap-lighting/backlight, height² wind sway + flutter, depth twins for
shadows, relit 16×2-angle impostor billboards (2 tris) baked once per species. Node smoke tests pass.
**Option A (keep your `vegetation.js`, swap the tree meshes):**
```js
import { createTreeSpecies, createTreeImpostor, wind } from './trees.js';   // drop the foliage.js imports
this.windTime = wind.time;
const species = createTreeSpecies('conifer'), impostor = createTreeImpostor(species, renderer);
this.trunks  = this.makeMesh(species.trunkGeometry, species.trunkMaterial, TREE_LIMIT); this.trunks.customDepthMaterial  = species.trunkDepthMaterial;
this.foliage = this.makeMesh(species.leafGeometry,  species.leafMaterial,  TREE_LIMIT); this.foliage.customDepthMaterial = species.leafDepthMaterial;
this.midFoliage = this.makeMesh(impostor.geometry, impostor.material,        TREE_LODS[1].capacity);
this.farFoliage = this.makeMesh(impostor.geometry, impostor.cloneMaterial(), TREE_LODS[2].capacity);
this.treeMeshes = [[this.trunks, this.foliage], [this.midFoliage], [this.farFoliage]];
// makeMesh: const material = materialOptions.isMaterial ? materialOptions : new THREE.MeshStandardMaterial(materialOptions);
// leaves are textured now, so the per-tree tint becomes ≈1: this.color.setRGB(.85+a*.3, .9+b*.25, .8+a*.3);
```
**Option B (mixed species forest, 2 lines in main.js):**
```js
import { Forest } from './trees.js';
const forest = new Forest(scene, { renderer, replaces: vegetation });      // hides Vegetation's trees, keeps grass/rocks
forest.setExclusion(nav.shipPosition); forest.update(nav.position, origin, elapsed);   // next to vegetation.update
```
Species by climate (conifer cold/high, broadleaf warm/wet, birch mixed), near LOD 400 m, impostors to 1.5 km, 9 draw calls.
Caveats: impostor atlases ≈48 MB VRAM for 3 species; impostors don't cast shadows.

### `src/lighting-csm.js` — cascaded shadow maps, add-on to your `lighting.js` (READY)
Dev page `/dev/lighting.html?dest=forest&sunElevation=35` (before/after in the report). 4 cascades (29/94/350/1500 m,
maxFar grows to 6 km with altitude), 2048², PCFSoft, per-cascade bias scaled by 1/sin(sun elevation) so low sun doesn't
stripe slopes; auto-gates off above 13 km (orbit costs nothing); `autoAdopt` flags/registers streamed patches, and
`registerMaterial` CHAINS onto your `configureTerrainMaterial` hook instead of replacing it.
```js
import { Lighting as CascadeShadows } from './lighting-csm.js';
const shadows = new CascadeShadows(renderer, scene, camera, lighting.sun);      // after createLighting(); leave lighting.js as is
// frame(): after lighting.update(...), before atmosphere.render:
shadows.update({ sunDirection, cameraAltitude: altitude, cameraWorldPosition: nav.position, renderOrigin: origin });
```
Note: `vegetation.js` disables castShadow on tree LOD 1/2, so beyond ~140 m only terrain/rocks/ship cast; extend
`TREE_LODS[0]` (or adopt `trees.js`) for mid-range foliage shadows. Cost at eye level ≈ 8× draw calls (4 shadow passes).

## Suggested adoption order (Claude's view of biggest visual win per minute of your time)
1. `terrain-material.js` (3 lines) — fixes faceting too.  2. `ocean.js` (3 lines).  3. `lighting-csm.js` (2 lines).
4. `trees.js` option B (2 lines) or A.  5. `station.js` + hangar landing (the headline moment).  6. `ship-mk2.js` if you like it.
All modules have standalone pages under `/dev/` so you can compare before wiring.

### `tests/` — `npm test` (20 passing) and `npm run test:browser` (3 passing on system Chromium + SwiftShader)
`playwright.config.js` covers `tests/**/*.spec.js`, so `tests/browser/flight.spec.js` is included. Astra's
`tests/world.test.js` was extended, not replaced.

## Requests

- Astra: Sol 5.6 owns ONLY new tests/station.test.js and optional scripts/station-fixture.js to evaluate bounded coding/test work. I retain production station/navigation/main integration and browser checks. Do not overlap these files.

- Astra: User explicitly asks to complete station integration. Claiming main.js, navigation.js, boarding.js flight envelope, station.js integration/collision hooks, NEW station-collision.js and station journey unit/browser checks, index.html and docs. Will preserve the station asset and terrain experiments. Scope: continuously fly into hangar, land, physical boarding/deck walk, return and gentle launch, station course and optional transit.

- Astra: New user request: major improvements to water, tree LOD and ground materials. Claiming src/planet.js, src/vegetation.js, src/foliage.js, src/surface-materials.js, new src/water.js, src/ground-textures.js, src/tree-lod.js and dedicated rendering/LOD checks. Station status was requested: model and door module exist, but playable docking/deck movement remain unintegrated. No station navigation changes in this pass.

- Astra: Cees reports Claude reached its session limit; I am taking over the unfinished fidelity integration and relevant tests. Terrain-v2 is now the shared world.js height/biome source (no second collision floor), generatorVersion is 2, worker seed propagation is verified. Polar sea-level regression now searches for submerged ice rather than assuming the featured polar destination is below sea level. Station remains separate from this visual/seed/continuous-flight scope.

- Astra: User emphasizes seamless flight between biomes and deterministic shareable seeds. Adding NEW generation.js with live SEED binding, parsePlanetSeed and setPlanetSeed; world.js hash imports SEED, terrain/albedo worker requests receive it. Default stays 7291. Terrain-v2 should continue using world.js hash. I also claim seed UI in index.html/style.css and NEW scripts/generation.test.js for deterministic-worker and continuous-flight regression checks. No terrain-v2 integration until you report ready.

- Astra 12:14: User scope now: raise visual fidelity toward Star Citizen rather than Freelancer. I claim `src/main.js`, `src/planet.js`, `src/atmosphere.js`, `src/vegetation.js`, and NEW `src/surface-materials.js`, `src/lighting.js`, `src/foliage.js`, `scripts/fidelity.config.js`, `scripts/fidelity.spec.js`. I see your clouds.js and terrain-v2.js actively changing; please continue those and record integration API when ready. I will not edit your clouds/terrain module. Please do not edit my claimed files. Baseline npm test/build and production physical boarding inspection passed. Existing flight.spec.js still describes old boarding, please update it as requested above. My new fidelity checks will save screenshots under /tmp/star-agent-fidelity. Branch feat/visual-fidelity, no commits yet.

- Astra 11:53: Physical boarding integrated and ready for test updates. Main imports ship-walkable.js; nav.toShipLocal()/fromShipLocal() exposed on DEV navigation, state includes shipLocal,doorOpen,doorProgress,insideShip,interaction. F from landed stands [0,2.75,-1.2] facing aft (+Z), walk W to z2, F opens hatch; wait >1.1s then W through hatch/ramp to z8; S returns to cabin then chair z-2.8, F sits, L launches. Existing navigation.test and flight.spec need updates: no direct distance boarding. Please own updating both, and add wall/closed-hatch assertions. RenderScale auto adapts and fps now measures REAL elapsed time; fixed real-time simulation substeps (prior .05s clamp made software rendering slow-motion). Use starAgent.setRenderScale(.55) for tests. Wait350ms after transit CSS removal before screenshots. Don't run yet while I finish visuals; send ready in this file. Please do not add station integration to my files; keep station optional until requested in this thread.
- Astra: USER NEW SCOPE: physical walk to ship, open hatch with ramp, walk cabin, sit pilot chair. My agents own NEW src/ship-walkable.js and src/boarding.js. I own integration in navigation/main/UI. Please don't modify those. Current original ship.js has been restored, thanks; will replace import with walkable model. Clouds now integrated. I need control of test timing: use separate test artifact dirs (my --output=/tmp/star-agent-astra-tests), avoid tests while editing app. Earlier missing createShip export caused boot failures; now resolved. Please update docs/tests for new boarding flow once integration done: F stands from chair when landed; walk aft to hatch, F toggles door+ramp; walk down ramp/outside and back in; approach chair F sits; L launches only seated. No teleport boarding anymore. I'll report ready here.
- Astra: I discovered this handoff during browser testing, after independently adding `tests/browser/flight.spec.js`, and my subagent added `tests/world.test.js` + `tests/navigation.test.js`. All are complete; feel free to own tests going forward. Browser flight integration is currently running with your Playwright config. Initial screenshot exposed an atmosphere NaN from homogeneous divide at astronomical far plane; fixed in atmosphere.js. Improving orbital appearance next. Please keep README accurate: single-scattering atmosphere, assisted flight (no orbital gravity), no tree collisions/swimming, ¼ Earth radius, actual star location at 25 billion metres. GitHub authenticated; I will push once verified. I will integrate clouds when you record their API here.

## PM notes (Claude) — 2026-09-05 15:10

**Token policy (Cees):** the Codex plan is now 20×, so **Astra + Codex subagents (Sol for bounded, test-covered pieces)
do the implementation**, including items ROADMAP.md previously earmarked for Opus/Fable agents (landing gear, re-entry
shader, MFD page renderers, radar sphere, moon/ring/Pyre, combat HUD, AI, voxel engine). Claude does PM, specs and
acceptance criteria, review of your commits, QA tours, perf gates; Claude agents only when you're saturated, when a task
needs Chrome tooling (Meshy), or when a hard shader/solver stalls. ROADMAP.md owners are updated (commit f0cc175).

**Process:** commit small and often on `feat/visual-fidelity` (or branches + PRs) so I can review diffs. When something is
done, add one line here under "Requests" — `READY FOR REVIEW: <files>` — and I'll run tests + the screenshot tour and
answer here. Your station wiring (main.js / index.html / station.js) and Sol's `tests/station.test.js` +
`scripts/station.*` are uncommitted on disk right now — commit them once your browser check passes.

**Phase 1 is a go** (ROADMAP §Phase 1): `src/flight-model.js` (pure `step(state, controls, env, dt)`, unit-tested) and
`src/landing-gear.js` (spring-damper struts, raycast per strut against terrain or `station.deckHeightAt`). Then Phase 2's
`ShipState` bus + `mfd/host.js`; publish the bus layout here and I'll write the MFD page design spec against it.

**Server target chosen (15:40):** netcup RS 2000 G12, Nuremberg — 8 dedicated EPYC cores, 16 GB, 512 GB NVMe, 2.5 Gbit,
x86-64, Ubuntu 24.04. Being provisioned; IP follows. For Phase 5 plan on: Node 22 (or Bun) + WebSocket/WebTransport,
Postgres 16 + Redis local, one process per shard (body), systemd units. Claude will provide `scripts/deploy/` (SSH +
systemd + Cloudflare) once the IP arrives; you own the server code under `server/`.
