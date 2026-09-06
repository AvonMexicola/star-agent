# Star Agent — agent handoff (Claude ⇄ Astra)

## Team direction — Cees, 2026-09-05

Hosting update from Cees: **Vercel is authorized temporarily until Monday,
7 September 2026**, when the dedicated server is expected. This supersedes the
earlier no-Vercel instruction. Claude owns deployment; Astra verifies the live build.
Production URL: https://star-agent-nine.vercel.app/ (Vercel reports Ready).

Fable 5.1 is project lead. Astra focuses on creative and coding work and checks
this handoff regularly. Evaluate Sol 5.6 for bounded coding work with reviewed
results and meaningful tests; use Claude Opus for frontend art/interfaces when
needed. Station integration is implemented and validated; ready for PM review.

## Current state — 2026-09-05

Cees reported Claude's session limit and Astra took over the fidelity integration.
Working branch: `feat/visual-fidelity`. The project now has a committed baseline
and PM roadmap commits. Preserve concurrent PM changes when staging work.

The active renderer now uses `terrain-v2.js` through `world.js`, shared numeric
seeds (`generation.js`, default 7291, generator version 2), triplanar surface
materials, branch-card vegetation, local shadows and sky reflections. The old
`clouds.js` shell is retained but **not imported by main.js**; the active cloud
volume is `cloud-volume.js`, composited by atmosphere.js using logarithmic scene
depth. The station is now wired into the playable scene.

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

34 unit checks pass, including four Sol-authored real-GLB station tests. The
four general Chromium tests pass (planet startup, continuous physical boarding,
coast transit, course/seed persistence). The final station production browser
journey passes: Shift+click course without movement, optional transit to exterior
approach, W through animated doors, X brake over pad, L dock, F stand, physical
hatch/ramp/deck walk, return to chair, gentle L launch, S reverse out.
Desktop six-column and phone-width 3x2 destination layouts and notification/course
clearance are checked. Screenshots and renderer metadata: `/tmp/star-agent-station`
(native 1440x900; phone layout 390x844). Chromium 151, ANGLE/Vulkan SwiftShader;
software-rendered FPS is not a hardware performance claim. Surface-pass evidence
remains in `/tmp/star-agent-surface`.

The local dev server was restarted at `http://localhost:5173/?seed=7291`.
Temporary Vercel hosting is live at https://star-agent-nine.vercel.app/.
The dedicated netcup server remains the planned Monday hosting target.

Station implementation: fixed at 100 km over the seeded coast. Planet altitude
remains planet-relative for atmosphere; deck support is the flat authored model
surface. Conservative triangle-bound BVH sweeps include wings/nose and animated
doors; this is conservative contact, not exact mesh physics. Docking retains ship
heading. Launch rises at 3 m/s to ~6 m eye clearance without the old 12 m jump.
Walking is bounded to the supported hangar deck; no EVA, side-room/catwalk travel,
or moving-station passenger physics. Near-station shadows and local hangar lights
are enabled. Sol proved suitable for this bounded test task after root review;
Claude Opus supplied the reviewed CSS proposal for destination/notification layout.

Fidelity remains below the Star Citizen target. Distant silhouettes, terrain/asset
detail, shadow coverage, cloud sampling and scene water reflections need work.

Agents coordinate ownership and review through this file. Read the PM notes below.

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

- Astra: Flight slice committed as 2cbac2e and published for review at https://github.com/AvonMexicola/star-agent/pull/1 (head feat/inertial-flight, base feat/visual-fidelity). Only the separate review branch was pushed; no production deployment by Astra. Local shared feat/visual-fidelity contains the commit for PM inspection. Sol review is complete with no remaining blockers after the spin-on-assist-cancellation fix.

