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

- READY FOR REVIEW — FORESTS: `feat/forest-streaming`, stacked on crash PR #2. Seeded groves/clearings, worker tiles, retained residents, 0.8 s appearance/shadow fades and bounded live-instance uploads. Isolated `/tmp/star-agent-forest-work`; 57 unit tests, production forest browser check and all four general browser cases pass. Sampled forest drops 40,998 → 7,381 trees; 150 m movement adds 16 tiles. Native screenshots and limits in FOREST-HANDOFF.md and docs/images/forest-*.png. Local preview http://localhost:5175/?seed=7291. Terrain/water/advanced tree material work remains separate. No merge or deployment.

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

- READY FOR REVIEW — hard ground crashes: isolated branch feat/hard-ground-crashes in /tmp/star-agent-crash-work, based on feat/inertial-flight (PR #1). Files: src/impact.js, src/crash-effects.js, navigation/main integration, index/style, package/README, scripts/crash.*, scripts/generation.test.js, tests/navigation.test.js. Terrain/sea-level closing speed >=12 m/s destroys the ship, latches propulsion/rotation/boarding/launch off and shows procedural impact effects plus explicit same-seed recovery. Surface normals use the existing shared terrain floor. Movement-key preventDefault MUST precede the crashed keydown return (otherwise Space clicks an old focused destination and auto-recovers). Sol authored six meaningful crash regressions and independently reviewed the feature. 47 unit checks, production build, crash+phone recovery browser case and four existing browser cases pass. The regression run used /tmp/star-agent-crash-regression.config.mjs solely to move the standard suite to port 5188; crash test uses committed scripts/crash.config.js. Inspected screenshots and environment: /tmp/star-agent-crash (Chromium 151, ANGLE/Vulkan SwiftShader, 1440×900 and 390×844; standard suite 1280×800). Stable preview: http://localhost:5174/?seed=7291 via transient star-agent-crash-dev.service. No production deployment. Controller/cockpit/Blender and helper landing-gear files were excluded from this isolated commit; preserve those when integrating. Landing suspension, station damage and persistent/deformable wrecks remain future work.

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


## READY for Fable 5.1 — Atlas freighter and Nomad cockpit (2026-09-06)

Cees’ larger **unlockable** ship and subsequent Nomad chair/windscreen correction
are implemented in [PR #14](https://github.com/AvonMexicola/star-agent/pull/14),
`feat/unlockable-freighter`, isolated `/tmp/star-agent-freighter-work`.
Implementation checkpoints 3e5ef97 and 8b5b84d are committed/pushed.
Base ad20802; latest integration equipment/character commits c4f3d2d/3f7d470 are
in different files and were not replaced. Shared runtime files remain untouched.

Atlas: 30 m envelope, 8 × 10 m belly elevator, twin 2.2 × 3 m cargo lifts to upper
landings, 2,400 kg inventory, four live MFDs. Land on Aeon/Selene then dock at the
station to unlock; G opens Fleet and seated station selection. Saved progress,
selected ship and conserved inventory. One lift simulation drives geometry, walk
support and rider carry. Shaft guards/edge checks and stow-before-launch interlocks
work. Separate hull/gear sweeps avoid falsely filling the open underbody. Both
ships retain usable fallbacks if GLBs fail. Secured lift cases are props; no trading
economy, loose-crate pickup, item use or cargo-mass flight physics is claimed.

Nomad: new Blender bucket chair with shaped shell, bolsters, webbing harness,
headrest and articulated arms; centre windscreen strut removed. Original seat/aisle
dimensions preserved, runtime chair fallback hides only after PilotChair loads.

Validation: 76 unit tests, build, **4 production browser checks**, **2 studio checks**
passed. Atlas unlock/selection, three lift rides, station deck walk/reboarding,
inventory, pilot return, launch, reload, both GLB fallbacks and original Nomad
journey covered. Chromium/ANGLE SwiftShader, 1440×900 game and 1600×1000 studio;
scale .4 for walking and 1 for game evidence, no hardware FPS claim. A concurrent
studio run timed out under software-renderer load; its separate rerun passed.
Curated screenshots and actual limitations are in `docs/atlas-freighter.md` and
`docs/nomad-ship.md`.

**The comprehensive ship pipeline memory now also covers unlockable ships and
physical cargo lifts:** `SHIP-PIPELINE-MEMORY.md` has a new Atlas/Nomad addendum
with node contracts, dynamic layouts, persistence, collider traps, fallback,
validation and delivery instructions. Please point future ship agents there.

Local dev preview is running from this isolated checkout on **5216**:
http://127.0.0.1:5216/dev/ship.html (Pilot Seat / Cockpit),
http://127.0.0.1:5216/dev/freighter.html (Atlas / elevator / lifts),
http://127.0.0.1:5216/ (game). Old 5190 remains the previous Nomad viewer.

Merge notes: preserve `nav.layout`, `nav.canDock`, dynamic active ship references
(inventory UI takes a getter), fleet initialization and modal gates when combining
opening/travel/camera lanes. External camera bounds should use the active layout.
Current shared equipment files were not edited. **Merge/deploy remains yours**;
PR #14 is not a deployment, and manager acknowledgement has not been assumed.

## Hangar integration candidate — 2026-09-06

Cees requested the merge. PR #20 now reconciles the Atlas/modular-port/finish
stack with `feat/visual-fidelity` at `029cae8`, in isolated worktree
`/tmp/star-agent-hangar-merge` (`integrate/hangar-finish`). No shared-tree branch
switching or adoption of the separate hull refinement (#22).

READY FOR REVIEW: `src/main.js`, `src/navigation.js`, `src/station.js`,
`src/station-complex.js`, `src/opening-sequence.js`, fleet guards, modular GLBs,
`scripts/hangar-merge.config.js`, `scripts/hangar-merge.spec.js`,
`tests/station-opening-complex.test.js`, `docs/qa/hangar-integration.md`.

Three agents handled StationComplex/opening transforms, navigation and regression
coverage, and builder conflict/capture harness independently. Root integrated the
runtime frame and modal ownership. Preserve fixed complex travel bounds, selected
ship opening setup, tilted deck up, camera-before-rebase ordering and the input
pause guard during elevator fade.

151 unit tests and the production build pass. Initial four opening/integration
browser checks pass; remaining browser/tour checks are in progress. Full results
and limitations belong in `docs/qa/hangar-integration.md`. The Opus invocation
returned HTTP 429, reset 13:50 Amsterdam; no visual review score is claimed.
`QUALITY.md` still requires the independent rubric or Cees's explicit waiver
before final merge. This entry is a review handoff, not a merge/deployment claim.

### Final local verification and production standard

Runtime candidate `7a73ecf` is pushed to PR #20, now based on
`feat/visual-fidelity` (`029cae8`). The exterior shares the existing 600 km camera
cutoff; the orbit tour confirms removal of 93 unnecessary draws and exactly
restores the base 477 draws / 304,642 triangles. Full units: **152 pass**. Build
passes. **17 distinct browser cases pass** across the recorded runs/reruns;
the final render-only cutoff additionally has collision/visibility tests and a
complete eight-view production tour. Tour completed 13:05:50 Amsterdam with no
errors, warnings, failed requests or unexpected closures. Curated scene and
desktop/phone captures are in `docs/qa/hangar-integration/`.

Cees requested a complete record as the standard for other assets. READY FOR
REVIEW: `docs/asset-production-standard.md`, `docs/qa/hangar-production-record.md`,
`docs/qa/hangar-integration.md`, linked from `AGENTS.md` and both pipeline memories.
The proceedings retain the controller timing failure, interrupted first tour,
exterior performance regression and their verified corrections. Raw reports stay
in `/tmp`; no independent visual score, hardware performance approval or final
merge is claimed. Opus review/explicit Cees exception remains the final decision.


## READY FOR REVIEW: final station candidate and asset production record — 2026-09-06

TO Fable 5.1 manager: Cees requested the merge and a complete asset pipeline
record for reuse. PR20 integrates default 85aa836, the modular twenty-bay station,
finished hangar, Nomad and Atlas. Runtime is 1eeb302 (parent 0d75c3f; integration
merge 7ddef61). Isolated checkout: /tmp/star-agent-hangar-current. Preserve the
shared checkout's unrelated gear/controller work; no shared branch was switched.

The reusable entry point is docs/asset-production-standard.md, already linked
from AGENTS.md. Complete proceedings: docs/qa/hangar-production-record.md.
Functional results, AMD timing tables, pixelmatch comparison, the original
3.67 Opus review, incomplete later review, source-art provenance and twelve
curated new/before images are under docs/qa/. SHIP-PIPELINE-MEMORY.md and
STATION-PIPELINE-MEMORY.md include the final lessons. This is a file handoff,
not a claimed manager read receipt.

Verified: all 21 unit-test files and build pass; 18 production browser cases at
0d75c3f (4.9 minutes), then two focused production checks after the ceiling fix
at 1eeb302 (28.7 seconds). Eight final AMD views completed with zero errors,
warnings, request failures or unexpected lifecycle failures. Image comparison
found covered ceiling diffusers; the visibility test failed before correction
and passed afterward, alongside both floor tests. Named hierarchy, door ownership
and vertex AO are preserved; distant geometry batches retain every triangle.
Nomad: 57,784 triangles / 3,783,616 bytes. Atlas: 58,460 / 3,770,128, with rebuilt
editable .blend files and the Nomad chair retained. Every prop assembly meets
10k triangles / 1 MB.

Latest AMD 860M measurement at 1440x900, scale 1: affected GPU p95 <=9.339 ms,
CPU callback p95 <=6.8 ms; the menu issues zero WebGL draws across 60 callbacks.
Earlier much slower measurements remain recorded; their cause is unconfirmed.
Orbit still inherits 477 draws against the 300 budget. No GPU timing claim uses
RAF/vsync intervals.

Merge is NOT complete: the original Opus review failed at 3.67; the final Opus 5
attempt (session 20c55ac0-2541-4775-93cd-a8dce1d1af55) ended without a rubric at
its session limit, reporting a 19:00 Amsterdam reset. No waiver or final visual
approval is inferred. Repeat independent review with its own captures from the
stable host preview; root captures cannot replace it. PR20 remains open/unmerged.

Latest playable preview: http://127.0.0.1:5249/ (W takes control; F interacts).
The transient user unit star-agent-hangar-current-preview.service serves
/tmp/star-agent-hangar-current-build. Host HTTP 200 was verified. A restricted
namespace connection failure does not establish that a host service stopped.
To stop this specific preview when finished:
systemctl --user stop star-agent-hangar-current-preview.service
Port 5239 was a historical candidate. No production deployment is claimed.


## READY FOR REVIEW: concourse shops, elevator interiors and CPU optimization — 2026-09-06

TO Fable 5.1 manager: Cees requested the elevator/lobby/furniture refinement and
a performance diagnosis, continuing the complete-record requirement. Runtime
commit 9e5a713 is on the isolated `/tmp/star-agent-concourse-work` checkout,
branch `feat/station-concourse`, continuing PR #20 from 056d20b. Root is updating
that existing PR; no branch switch or unrelated asset import occurred in the
shared checkout.

READY FOR REVIEW: original `blender/build_station_concourse.py`, both new GLBs,
concourse/elevator runtime wrappers, working station shops and v3 purchase save,
door/LOD caches, `scripts/concourse.config.js`, actual-game captures and the
complete `docs/qa/station-concourse-production-record.md`. The asset contract,
performance report and independent-review attempt are linked there. The reusable
`docs/asset-production-standard.md` and `STATION-PIPELINE-MEMORY.md` now include
these lessons. This is a file handoff, not a claimed manager read receipt.

Verified: all 23 unit files and build; twelve distinct affected production browser
cases across the recorded full run and reruns; final physical/controller shop
journey 43.5 s and phone 7.1 s after the input initialization fix. The record preserves
the coasting-related test failure, close-event wait, first-D-pad race, oversized
textures and inherited rear-wall occlusion with their actual corrections. Five
GLB/layout tests include the original-station/new-cabin overlay ray check.

Final AMD 860M / Chromium 151 / ANGLE GL, 1440×900 scale 1: hub 259 draws vs 625,
CPU median 5.300 ms vs 12.600 ms, GPU 4.205 ms (p95 4.940). Hangar 505 draws, GPU
8.198 ms (p95 8.596), CPU 6.800 ms (p95 7.600). Both views show 16.7 ms median/p95
RAF cadence in this short run. CPU/GPU/RAF are separate, never added. Final
station update 0.366 ms, zero unchanged LOD matrix writes. Eight release camera
views completed with zero browser errors/warnings; thirteen curated images
include desktop/phone purchases and matched hub before/after.

New ships/shops limitations remain explicit: purchased weapons/components are
stored cargo; combat, equipping and installation are not implemented. Credits
and finite stock share one local manifest; no shared multiplayer economy.

Merge remains pending: Opus 5 session 14807f9f-66d0-4c07-8f6f-ddfcc2a1afef returned
its session limit before review tools or scoring, reporting 19:00 Amsterdam. No
new score or Cees waiver is inferred. Preserve the old 3.67 failure and repeat the
independent review with its own captures when available.

Playable release: http://127.0.0.1:5260/ . W takes control; F calls the elevator;
walk inside, select Central hub, then approach either shop counter and press F.
Purchases arrive in station storage. The service `star-agent-concourse-preview`
serves `/tmp/star-agent-concourse-build`; `/review/` exposes the curated images.
Port 5249 remains the earlier candidate. This is a local preview, not a deployment.


Publication receipt: runtime 9e5a713 and full proceedings 27077ec were pushed
by fast-forward to `origin/feat/hangar-finish`. GitHub confirmed PR #20 OPEN at
27077ece690f64fa9c613d6c7c2cef7ec0a78938, with no merged timestamp or auto-merge
request. Its title and body now describe the furnished shops, elevator fit,
measured performance, source assets, complete record and outstanding Opus gate.
The isolated worktree was clean after those commits. The following receipt-only
commit changes no runtime or served asset.
## READY FOR REVIEW — ship main power and moving cabins (2026-09-06)

Cees requested power on/off and leaving a powered ship's pilot seat. Implemented
in isolated /tmp/star-agent-ship-power, feat/ship-power-cabin, PR #25 stacked on
PR #20's candidate 4da1a5d. Runtime e82c3e5 plus cabin guidance b891272; controls and
browser tests follow on the same branch. No shared-root runtime files changed.

READY FOR REVIEW: src/navigation.js, src/main.js, src/gamepad.js,
src/ship-power-ui.js, src/ship-mfd.js, src/audio.js, index.html,
src/player-interface.css, tests/ship-power*.test.js, tests/gamepad.test.js,
tests/navigation.test.js, scripts/ship-power*.js, docs/ship-power.md,
docs/qa/ship-power.md and docs/qa/ship-power/.

P switches main power from the pilot seat; F stands during ordinary flight.
The powered assisted hull holds world course/speed independently of passenger
walking/look controls. Inertial or unpowered hulls retain gravity, drag and spin.
Returning physically to the chair transfers the current hull motion back to
piloting. Nomad hatch/Atlas belly elevator are secured in flight; powered internal
Atlas lifts carry the walker while the hull moves. Existing shared terrain,
moon and station sweeps also handle unseated touchdown. MFD, audio, HUD and the
keyboard/controller/touch menu report the same power state. Menus still pause.

Final unit run: 162/162 pass; production build passes (existing chunk-size advisory).
New production browser run: 3/3 pass, Chromium 151/ANGLE Vulkan SwiftShader,
1440x900 plus 390x844, no console errors/warnings. Captures are committed in
docs/qa/ship-power/. B-close with A/stick held does not leak flight controls or
change power; controller rearming requires neutral input. Regression outcomes
and retained fixture/timing failures are documented in the QA reports.

Local production demo http://localhost:5244/__atlas_demo selects Atlas on its
separate origin. W then F was directly verified to retain 758.686m/s while the
pilot walks; old 5240 remains available. This is a local review build, not main
or Vercel. Main power does not simulate batteries or distribution, and moving
EVA is outside this slice. Do not merge PR #24's stopped-ship EVA path over this
independent hull frame or lose active-ship layout support when reconciling lanes.
Opus rubric, complete quality-budget acceptance and merge/deploy remain pending.


### READY FOR REVIEW — corrected roll input directions (2026-09-06)

Cees specifies E/RB roll right and Q/LB roll left; yaw is correct and pitch stays
unchanged. Corrected src/navigation.js keyboard axis and src/gamepad.js bumper
axis in the isolated PR #25 power branch. Positive roll means right bank in both
assisted and inertial physics. Tests verify actual wing direction and unchanged
nose direction for Nomad/Atlas and all four bindings; failed before fix, pass after.
166 unit tests/build pass. Eight real-production Nomad keyboard/injected-gamepad
roll checks pass, Chromium 151/ANGLE Vulkan SwiftShader, no errors/warnings.
Evidence and limitation notes: docs/qa/ship-power.md, paired roll screenshots.
Previews 5245 (Nomad) and 5244 (Atlas) serve rebuilt output; reload to apply.
Shared root runtime and yaw/pitch inputs were preserved; no main/Vercel deploy.

### Atlas Mark II — original Blender asset and physical studio (2026-09-06)

Isolated branch feat/atlas-mark-ii, stacked on PR #25 / 8c48317. All source/asset
work is under assets/atlas-mark-ii, public/models/atlas-mark-ii,
public/textures/atlas-mark-ii, standalone atlas-mark-ii studio/systems/tests,
and design/QA documents. Main fleet, navigation, station and other worktrees
remain independent. Manager integration and art approval are still required.

Editable Blender 5.2 source plus parametric mesh, PBR, UV and contact-bake pipeline;
through cargo hold, two folding ramps, interlocked crew lift, upper bridge/crew/
galley/hygiene. S1/S3 standard and three S3 attachment interfaces, no weapons.
User rejection of the first blockout led to a wedge canopy, sealed reported
pressure joints, tapered bridge sole/collision, sloped bow/stern, octagonal
mechanical exhausts and a wall mess leaf with clear circulation. A final 25 mm
inward steel-leaf change removes coplanar trim flicker without changing bounds.

180 unit tests and production build pass. Four hardware production cases pass:
physical aft ramp→cargo→lift→bridge→crew→galley/hygiene, seven inspection presets,
phone and injected controller. Chromium 151 / AMD Radeon 860M / ANGLE GL; no page
or console errors. Full functional suite used 81ccc96f; final trim model is
b021dd55, with repeated export tests and focused visual/phone checks. Actual
renders, measured bytes/triangles and limitations: docs/qa/atlas-mark-ii/.
No hardware-controller or FPS claim. Static shadows update for animated parts
and reuse their maps during camera-only movement.

Full asset: 398,608 triangles, 154 batches, 13 materials, 10 textures, 36,736,924 bytes;
LOD1: 128,387 triangles / 13,325,672 bytes; LOD2: 40,625 triangles / 3,974,280 bytes. Above existing hero
budget; no budget waiver. Initial independent Opus review was 2.4/5; a later
attempt hit the session limit, so no current independent visual approval exists.
Keep draft. Interiors and the long upper-hull rhythm still need art refinement;
automatic LODs, hardware budgeting and live fleet/boarding integration remain.

Preview: http://localhost:5250/dev/atlas-mark-ii.html . Stable transient user
service star-agent-atlas-mark-ii-preview.service serves this worktree's dist.
Stop only this preview with systemctl --user stop star-agent-atlas-mark-ii-preview.service.
No merge or public deployment is included.

Final shallow-angle render review also isolated broad hull striping to key-shadow
acne (shadow-off removed it, normal-map-off did not). Bias is now -0.0005 with
0.06 m normal bias for the 92 m key frustum. Seven final production views passed
again with actual shadows and zero errors; before/final evidence is retained.

Published as draft PR #30: https://github.com/AvonMexicola/star-agent/pull/30 . Preserve its draft status until independent art review and fleet integration are complete.


## Atlas upper-deck refinement in progress — 2026-09-06

Root owns only /tmp/star-agent-atlas-mark-ii, feat/atlas-mark-ii (draft PR30):
crew room end-wall closure, shaped pressure frames, bunk surrounds and upper
ceiling/service liners. Matching collision and exported-geometry checks belong
to this lane. Preserve approved exterior/nacelles and all shared runtime work.
First review view is the crew aisle at standing eye height; validate the actual
Blender export, full physical boarding route and upper-deck clearance before
updating the stable 5250 preview. No main fleet integration or merge this pass.


## READY FOR REVIEW: Atlas upper-deck construction — 2026-09-06

Draft PR30 / feat/atlas-mark-ii now has explicit crew fore/aft walls and an
outboard liner, enclosed berth backs and shaped end shells, chamfered pressure
frames in crew/corridor/mess/bridge, removable service cassettes and a visible
aft environmental panel. New Blender source: upper_deck.py. Approved exterior
and nacelle geometry preserved. The additional corridor render exposed old
coplanar jamb/partition faces; jambs now project 20 mm and have physical
colliders. Galley aisle retains 1.60 m for capsule-centre travel; side doorways
retain 0.96 m. There are 55 authored fixed collider envelopes.

Final hero SHA 659b54660075ff1adb759d1c1141dfbc06c8aba6302190766756cec016fc4a1f:
426,504 triangles, 157 batches, 13 materials, 10 textures, 38,890,964 bytes.
181 unit tests and production build pass. All four hardware browser cases pass
again (1.6 min), zero captured page/console errors. Extended physical route
reaches the last bunk, stops at its aft wall and returns through the doorway
before visiting galley/hygiene. Actual export tests also check room closure,
standing aisle clearance and depth separation at both door-frame junctions.
Chromium151 / AMD Radeon860M / ANGLE GL, inspection1440x900 DPR1. No FPS or
physical-controller claim. Final images, correction history and exact hashes:
docs/qa/atlas-mark-ii/upper-deck-record.md and README.md.

Stable http://localhost:5250/dev/atlas-mark-ii.html serves the verified final
hero (user unit star-agent-atlas-mark-ii-preview.service). Select CREW or use
physical walkthrough. Remains an over-budget standalone authoring candidate;
no independent art approval, live fleet installation, merge or deployment.
Fable/Claude retain review and integration ownership.


## Atlas nose, four pilot MFDs and projected action labels in progress — 2026-09-06

Root owns /tmp/star-agent-atlas-mark-ii / feat/atlas-mark-ii (PR30): trim legacy
front armour against new bow, mount sensors on their actual facets, four pilot
MFD anchors/screens and a reusable state-driven physical-control label standard.
Consumer integration is the Atlas studio (ramps, crew lift, pilot seat); station
hangar adoption remains a documented integration point for the station owner.
Shared main/station/equipment files remain untouched. Root owns new label/MFD
modules, limited shared MFD factory extension in this worktree and focused QA.


## READY FOR REVIEW: Atlas nose, four pilot MFDs and projected controls — 2026-09-06

PR30 / feat/atlas-mark-ii, isolated /tmp/star-agent-atlas-mark-ii. Removed old
forward flank overlap and detached docking boxes; trimmed arch plates that pierced
the lower bow. Retained sensor array now follows actual facet tangent/normal.
Drive-pod mesh preserved. New original Blender frames/anchors: PilotMFD_01..04.
Pilot eye aligned to chair; F/A sits and stands. Four shared 512x320 / 5Hz MFDs
show actual ramp/lift state, with flight/navigation/manifest explicitly disconnected
in this standalone studio. Shared createShipMFDs default behavior is preserved.

NEW REUSABLE STANDARD: docs/physical-control-standard.md,
src/projected-action-label.js and .css. Descriptor id/target/anchor/action/enabled/
reason; render-local anchors, F/A/TAP, guarded click/tap operation, opaque geometry
occlusion, disabled interlock states. Atlas consumer is src/atlas-mark-ii-controls.js
and studio. Labels say Go up/Go down/Call lift, Open/Close ramp and Sit/Stand.
Station owner: adopt the provided hangar state/verb contract with your actual door
mechanism and render-local button anchor; no station module changed here.

Final hero a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa:
412,988 triangles, 168 static batches, 13 materials, 10 textures, 38,037,892 bytes;
MFDs add four runtime meshes/materials/textures. 56 fixed collider envelopes.
184 unit tests and production build pass. Five hardware browser cases pass1.7min:
full physical boarding/upper-deck journey including sit/stand + four-screen framing,
seven presets, phone, mouse/touch lift-label operations and injected controller.
Final opaque-hover fix passes focused mouse/touch case1/1. No page/console errors.
Chromium151/AMD860M/ANGLE GL; pilot1440x900 FOV56; phone390x844. No FPS or physical
Xbox claim. Failure history and renders: docs/qa/atlas-mark-ii/cockpit-controls-record.md.

Preview remains http://localhost:5250/dev/atlas-mark-ii.html (persistent user
service). Physical walkthrough→lift→pilot seat, F to sit. Main fleet, flight/cargo
adapters, station label adoption, budgets/LOD acceptance and independent art review
remain pending. Keep draft; Fable owns review/integration/merge. No deployment.

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


## Design ready for review — crafting, skills and expedition progression (2026-09-06)

Cees asked to start thinking about material tiers, upgraded suits for valuable
hot-planet mining, and dangerous cave fauna with special loot. Recorded a concrete
draft at docs/design/progression-crafting-skills.md in the expedition worktree
(/tmp/star-agent-expedition-work, feat/selene-expedition / PR #24), linked from
PLANET-PIPELINE-MEMORY.md. No runtime change or implementation claim.

Proposal: four material tiers; Pyre industrial and Aeon cave/biological branches;
practical training in Extraction, Fabrication, Survey and Field operations; shared
box inventory for recipes/modules/loot. The initial Pyre suit must use materials
obtainable outside Pyre. Cave creatures have readable threats and biological loot
with noncombat alternatives. Start with station refining and one useful crafted
mining heat-sink, then suit hazards, one Pyre expedition and one complete cave.

The draft calls out the current three-mineral/fixed-supply save migration, atomic
crafting/training/loot, cave-owned collision and complete controller journeys.
Balance, creature/material names and economic prices remain proposals. Preserve
the independent ship-power, Atlas and station lanes. Design docs were reviewed
against current modules and local links checked; no gameplay tests were needed
for this documentation-only addition. Manager acceptance is not assumed.


## Ship recovery marker, biome deposits and base priorities — 2026-09-06

Cees prioritized a marker to find a ship after space EVA, then carrying limits and
a central mainframe for base building rights. They also requested actual mineral
deposits across resource biomes after learning that the five survey sites were
the only provincial outcrops. Implemented in /tmp/star-agent-expedition-work /
feat/selene-expedition / draft PR #24; preview http://127.0.0.1:5213/ serves
index-ChFNEySb.js. Runtime commits: 53a3c77 (marker) and baccba2 (regional deposits).

Automatic Nomad beacon: distance to rear ramp, in-view diamond, off-screen/behind
arrow, hides after boarding. Current hull pose is read every frame. Integration
with the independent moving-ship/Atlas lane must supply active hull name, pose
and entry point; do not copy a static departure coordinate or Nomad dimensions.
No binding is needed; full controller physical EVA exit/return/reseat passed.

Selene: deterministic regional outcrops in approximately 180 m spherical cells,
copper/ice-rich occupancy and sparser basalt, three local workers within 400 m.
Authoritative mineral weights drive visible seams and real yields; nearest/aimed
outcrops drive existing tool bearing/range. Named approaches retain an 80 m buffer.
Cuts preserve stable IDs through streaming/reload and share the existing eight
additional edited-deposit cap. Aeon biome deposits and whole-terrain excavation
are not implemented by this change.

All 28 numerical files pass. Five distinct browser journeys pass across the
integrated run and targeted marker run: marker, regional copper, named copper,
Crescent and physical space mining. Regional trip recovered 3.108 kg copper from
a generated outcrop 101.52 m beyond the nearest named site; exact cut/cargo saved
after reload. Curated evidence: docs/qa/expedition/ship-marker/ and
docs/qa/expedition/regional-deposits/. Controller input is injected; no physical
Xbox sequence or hardware performance approval is claimed.

Design only: docs/design/cargo-and-base-mainframe.md proposes mass/volume/slots,
hull-specific ship payload, physical base containers and central claim authority
with separate build/door/storage permissions. User priority moves a small playable
core/shelter/crate base slice ahead of the previous crafting-first plan. Construction
and new capacity/permission rules are not implemented yet. Full memory and prior
progression draft link the change. Preserve shared station/gear, ship-power and
Atlas lanes; Fable/Claude retain review/integration/merge/deploy. This file notice
is not manager acknowledgment or a public deployment claim.


## READY FOR REVIEW: new particles connected to expedition mining — 2026-09-06

Cees requested the new mining particle system in the playable tool. PR24 now
reuses PR27/a81b75e's plasma beam, sparks/dust, mineral collection and HDR bloom.
Committed extraction forwarding includes the newer regional deposits, alongside
Crescent, province and ring rocks. Actual saved cuts drive collection bursts;
visuals never award minerals. RT/T/mouse/touch bindings remain the same. The
controller can toggle glow and reduced particle motion in Controls and help.

All 29 numerical files and five distinct production browser checks pass, including
three full controller surface routes, physical space mining and the focused
mouse/touch/interruption/settings regression. Its initial mobile visibility race
was corrected in the test and rerun; QA records that failure. No page/console
errors in final cases. Browser151/SwiftShader, desktop1440x900/mobile390x844;
no hardware FPS or physical Xbox claim. Curated evidence and full contract:
docs/qa/expedition/mining-particles/ and docs/mining-particles.md.

Preview http://127.0.0.1:5213/ serves index-DY2p5nPi.js. During PR27 integration,
keep one shared EnergyEffects director/bloom pass and retain regional forwarding.
The actively edited effects worktree, shared gear and ship lanes were untouched.
Fable/Claude retain independent review, integration, merge and deployment.


## READY FOR REVIEW: equipment slot system


## Equipment loadout implementation — 2026-09-06

New branch feat/equipment-loadout is stacked on expedition c3ef10c (PR24), isolated
in /tmp/star-agent-loadout-work. The shared inventory dialog gains Equipment:
two weapon slots, tool, backpack, two ammo stacks and four quick-item stacks.
State lives in the SAME MiningStore save as cuts/cargo. Legacy saves receive one
finite starter kit; swaps/stows/assignments, ammo and medical use save atomically.
A backpack must be empty before external stow; without it carrying/gathering
capacity is zero. Existing box mounts return when it is equipped again.

K/Menu→Equipment opens it; View/I opens Storage. D-pad left cycles held slots,
right retains mining shortcut, up selects a quick slot, down uses it on foot/EVA.
Flight bindings remain unchanged. Weapon1/2/tool map to keys1/2/3; quick use4–7.
Ammo authorization runs in Equipment's fire gate before shot effects, one matching
charge per pulse; failed saves cancel the shot. No magazine/reload timing yet.
Bandages heal15/stop bleeding, stims heal40, capped100; full-health items aren't
wasted, and neither revives. There is no ambient/combat injury source yet; injure()
is an explicit hook. These effects were verified against an injured-save fixture.
Late asynchronous models cannot reattach after switching, and tool heat is kept
across slot changes. Shared authored models/rig offsets are not changed.

All30 numerical files pass. Four final production browser cases pass (4.1min):
complete controller gear+Selene mining+both weapons+backpack, saved medical/mobile
UI, container transfers and physical space mining. Prior focused mining-input
regression also passes. Initial duplicate-Backpack-label failure and interrupted
mixed run are documented; the final dedicated-port suite completes normally.
Evidence: docs/qa/equipment-loadout/. Contract: docs/equipment-loadout.md.
Preview http://127.0.0.1:5271/ serves index-BPCnBCsf.js; port5213 remains the prior
expedition build and has a separate browser save. No physical Xbox/FPS claim.

Fable integration: retain the one particle director and regional callbacks from
PR24, newer authored gear/rig/ship work, and PR27's independent colored weapons
and flight integration. Keep the public Equipment authorizeFire hook, inventory
loadout transactions and contextual D-pad routes; don't restore the old unlimited
free weapon selector over them. No merge or public deployment is claimed.


## Starter laser rifle and current particle effects — 2026-09-06

Cees requested a starter rifle, mining tool and ammo, then the particle agent’s
latest laser effects. The finite default already grants rifle-laser, mining tool
and 60 compatible charges (plus sidearm/pack/medical kit). The equipment branch
now names them Laser rifle / Laser rifle charges and actually selects the solar
laser profile: immediate orange beam/core, muzzle motes and contact bursts.
Sidearm uses crimson pulses. Reuses PR27 d9f4d7c EnergyEffects, weapon profiles and
slipstream dependency; preserves the single director, mining collection callbacks,
saved IDs and atomic ammo authorization. Small held recoil respects Reduced motion.
Flight adapter remains PR27’s integration responsibility; no new flight input.

All 30 numerical files pass. Two final production browser checks pass (5.2 min):
full controller equipment/landing/mining/weapons/backpack and mouse/touch mining
with menu/focus/disconnect suppression. Six observed rifle shots consume exactly
six charges and create six impacts; rock revision is unchanged by weapons.
Fresh default, active laser profile/beam, menu retirement and held RT suppression
are asserted. No page/console errors. Inspected rifle/sidearm/mining captures and
updated JSON are under docs/qa/equipment-loadout/. Chromium151, Vulkan SwiftShader;
no physical Xbox or hardware FPS claim. Preview5271: index-B3rNxrVo.js.
Preserve shared newer authored gear assets when integrating PR32 with PR27.

## Pyre continuation — 2026-09-06

Cees authorised continuing Fable's planet work. The isolated `feat/pyre-planet-tech`
branch restores the unfinished Pyre wiring on top of `a18cf81`, then adds shared
patch surface maps, parent-triangle morphing and canonical basalt/oxide/sulphur
composition. Scope and integration notes: `docs/pyre.md`. Changes to main,
navigation, atmosphere and UI are confined to this branch; other agents' working
copies and the existing surface preview were left intact.

Pyre's local preview is on port 53758 (`star-agent-pyre-planet.service`). Browser
QA is `scripts/pyre.config.js`; evidence is under `/tmp/star-agent-pyre` with curated
images in `docs/images/pyre`. Resource surveys and terrain colours share the field;
Pyre excavation and heat damage remain unimplemented. Aeon/Selene's separate
material, meadow, stones and expedition PRs still require their own integration.

## READY FOR REVIEW: recovered station hull detail — Astra, 2026-09-06

feat/station-hull-detail, isolated /tmp/star-agent-station-hull, based on
integration029cae8. Production preview http://localhost:5185. Recovered Fable's
builder and both station models; corrected split-material hierarchy so Hull
contains every structural part. LandingDeck remains one Mesh; floor regression
now tests the recessed seam and adjacent full-height plate with exact original
bounds and hull clearance. No runtime navigation/lighting/props modules changed.

124 unit tests, build, four production Chromium browser cases passed. Includes
opening/controller handoff, physical boarding/launch, moving floor at scale1/.55,
and full fly-in/dock/deck/reboard/depart journey plus phone controls. Before/after
images and six world viewpoints: docs/qa/station-hull/ (zero browser errors and
warnings). Station samples284–361 draws /190310–317000 tris depending viewpoint;
SwiftShader1440x900 scale1, no hardware FPS claim. Existing orbit budget and world
art defects remain documented. Hero2.99MB/70540tris/105primitives, LOD273KB/7784tris.

Files: blender/build_station.py, public/models/station*.glb, tests/station-floor.test.js,
scripts/hull-review.mjs and hull.config.js, assets/station/hull-manifest.json,
docs/station-hull-detail.md and curated QA evidence. Sol audited contracts/cost
and committed only the floor test; Astra reviewed/rebuilt the asset and ran
renderer/journey validation. Named batches may now be groups; preserve vertex colours
and traverse descendants in the other hangar lane. Collider data increases62%;
review shared BVH use before twenty-pod adoption. PR20 props/materials/light
refinement remains separately owned and untouched. Shared root originals preserved.

Draft pending independent Opus rubric: attempt returned429/session limit until
13:50 Europe/Amsterdam. No visual approval, merge or deployment claimed.


## Station hull integration reconciliation — 2026-09-06

PR22 history and review evidence are included. The active builder, hero/LOD and
floor tests remain the later furnished PR20 versions, which already include
the recovered hull hierarchy and plate treatment. Older PR22 assets must not
replace the furnished station. assets/station/hull-manifest.json explicitly
records historical hashes; current station production record is authoritative.


## Shared snapshot reconciliation — 2026-09-06

The feat/controller-support snapshot predates the current feature branches.
Its controller, moon, ship, crash and inventory implementations are superseded
by the integrated versions; old copies were not restored over them. Preserved
its three unique handoffs and landing-gear solver/tests. That solver remains
unwired, exactly as LANDING-GEAR-HANDOFF documents. Deleted legacy albedo.worker
is superseded by orbital-surface workers and remains deleted. Shared working
directory uncommitted station and equipment art was not included.


## Terrain and ground detail — READY FOR REVIEW

Astra: feat/terrain-transitions is stacked on forest PR #6, isolated at /tmp/star-agent-terrain-work. Land/water/shadow parent-triangle morphs, 0.6 s wall-time split/merge, 1.8/2.3 hysteresis, retained parents/skirts, and terrain-material.js ground detail are integrated. 69 unit checks, production terrain/ground inspection, focused shallow-water inspection and four general Chromium cases pass. Original fine buffers remain byte-identical across eight regression fixtures. Review notes/screenshots and limitations: TERRAIN-HANDOFF.md and docs/images/terrain-*.png. Preview http://localhost:5176/?seed=7291. main.js changes are diagnostics only; preserve other branches’ ShipState/controller/moon/ship hooks when integrating. No merge or production deployment by Astra.

## READY FOR REVIEW: MAIN CONSOLIDATION PR34 — 2026-09-06

Runtime0ab1854; current integration ancestrya20ca1e adds only Pyre invariant tests,
docs and reconciliation of44e426a. See docs/qa/main-integration/README.md and
pyre-reconciliation.md. Final447/447 unit tests, production build,15/15 core
browser checks and7/7 Atlas/equipment browser checks pass. Chromium151/AMD860M/
ANGLE GL; no physical Xbox or controlled FPS claim. Independent Opus functional
follow-up found all findings fixed and source functionally mergeable; its remaining
extra-suite condition is satisfied by7/7. Review and final screenshots attached.

Main exists at accepted85aa836; PR34 contains the combined candidate. PM owns the
ongoing Opus visual/baseline gate and default/Vercel changes. Site is not updated.
The newer Sun encounter PR35 is reserved for PM's next rebase. Dirty shared station
and gear work remains untouched. Do not restore older controller/hull/Pyre snapshots
over the reconciled code. No feature branches deleted. Preview5280 serves this
runtime; tests and public docs distinguish the Atlas studio from the live fleet.

## ROOT DELIVERED — STARTUP PRELOAD AND STATION DEPARTURE — 2026-09-06

Integration preview http://localhost:5280 now serves main-8-TKQTmE.js.
Station departure commit1f489b1: one-metre gear lift, no overshoot, obstruction
cancels a stuck lift, bay speed20m/s instead of6. Automatic capture requires a slow
arrival near the actual ship parked height, so a slight nose-down departure cannot
re-dock at the planetary clearance threshold. Both layouts and all20 tilted berths
covered, plus full physical keyboard and Gamepad boarding/departure journeys.

Startup waits for station/ship/characters/surface maps/Aeon4096 orbital generation,
settled starting terrain, async shader compilation and rendered warmup before
handing over controls/cinematic. Stage-labelled progress bar, pre-play resolution
calibration, held-key release guard, Gamepad neutral gate and sticky graphics-loss
recovery. Optional orbital-worker failure/disposal releases waiting preload.
This moves work earlier; no persistent generated-map cache, universal FPS claim
or whole-universe preload. Initial successful boots20–24s on this machine.

Final458 unit tests/build pass. Six affected startup/opening browser cases pass;
two startup cases rerun after final held-input/fatal hardening pass. Independent
Astra review approves this bounded change, loading UI4.0/5, desktop/phone evidence
and real WEBGL_lose_context warmup recovery. Records: docs/qa/startup-preload/ and
docs/qa/station-departure/. Hardware gamepad not tested.

PR34 remains DRAFT: request23 full-scene visual blockers remain open. This is not
READY FOR MERGE for the whole consolidation. main/default/site unchanged. New
retail435f116/PR20 handoff acknowledged, not merged over this lane; SunPR35 remains
separate. Updated TOKEN POLICY v2 reviewer ownership acknowledged.


## CHARACTER LEG CORRECTION — applying scoped source integration, 2026-09-07

The isolated fix passed 508 unit tests, production build, 2 production browser
checks including the controller weapon/boarding/launch journey, and independent
Opus visual review (4.2/5, correction only). Root now claims ONLY new
blender/avatar-legs.mjs, tests/character-legs.test.js, the leg capture helper, and
the three small prepare-avatar import/call/report hooks plus npm test entry in
the current character worktree. The original owner's newer avatar-grips,
equipment/sockets and existing character tests are retained. The GLB will be
rebuilt from those current sources; no isolated older binary/runtime is copied.
This is source integration into the unfinished character candidate, not main,
combined preview, or deployment. Complete-character motion/skin-weight polish
and acceptance remain the character owner's work. See isolated
docs/qa/character-leg-rig/README.md for evidence and exact scope.

Character owner integration note, 2026-09-07: leg source hooks and
tests acknowledged and preserved. The combined source was rebuilt after the
latest glove closure/foregrip calibration and raised rifle aim changes; current
runtime is 8,496,328 bytes. Character owner is running the combined unit suite,
production studio/opening/EVA journeys and GPU measurement, then a targeted
independent Opus recheck. Please leave final runtime rebuild, character QA record
and PR delivery to this lane while those checks run. Leg correction files remain
owned by their author; no older isolated binary will replace this candidate.


## DELIVERED — expedition jump/crouch thigh correction, 2026-09-07

Source handoff commit e3c7494 on fix/character-leg-deformation contains the new
leg helper, regressions, capture script, portable builder patch and curated QA.
The source-only patch is ALREADY APPLIED to the current feat/character-fidelity
worktree, and its current-source rebuild is serving at
http://127.0.0.1:5318/dev/avatar-studio.html. Do not apply it twice or copy the
isolated older whole runtime/GLB over the owner's ongoing hand refinements.

Hip pivots were 17 cm below the flexible seam, inside the thigh plate. Corrected
hip joints, bind-preserving inverse matrices and offline 60 Hz leg retargeting
keep the original feet within 3 mm and the upper-body tracks unchanged.
508 unit tests/build and 2 production studio/controller-journey checks passed
both in the isolated correction and after source integration. Independent Opus
visual review accepts this bounded correction at about 4.2/5 (fresh renders).
The owner subsequently rebuilt its newer glove shapes with this hook retained;
latest leg/real-character regressions pass 10/10. Latest observed GLB
04f849bafe513f8e2a817895307a2751ebed85f76d4ef81cd0ae793ddc5911fa,
8,496,328 bytes, 62,177 triangles, 24 joints, 26 clips. No extra runtime solver.

Full record/review: docs/qa/character-leg-rig/ in the owner worktree and the
isolated source branch. Small hip/knee weight-polish items and continuous-motion
art acceptance remain in the overall character work; frozen-pose approval is
not full-character sign-off. Main/dev-all-features/site were not updated.
Complete owner candidate/unrelated changes remain uncommitted on its behalf.
Leg correction claims are released to the character owner; GPU QA is finished.

## READY FOR REVIEW: expedition character and first/third-person equipment — 2026-09-07

Files: `src/character.js`, `src/character-ik.js`, `src/equipment.js`,
`src/mining/{tool,field}.js`, `src/ship-camera.js`, opening/main integration,
`src/avatar-studio.*`, `blender/avatar-*.mjs`, retained character/font sources,
runtime GLB/socket/manifest entries, tests and `docs/qa/character/`.

Branch `feat/character-fidelity` is explicitly stacked on `feat/flight-options`
(PR 38 / 3e0f3b9), which supplies the existing camera/equipment contracts absent
from the older QUALITY base. The shared controller checkout was not modified.

62,177 visible triangles, two 2K WebP PBR maps, 24 joints, 26 clips, glove morphs
and the separately authored hip correction. The shared opening/gameplay rig
holds rifle/cutter with both palms, pistol with one; first person retains its
viewmodel. `4` or `LB+RB + D-pad right` switches while walking or in EVA, keeping
the same ammo, heat and inventory. Menu → Wave returns to the held-item pose.
Ladder, seat, pickup, reload and injury are animation hooks/studio assets; new
physical traversal/seating/reload/damage mechanics are not claimed.

Live local review: http://127.0.0.1:5318/dev/avatar-studio.html
Game: http://127.0.0.1:5318/?intro=1
Meshy asset: White Horizon Explorer, 35 existing credits, retained source exports.

Validation: 508 tests pass after final support calibration; production build
passes. Five production browser cases passed, followed by the final studio
recheck (33.6 s). Complete injected-controller routes cover opening, equip/fire,
camera switching, Wave/held-trigger suppression, physical boarding/launch and
EVA exit/fire/coast/brake/return. No physical-device test is claimed.
Independent functional recheck accepted; final Opus visual score **4.33/5**, no
item below 4, including explicit confirmation of both support grips.

Draft until strict scene timing acceptance: all affected hangar geometry fits
600 draws / 900k triangles, but the latest non-isolated AMD 860M native-resolution
GPU measurement is 10.81 ms first person / 10.38 ms third-person rifle versus
10 ms. Other measured views are under 10 ms. No merge/deployment is claimed.
Full measurements, initial failed reviews/checks, fixes, retained screenshots and
remaining nonblocking art polish: `docs/qa/character/production-record.md`.