- READY FOR REVIEW: src/flight-model.js, src/navigation.js, src/main.js, scripts/flight-model.{test,spec,config}.js, index.html, src/style.css, package.json, README.md. First Phase 1 slice implemented: V toggles inertial flight; pure immutable velocity/attitude step integrates body-axis thrust/torque, persistent momentum/spin, inverse-square 1g surface gravity, density-scaled drag/lift and AoA stall. Default assisted servo remains unchanged; 3 km/s inertial cap and station approach cap are explicit. HUD shows sea-level-based SPACE/TRANSITION/ATMOSPHERE and ATMO blend. X clears spin; landing/docking assist clears spin on entry. Frame initialization now prevents negative first-frame dt. Request 16 footer roadmap link is wired. 41 unit checks and six Chromium browser cases pass (four general, inertial controls/transition HUD, full station journey); the final spin fix has unit regression coverage. Screenshots inspected: /tmp/star-agent-flight/transition.png and test-results/orbit.png; browser environment in /tmp/star-agent-flight/environment.json (Chromium 151, ANGLE/Vulkan SwiftShader, 1440×900). Sol independently found the hidden-spin bug and verified the fix; suitable for bounded implementation/review work. This is locally available, not deployed by Astra. Claude owns deployment. Still pending: strut suspension/damage, aerodynamic control-surface authority, re-entry effects/audio, ShipState/MFD bus. Please keep public roadmap Phase 1 marked in progress.

- Astra helper (Cees redirected the Omarchy-panel session here, 2026-09-05 16:47): claiming ONLY new `src/landing-gear.js`, `scripts/landing-gear.test.js`, and `LANDING-GEAR-HANDOFF.md` for Phase 1's pure spring/damper contact solver and tests. Main Astra retains navigation, flight-model, rendering, package.json and integration. No browser runs or shared build output from this helper. I will leave a concrete API and tested integration notes; please reserve these three new files.

- Astra: Sol 5.6 is independently reviewing the flight-model slice (read-only; no overlapping edits) while I run browser journeys and integrate request 16's footer roadmap link. Claude's .gitignore/.vercel changes are preserved and outside my commit.

- Astra: RESUMED — health check: localhost and Vercel return HTTP 200; all 34 unit checks pass. staragent.info still fails DNS resolution outside the sandbox. Claiming new src/flight-model.js and scripts/flight-model.test.js, plus navigation/main/help/README integration for the first Phase 1 slice: explicit inertial flight toggle, pure force integration and flight-regime telemetry. Default assisted travel and physical docking remain supported. Landing struts, re-entry visuals and the MFD bus follow separately; this is not the whole Phase 1 delivery.

- Astra: VERIFIED LIVE: https://star-agent-nine.vercel.app/?seed=7291. Existing production deployment dpl_5UbCj6MkSE4tsf9k5gUzkMYoQxNK is Ready; homepage and station GLB return HTTP 200. Chromium 151 boots seed 7291 and reaches the station exterior approach through the UI, with no console/page errors. Screenshot and diagnostics: /tmp/star-agent-vercel. No duplicate deployment created. Temporary hosting authorized until Monday 7 September; dedicated-server cutover remains with PM.

- Astra: Local preview recovery: chat-owned/background shell processes did not persist. Vite now runs as transient user service star-agent-dev.service on 127.0.0.1:5173. Use systemctl --user status/stop/restart star-agent-dev.service to manage it. No deployment or Vercel use.

- READY FOR REVIEW: src/main.js, src/station.js, index.html, src/style.css, tests/station.test.js, scripts/station.config.js, scripts/station.spec.js, package.json, README.md. Station wiring/docking/deck journey complete; 34 unit checks, 4 general browser cases and final station journey/layout check pass. Screenshots: /tmp/star-agent-station. Navigation, boarding flight envelope and station-collision.js were already included in the shared baseline. No Vercel or other deployment. Phase 1 specs noted; this commit closes the station slice.

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

**REVIEW (Claude, 15:55) of 5c7b6b0 "Integrate playable orbital station" — APPROVED.** `npm test` 34/34 green;
static build OK; headless tour: Station destination arrives at 99.9 km with the bay lit and doors open, planet limb
below (screenshot kept). Two small follow-ups, not blockers: (1) from the approach the hangar interior is very bright
against the hull — consider halving the interior light-bar emissive, and (2) the tour still shows LOD 6 terrain at
100 km, which is right, but the planet limb looks slightly banded; probably the volumetric clouds at grazing angle.
Station slice is closed. **Next for Astra: Phase 1 now** — `src/flight-model.js` + `src/landing-gear.js` per
ROADMAP §Phase 1; when the ShipState bus exists, post its layout and I'll spec the MFD pages.
**Hosting until Monday:** Cees wants the client on Vercel (static Vite build) until the netcup box is provisioned;
Claude handles that — no repo changes needed except maybe `vercel.json`.

## Requests round 3 (Claude → Astra, 16:10) — Cees's feedback on the current build: "looks AMAZING, but…"

11. **Terrain LOD popping.** Cause: `planet.js` swaps a parent patch for its 4 children in one frame (`split` at
    `distance < size*RADIUS*1.8`, no hysteresis, no morph). Fix, in this order of payoff:
    (a) **Geomorphing** — in `generatePatch` also emit `parentPosition` (the height this vertex would have at level-1:
    even-index vertices = the parent's own sample, odd = average of the two parent neighbours) and in the land vertex
    shader `position = mix(parentPosition, position, morph)` with `morph` a per-patch uniform from camera distance
    (0 at the split distance, 1 at 70 % of it). Do the same for `waterPositions`. This removes 90 % of visible pops.
    (b) **Hysteresis**: split at 1.8×, merge back only beyond 2.3× so patches don't oscillate at the boundary.
    (c) Keep the parent visible until *all four* children are uploaded (already done) but also require they have been
    resident ≥ 2 frames so the GPU upload hitch doesn't coincide with the swap.
    (d) Vegetation pops: on `rebuild()` scale new instances in over ~0.4 s (per-instance birth time via instanceColor.a
    or a second attribute); trees.js impostor band already cross-fades.
12. **Terrain is monotonous at mid-scale.** Ideas, cheap first: (a) adopt `terrain-material.js` (per-pixel rock/grass/
    sand/snow layers + normal detail) — it is the single biggest change in perceived detail; (b) **Whittaker biomes**:
    temperature = f(latitude, altitude) × moisture → desert (dunes, ochre), savanna, wetlands, badlands/mesa
    (terraced noise), taiga, tundra — palette + vegetation density per biome, so continents differ; (c) **rivers/lakes**
    without hydrology: use terrain-v2's valley term to carve meandering channels (`1-ridge` noise along valley floors,
    depth 3–15 m) and fill closed basins to a per-basin level → `waterPositions` at that level, not 0; (d) **hero
    landmarks** placed deterministically per continent: a 40 km impact crater with a lake, a 200 km canyon, a mesa
    field, a volcanic cone — each a small analytic term added to `terrainHeight`; (e) boulder fields and rock arches
    as instanced meshes where slope is 25–35°; (f) snow patches / scree via the material's slope+noise masks.
13. **Hangar lighting is bad.** Causes: `station.js` multiplies every emissive ×2 after load (line 216) so the ceiling
    light bars blow out to white through ACES, there are no actual lights inside (everything is emissive + the global
    hemisphere), and the sun still lights the interior because nothing casts shadows into the bay. Fix: remove the ×2
    for `LightBar*`/interior materials (keep it for nav lights), add 3–4 `PointLight`s (warm 3800 K, ~15 m range,
    decay 2, no shadows) under the light bars **only while the camera is < 400 m from the pad**, and when
    `station.isInsideHangar(nav.position)` scale the sun's intensity toward 0.15 and the hemisphere to a cool interior
    ambient over 0.5 s. Optional: `lighting-csm.js` gives real hull shadows into the bay.
14. **Deck floor flickers.** `DeckMarkings` are already 1.5 cm above the deck in `build_station.py`, so this is
    probably not marking/deck z-fighting. Two likelier causes: (a) **shadow acne / frustum edge** — `lighting.js` uses one
    2048² shadow map with a ±110 m ortho box (near 1, far 650) and `normalBias .16`; the deck is a large flat receiver
    at grazing sun and the station is 150 m long, so parts of the deck sit at the shadow frustum edge and swim as the
    camera moves. Test: set `sun.castShadow=false` inside the hangar — if the flicker stops, it's this. Fix: when
    `isInsideHangar`, either disable shadows or recentre the shadow camera on the pad with a ±40 m box and
    `normalBias .3`, `bias -.0005`. (b) **Deck vs. ship collision floor**: if the camera/ship is settled exactly on
    `deckHeightAt` with a tiny oscillation in the landing solver, the shadow/contact would flicker too — log the
    settled altitude for 2 s and check it's constant to 1 mm. If neither, then z-fighting between the deck box top and
    the 0.03 m marking slabs under log depth is next: `polygonOffset:true, polygonOffsetFactor:-2` on the markings.

15. **Night side (Cees asked "can I fly to the dark side?")** — you can today: the sun is a fixed direction (`SUN_DIRECTION`
    ≈ lat 22° N, lon 45° E), so the terminator never moves and everything west of ~135° W / east of 135° E is permanent
    night. The atmosphere pass already darkens the sky and shows stars there, but the surface is nearly black (hemisphere
    floor `.08`), clouds are unlit, and the ship has no exterior lights, so there is nothing to see. Cheap wins, in order:
    (a) **ship landing lights + headlamp**: two `SpotLight`s on the ship (nose, belly) auto-on when sun·normal < 0.05 and
    altitude < 2 km, plus a helmet lamp on foot; (b) **night ambient**: raise the floor to `.12` with a blue-grey
    hemisphere and add a faint starlight/airglow term in `atmosphere.js` (`+ vec3(.004,.006,.010)` on the night sky, not
    on ground); (c) **planet rotation** (Phase 3 groundwork): rotate `SUN_DIRECTION` about the planet axis with a
    configurable day length (suggest 2 h real time, seed-stable), so every site gets sunrise/sunset and the "golden hour"
    the scattering already renders beautifully; (d) later: moonlight from Sel, aurora at the poles, outpost lights.

16. **Roadmap page + Vercel.** `public/roadmap.html` now ships with the build (Claude-owned). Please add a small footer link
    in `index.html` (statusbar right side, next to "BUILT TO EXPLORE"): `<a href="./roadmap.html">ROADMAP</a>` styled like
    the other statusbar text. The client is deployed to Vercel from `feat/visual-fidelity` as the interim host until the
    netcup box is live (Monday); Claude runs deploys — don't add Vercel config or a GitHub Action for it.

## Fable 5.1 — ship creation pipeline memory is available (2026-09-05)

Cees explicitly requested a comprehensive reusable memory and notification to
the project manager. **Saved: [SHIP-PIPELINE-MEMORY.md](SHIP-PIPELINE-MEMORY.md).**
Please use it as the ship-authoring reference for future assignments and reviews.

It records the complete proven route: isolated ownership/worktree setup, Blender
authoring, game-to-Blender axes, exact cabin/boarding/cargo contracts, `.blend` and
GLB export, named pivots, asynchronous loading/fallback, inventory persistence and
modal input, four live MFDs, shader/depth/precision rules, studio/production tests,
render evidence, failure fixes, PR delivery and merge integration boundaries.
It also separates implemented features from future systems and includes a reusable
completion-record template. The player guide links back to the memory.

Reference delivery: [PR #4](https://github.com/AvonMexicola/star-agent/pull/4),
implementation `9370c53`, stacked on flight PR #1. The new Nomad is integrated in
the ship game branch and shared workspace; the standalone studio is an additional
review tool. Playable ship branch: http://localhost:5190/ ; model viewer:
http://localhost:5190/dev/ship.html . The viewer runs as the transient user service
`star-agent-ship-viewer.service`. Recorded verification: 46 isolated unit cases,
production build, two production ship browser cases and one studio case passed.
The memory update changes documentation only; prior test counts are historical
implementation results, not newly rerun checks.

This notice is posted in the established manager handoff channel; no read receipt
or separate direct-message delivery is claimed. Existing shared feature work is
preserved. Manager review, dependency merge and production deployment remain
with Fable/Claude under the current team rules.


## Fable 5.1 — planet pipeline memory filed; Selene landing ready (Astra, 2026-09-05)

Cees requested lunar landing/walking and a complete planet pipeline memory for the
manager. Implemented and integrated into the shared checkout: detailed lunar ground,
terrain collision, low-gravity walking/jumping, physical ramp traversal/reboarding,
launch, controller controls and airless lighting/audio/flight behavior.

The durable memory is [PLANET-PIPELINE-MEMORY.md](PLANET-PIPELINE-MEMORY.md). It covers
Aeon and Selene from seeds/body definitions through heightfields, patch precision,
LOD/workers/cache, materials, atmosphere/depth, vegetation, collision/boarding,
QA, delivery, integration lessons and remaining limitations. Player guide:
[docs/selene.md](docs/selene.md). Coordination: [MOON-HANDOFF.md](MOON-HANDOFF.md).

**REBASED: #7** — `feat/moon` is now based on `feat/visual-fidelity` at `0e9e921`;
controller PR #3 remains included as a dependency. [PR #7](https://github.com/AvonMexicola/star-agent/pull/7)
now covers landing/exploration as well as the moon. Preserve the shared crash
composition documented in MOON-HANDOFF when combining #2 and #7; avoid wholesale
replacement of shared main/navigation files.

Validation: 70 unit cases/build in the rebased branch; 76 cases/build in the shared
checkout including crash tests. Full production lunar journeys pass in both, with
no page/console errors; controller exploration also passes its navigation regression.
Curated surface/ship screenshots are in `docs/selene-landing.png` and
`docs/selene-aeon.png`. Software renderer details and limits are recorded in the memory.
This local notice files the requested memory for Fable; it does not assert a read receipt.
Review, merge and deployment remain with the manager's queue.


## Lunar landscape upgrade — Astra (2026-09-06)

Cees requests a Cellin-inspired moon with much stronger slopes/craters, sparkling
lofted ice and majestic asteroid rings. Working isolated in
`/tmp/star-agent-lunar-landscape`, branch `feat/lunar-landscape`, based on merged
`feat/visual-fidelity` f028a43. Own lunar generator/terrain/material/effect modules,
moon browser/unit tests and docs; main integration is limited to the Moon update
call and lunar effect diagnostics. Preserve navigation/boarding surface agreement.
No shared runtime source replacements or overlap with travel/camera/equipment lanes.

Lunar effects integration also owns the small `src/atmosphere.js` HDR alpha fix:
retain transparent scene color over the star field. This is required for translucent
rings and additive ice without opaque speckles; scene log-depth decoding stays unchanged.


## READY: #15 — Selene landscape, ice and rings (Astra, 2026-09-06)

Cees' Cellin-inspired lunar upgrade is implemented in
[PR #15](https://github.com/AvonMexicola/star-agent/pull/15), `feat/lunar-landscape`,
based on merged integration f028a43. Local production preview:
http://127.0.0.1:5178/ — select Selene. User service: `star-agent-lunar-landscape`.
Isolated checkout: `/tmp/star-agent-lunar-landscape`; shared runtime source untouched.

Delivered: a crater-rim landing shelf, steeper/deeper terrain, 36 local craters,
fractured ridges and walkable basalt outcrops; cool regolith/frost, sunlit lofted ice,
and four tilted ice/dust ring bands with 1,800 individual asteroids. Nearby belt dust
fades into rocks; the moon shadows both bands and asteroids. The generator is v3,
with a 16 km upper bound. Existing 20 km drive exclusion still covers it.

75 unit cases/build pass. Both production lunar browser cases pass: full physical
landing/walking/jumping/reboarding/launch and orbit/surface/asteroid/Aeon rendering.
Final visual refinements were rechecked; no page/console errors. Curated screenshots,
renderer metadata and limitations are committed in the PR.

Fable's [updated planet pipeline memory](https://github.com/AvonMexicola/star-agent/blob/feat/lunar-landscape/PLANET-PIPELINE-MEMORY.md)
is filed on that branch. Read `LUNAR-LANDSCAPE-HANDOFF.md` there for merge boundaries:
main only supplies Moon elapsed/outside state and diagnostics; atmosphere retains
transparent HDR effects over sky without changing log-depth reconstruction. Preserve
those hooks alongside travel/camera work. The ring is decorative, without collision,
mining, orbit simulation or shadows cast onto the ground. Review/merge/deployment
remain with Fable/Claude; this local handoff does not assert a read acknowledgment.


## Selene surface identity follow-up — Astra (2026-09-06)

Cees reports uniform beige terrain and insufficient extreme elevations. Continuing
PR #15 in /tmp/star-agent-lunar-landscape. Own moon-world/moon-terrain/moon material,
lunar tests and evidence/docs; main.js changes only lunar biome label/diagnostics.
5178 is occupied by opening-work: the earlier lunar preview claim was incorrect
(the lunar service failed on its occupied port). Will use dedicated port 5180,
leaving opening preview intact. Implement canonical contrasting geological regions,
glacial channels and larger mountain relief; verify rendered surface and landing.


## UPDATED: #15 — distinct Selene geology and extreme relief (Astra, 2026-09-06)

User follow-up is implemented on feat/lunar-landscape in /tmp/star-agent-lunar-landscape.
Generator v4 supplies named districts, fractured ground, blue-white Glass Rift,
dark Obsidian Crown, Copper Ejecta and icy Frostwall. Local sampled elevation range
is 8,980 m (−2,927 to +6,053 m relative to lunar radius), with the safe landing shelf
and shared collision/walking heightfield retained. Required LOD siblings now stay
cached: a fixed view settles instead of rebuilding horizon-culled dependencies.

Corrected preview: http://127.0.0.1:5180/ — star-agent-selene-geology.service.
Verified final served asset index-DB4-R7TB.js matches the browser-tested dist.
Earlier 5178 claim was incorrect: opening-work owns that port, and the lunar service
failed there. No shared runtime sources or other preview services were replaced.

77 unit cases across nine files pass; build and physical lunar journey pass.
Final material/cache changes were rechecked in the full visual tour with zero
page/console errors and zero terrain builds at the recorded surface view.
Evidence: docs/selene-geology.png, docs/selene-crater-country.png and evidence JSON.
PLANET-PIPELINE-MEMORY.md v4 update is filed on PR #15 for Fable. main.js integration
now also imports moonRegion for the existing lunar biome label/state. Preserve other
lanes' main/UI changes during merge. Manager review/merge/deployment remain pending;
this local handoff does not assert a read receipt.


## Mining/voxel research — Astra (2026-09-06)

Cees requested research into mineable rock assets and Selene ridges/mountains,
with No Man's Sky as reference and technology choice open. Docs-only research
lane: /tmp/star-agent-mining-research, docs/selene-mining-research based on PR #15.
Own docs/selene-mining-research.md and small pipeline-memory/handoff additions.
Inspecting existing Phase 6 SDF roadmap and equipment onMine callback; no competing
equipment/voxel implementation or shared runtime changes.


## RESEARCH READY — mineable rocks and Selene mountains (Astra, 2026-09-06)

Cees' requested research is filed in docs/selene-mining-research.md on
docs/selene-mining-research, isolated at /tmp/star-agent-mining-research and based
on lunar PR #15 ea7c35b. Recommendation: global heightfield + connected ridge
morphology, local smooth scalar-field rocks/outcrops meshed in workers, static
cliff dressing where excavation is unnecessary. Marching Cubes first; compare
Dual Contouring for sharp faces. NMS's documented Dual Marching Cubes is distinct.

Research includes primary sources, existing Phase 6/equipment hook integration,
asset shortlist, four local GLB metadata audits, chunk memory arithmetic, save/LOD/
collision contracts and staged acceptance gates. Source report and audit script
are committed; pipeline memory links the research. No mining engine, runtime
benchmark, asset conversion, downloaded assets or shared runtime edits in this lane.
Fable: review alongside the Phase 6 plan; <4 ms remeshing and indefinitely tiny
brush logs are not established results. Preserve the existing equipment owner.


## First Selene mining implementation — Astra (2026-09-06)

Cees authorized the first implementation. Isolated /tmp/star-agent-mining-work,
feat/selene-mining based on research #18 / lunar #15. Own NEW src/mining/ modules,
mining tests/studio, and narrow main/navigation/gamepad integration plus ore storage.
Reuse equipment.js + mining laser asset verbatim from manager commit 9930e82;
no shared equipment edits, no duplicate weapon system. First slice: one rock by
Crescent Rim, worker meshing, saved cut/material state, resource inventory and
collision, keyboard/controller/touch mining. Full mountain excavation stays later.


## IMPLEMENTATION READY — first Selene mining rock (Astra, 2026-09-06)

User-authorized first slice is on feat/selene-mining, isolated at
/tmp/star-agent-mining-work, stacked on research #18 and lunar #15. Preview:
http://127.0.0.1:5203/ (star-agent-mining.service), verified asset index-DpEVt4cu.js.
Crescent Rim now has one mineable basalt/copper/ice rock. Existing Equipment laser
handles keyboard/mouse/Xbox RT/touch; cuts, collision and survey samples publish
together after one save. The cargo dialog stows the pouch into a sample locker.

116 numerical cases and all 3 browser journeys pass: mining/save/reload/controller/
touch/cargo, physical lunar reboarding/launch, and lunar visual regression.
Guide: docs/selene-mining.md; screenshots/metadata: docs/qa/selene-mining/.
PLANET-PIPELINE-MEMORY.md records the actual implementation and limitations.

Consistent marching tetrahedra in one 32³-cell volume; whole-rock worker remesh,
packed collision and encoded snapshot transfer. Observed worker total 352 ms;
main-thread publication 2.6 ms on Chromium/SwiftShader, not p95/FPS approval.
No fragment physics, cave/mountain excavation, crafting or multiplayer.
Equipment module/model/socket data adopted from manager commit 9930e82; preserve
newer gear and concurrent main/navigation/UI integration hooks during merge.
Fable/Claude own integration, independent Opus visual review, merge and deployment.
This handoff does not assert a manager read receipt or visual approval.


## IMPLEMENTATION READY — Selene expedition and resource geography (Astra, 2026-09-06)

Cees explicitly authorized controller, inventory and EVA agents, procedural ring
mining, and orbital colors that reveal resource locations. Integrated branch:
feat/selene-expedition, isolated at /tmp/star-agent-expedition-work, stacked on
feat/selene-mining / PR #21 (itself research #18 and lunar #15). Dedicated preview:
http://127.0.0.1:5213/ via star-agent-expedition.service, verified final asset
index-EcwN-ktI.js. Earlier previews are intact.

Implemented standard-controller command/dialog routing and complete Crescent plus
Copper Ejecta controller journeys; visible textured laser and log-depth beam;
shared finite box/stack storage for backpack, ship, station and physical base cache;
atomic cuts/cargo/transfers; physical hatch/ramp EVA with inertia, thrust and braking;
20,971,520 deterministic ring descriptors with bounded LOD, six asteroid families
and editable small rocks; and five mineral provinces whose orbital/ground colors,
outcrop seams and collected resources share one authoritative geological field.
Ring width is 20 km radial by 2 km vertical; local ship speed is limited to 400 m/s.

Final validation: 156 numerical cases; all nine distinct production browser checks
pass across the integrated run and targeted reruns. The initial orbital fixture
incorrectly expected LOD 4 at a LOD 3 viewpoint; corrected, then final resource
appearance/layout, EVA and space mining passed. Separate controller-modal and HDR
texture/beam fixtures pass. Real screenshots, GPU/backend/input provenance and
specific limitations are in docs/qa/expedition/. Browser is Chromium 151 on
SwiftShader; this is not hardware FPS approval. Physical Xbox button sequencing
has not been performed; injected full controller routes are explicitly distinguished.

Updated complete memory: PLANET-PIPELINE-MEMORY.md. Guides:
docs/selene-expedition.md, docs/resource-geology.md, docs/controller-contract.md,
docs/container-inventory.md and docs/character-eva.md. AGENTS.md now requires
controller support for every new playable feature through its whole journey.

Preserve newer manager gear/station/navigation work when integrating common
main/navigation/gamepad/equipment/UI hooks. Equipment derives from manager 9930e82;
this branch repairs its beam/material feedback, without replacing the gear lane.
The shared checkout's unrelated station and gear changes were not overwritten.
Large asteroids and terrain are not excavatable; at most two ring and one provincial
workers join Crescent, and eight additional deposits can retain edits. Boxes are
free prototype mounts; fuel/oxygen, crafting, multiplayer and N-body physics are
not implemented. Fable/Claude retain independent visual review, integration,
merge and deployment. This handoff does not claim a manager read receipt.

Draft review PR: https://github.com/AvonMexicola/star-agent/pull/24 .
The shared manager HANDOFF.md now points to this complete memory and evidence.


## Expedition player fixes — surface tool, asteroid aim and ring steering (2026-09-06)

PR #24 follow-up in /tmp/star-agent-expedition-work / feat/selene-expedition.
Removed the tool's 90 m deposit proximity gate. Space yaw/pitch and vertical thrust
now use ship axes; held controller B stops drift/thrust without locking aim.
Aimed small asteroids take priority over two-nearest preparation; exact visible
triangles replace false sphere occlusion/collision. Large static asteroids now
explicitly report unavailable hand mining; pending/range/save-cap feedback is clear.

All 22 npm test files pass. Five distinct follow-up production browser checks pass,
including remote Selene equip/RT, pole-facing yaw +/- with and without B+RT held,
third-rock worker promotion/RT/backpack, large-asteroid no-award feedback, and the
existing controller Crescent plus physical EVA mining routes. Synthetic asteroid
positions and debug orientation/position fixtures are documented honestly; actual
meshes, colliders, workers and input routes are used. No physical Xbox claim.

Evidence: docs/qa/expedition/regressions/ in the expedition worktree / PR.
Memory and docs/space-steering.md record the corrected contracts. Preview remains
http://127.0.0.1:5213/ with final index-DGnB0h5g.js. No shared navigation/gear/station
or ship-power lane was overwritten. Fable/Claude retain review and integration.


## Sparse Selene ring and sunlit grains — 2026-09-06

Cees requested roughly 2 km asteroid spacing, better draw distance/Yela-inspired
rock surfaces, a huge physical ring and fine sunlit ice inside it. Implemented in
/tmp/star-agent-expedition-work / feat/selene-expedition / draft PR #24. Code head
0f7f1f1; dedicated preview http://127.0.0.1:5213/ serves index-N8I1Odnu.js.

V2 has 14,336 deterministic bodies and minimum 2,132.11 m bounding clearance,
while retaining the 1,826.896 km outer diameter and 20 km wide / 2 km thick band.
Three fading geometry levels retain large rocks through 80 km; 24 geological
variants have fractured gray surfaces. Fine world-anchored ice glints render only
inside the ring, with 12 m cabin clearance and bounded 104 m particle neighborhood.
Small rocks remain mineable; saved v1 cuts retain their coordinates and cargo,
with preserved edits explicitly excepted from the new spacing rule.

All 26 numerical test files pass. Five distinct production browser checks pass
across the integrated run and targeted reruns: ring geometry/ice, remote tool
equip, held-B yaw, aimed-worker promotion/large-body feedback and physical EVA
plus RT mining/backpack. The space fixture was corrected to wait for its own
injected controller identity and neutral poll. Final GPU captures have no errors;
no physical Xbox sequence or hardware FPS approval is claimed. Curated evidence:
docs/qa/expedition/sparse-ring/; full contracts in PLANET-PIPELINE-MEMORY.md.

Preserve shared station/gear changes and the separate ship-power-cabin lane.
Fable/Claude retain independent visual review, integration, merge and deployment.
This file handoff is not a claim of manager acknowledgment or public deployment.
