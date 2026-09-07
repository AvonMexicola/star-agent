# Planet technology reference

*Consolidated 2026-09-06 from `PLANET-PIPELINE-MEMORY.md`, `MOON-HANDOFF.md`, `LUNAR-LANDSCAPE-HANDOFF.md` +
`docs/selene-landscape.md` (PR #15, `origin/feat/lunar-landscape`, not merged), `docs/qa/weekly-2026-09-06.md`, and the
source on `feat/visual-fidelity`. Numbers are the ones in the code, not the ones in the roadmap. When a file is named,
the file wins over this page.*

## 1. Coordinates, precision, rebasing

- **World frame**: JS doubles, metres, Aeon centre at (0,0,0). `SUN_DIRECTION = normalize(.9,.35,.12)`,
  `SUN_DISTANCE = 25e9` (`world.js`). The star and every body are static in the session; nothing orbits.
- **Floating origin**: each frame `main.js` does `origin.copy(nav.position); camera.position.set(0,0,0)`; every module's
  `update(worldPosition, renderOrigin)` sets `mesh.position = worldPos - origin` in doubles and only then uploads floats.
  Custom instanced/point buffers must do the same (PR #15: ring rocks subtract the origin in doubles, tested).
- **Patch-local geometry**: a patch's centre is computed in doubles and subtracted before the `Float32Array` write.
  Aeon centres on the base sphere (`center = d·RADIUS`, `world.js generatePatch`, fine because |h| ≤ 5 km);
  Selene centres on the *actual* surface (`centerRadius = MOON_RADIUS + moonSurface(d).height`, `moon-terrain.js`) because
  crater floors sit kilometres below the sphere. Use the Selene form for any new body.
  Mesh translation = `patchCentre + bodyCentre − origin` (`MoonTerrain.update`). Regression: `tests/moon.test.js`
  reconstructs level-17 vertices after rebasing and requires |altitude error| < 1e-5 m.
- **Stable texture coordinates**: `surfacePoint = position + ((center % 256)+256)%256` (`planet.js receive`,
  `moon-terrain.js points`) — the CPU discards whole 256 m periods so fine detail does not crawl on rebases.
- **Depth**: `WebGLRenderer({logarithmicDepthBuffer:true})`, camera near .08, far `SUN_DISTANCE*5`. The atmosphere pass
  reconstructs distance as `(exp2(depth·log2(far+1)) − 1) / −viewRay.z` and treats `depth ≥ .999999` as space (stars).
  Never divide the inverse-projected direction by `w` (it is 0 at that far plane). Anything visible against space must
  write depth, or the composite must keep alpha (PR #15's fix: clear the HDR target to alpha 0, composite stars through
  `1−alpha`; that fix is only on `feat/lunar-landscape`).
- **Material contract**: extend `MeshStandardMaterial` via `onBeforeCompile` (keeps `<logdepthbuf_*>`, shadows, lights,
  env) and give every variant a distinct `customProgramCacheKey`. Colours are linear; ACES + gamma happen once, in the
  atmosphere pass (`exposure 1.08`); `renderer.toneMapping = NoToneMapping`, output `LinearSRGBColorSpace`.
- **Body domain**: `celestial.js bodyAt(position)` returns Selene inside 8 lunar radii, else Aeon. Altitude, up vector,
  gravity and the walking floor all come from the active body (`bodyAltitude`, `bodySurfacePoint`, `bodySurfaceNormal`).
  Camera transport across the domain switch is suppressed (`navigation.update`: `oldBody===this.body`).

## 2. Height-field generation

### Aeon — `src/terrain-v2.js` (`TERRAIN_VERSION 2`), seed from `src/generation.js`
`SEED` default **7291** (`?seed=`), `GENERATOR_VERSION 2`; `world.js hash()` XORs the seed, so every noise term and the
workers (`setPlanetSeed` in `terrain.worker.js`/`albedo.worker.js`) share it. Frequencies (`RADIUS/f` = cell size):

| term | f | cell | amplitude / role |
|---|---|---|---|
| continents (domain-warped `fbm`, W=.15) | 3.05 | 530 km | `q = fbm − SEA(.5075)`; ~49 % ocean |
| mountain belts `ridged(…,2)` | 9.2 | 177 km | `belt = smoothstep(.60,.94)`, uplift × `MOUNTAIN_AMP 3900` |
| ridged multifractal `ridged(…,6)` | 145 | 11 km → 260 m | crests/spurs; valley carve `1 − (.34+.42·uplift)·carve²` |
| hills `fbmR(…,4)` | 560 | 2.8 km → 350 m | 170 + 520·uplift + 120·interior |
| mid `fbmR(…,3)` | 4200 | 380 m → 90 m | 85 + 260·uplift |
| micro `fbmR(…,5, lac 2.31)` | 17000 | 94 m → 3.3 m | ±15 m × (.8 + 1.5·uplift + .45·highland) |
| dunes `fbmR(…,3)` | 90000 | 17 m | ±5 m on 0.4–17 m beaches |
| terracing | — | 130 m steps | uplift × smoothstep(1100,2500,h) × .42 |

Primitives worth reusing: `qnoise` (quintic, C2 — smoothstep noise leaves creases at metre scale), `fbmR` (rotated
octaves; unrotated octaves reinforce into square blocks), `ridged` (weighted octaves → spurs), `terrace`, `rot1/rot2`.
`surfaceColor()` returns linear albedo from height/slope/moisture (beach, dryland→forest, alpine, rock > 30°, scree, snow
line `3500 − 3900·smoothstep(.25,.94,|y|)`, polar ice). `slopeAt` uses two extra samples at 9 m.

### Selene — `src/moon-world.js`
Own LCG seed `0x53454c45` → independent of `?seed=`. `MOON_RADIUS 434 350`, distance 24 000 km in direction
`normalize(−.1,0,−1)`, `MOON_GRAVITY 1.62`. `CRATERS`: 96, radius `.012 + r²·.13` rad, depth `radius·R·.035` (v2) /
`·.095` (v4). Crater term (reuse this for any cratered body):
```
r    = sqrt(2−2·dot(d, crater.dir)) / crater.radius          // 0 centre, 1 rim
bowl = −depth·(1 − smooth(.15,.94,r))                        // v4: smooth(.22,.98)
rim  =  depth·.36·exp(−((r−.98)/.12)²)                        // v4: .46, (r−1.01)/.115, ×broken-rim noise
v4 adds: ejecta depth·.055·exp(−((r−1.17)/.27)²)·(1−smooth(1.35,1.65,r)), central peak depth·.16·exp(−r²/.015)
fresh += exp(−((r−1.03)/.20)²)·.055 → brighter ray material
```
v2 relief: `(broad−.5)·1800 + (detail−.5)·130 + (hills@850−.5)·12 + (gravel@12000−.5)·.16` — i.e. **nothing between
6 m and 8 cm**, the root cause of QA defect 1. v4 (PR #15): `(broad−.5)·6200 + detail·1150 + ridged highlands
(2100 + 620) + noise@720·165 + @2500·18 + @18000·.9`, 36 local craters and 3 mountain groups (6.2–7.6 km) around the
landing site, a 35 m level landing shelf blended out by 150 m, a 45 m-lattice of basalt outcrops (2.5–9 m), a 180 m ice
trough, and per-vertex material colour + named districts (`moonRegion`). `MOON_MAX_HEIGHT` 4 000 (v2) / **16 000** (v4)
bounds the swept-contact sphere; the travel exclusion (20 km) must stay above it.

### Resolution facts
`GRID 16`, `MAX_LEVEL 17` for both bodies. Patch width at level L = `2/2^L · R`; vertex spacing = width/16.
Aeon L17: 24.3 m / 1.52 m. Selene L17: 6.6 m / 0.41 m. A 1 200 km body: 18.3 m / 1.14 m. Aeon samples normals with
finite differences at `step = clamp(size·R/GRID·.5, .4, 200)` scaled by `smoothstep(2,7,level)`; v4 Selene instead
samples a one-cell halo (stride `GRID+3`) and cross-products neighbours — one height call per vertex instead of five.

## 3. LOD streaming, workers, patch budgets

**Aeon (`src/planet.js`)** — 6 cube roots; `select()` every 160 ms; split when `level<3` or
`surfaceCenter.distanceTo(camera) < size·R·1.8` and `level<17`; horizon cull `normal·radial < R/|cam| − size·1.5 − .035`;
parent stays visible until all four children have meshes; requests sorted by `distance/(size·R)`; worker pool
`min(3, max(1, hardwareConcurrency−2))`, typed buffers transferred; cache evicts at >1100 nodes (level>3, unused 8 s);
skirts `max(4, size·R·.045)`; `ready` = six roots meshed; `pending` = queue + jobs. `transit()` waits ≤ 6.5 s for
`pending<4 && maxVisibleLevel≥12` (Aeon) / `moon.terrain.maxLevel≥14` (Selene). Water: a second mesh per patch when any
vertex is < 50 m → ~2 draw calls per patch (defect 9: 477 calls in orbit).

**Selene (`src/moon-terrain.js`)** — synchronous, main thread, **`budget = 8` patches per frame**, min level 2
(v4: 3 within 12 R), `ready` = `maxLevel ≥ 2`, evict at >900 nodes. Lessons:
1. *Budget + ready gate* (defect 1): at 180 m the QA gate passed with LOD 3. A fine LOD must be required near the
   ground (≥ 12 below 2 km) and the landing column pre-warmed during the transit cover so the first frame is fine.
2. *Sibling eviction loop* (PR #15): horizon-culled siblings are still needed for the all-four-children rule; stamp
   `lastUsed` on all children of a split node or the cache rebuilds/exposes coarse parents forever. Regression: advance
   the clock past expiry, require zero builds for a stationary view (`buildsLastFrame`).
3. *Skirts vs relief*: v4 deepened skirts from `size·R·.04` to `.18` for steep terrain.
4. *Horizon culling* must include `MAX_HEIGHT/R`, not a fixed `.035`, once mountains are kilometres high.
5. Nobody has geomorphing or split/merge hysteresis (request 11); patch seams stair-step the horizon (defect 10).
6. One patch = 512 + 128 skirt triangles; ~200 visible patches from orbit ≈ 130 k triangles.

## 4. Surface materials

| module | status | what it does |
|---|---|---|
| `surface-materials.js configureTerrainMaterial` | **adopted** (Aeon, `planet.landMaterial`) | attributes `direction`, `terrainHeight`, `surfacePoint`; 1024×512 albedo (`albedo.worker.js`) fades in 20–80 km; `detailFade = 1−smoothstep(120,1600,range)`; triplanar weights `pow(|n|,6)`; four `DataArrayTexture` layers from `ground-textures.js` (soil, fractured stone, moss, sand; 512², 4 m tile, `p = surfacePoint·.25`); `detailNormal()` from screen derivatives (`detail.a·.055`); roughness `.88 + detail.a·.1`; snow branch discards the layers (defect 2) |
| `surface-materials.js createSurfaceTexture` | adopted | 256² packed relief/organic/stone/roughness, also drives `weatherShip()` |
| `moon.js` v2 | adopted | 1024×512 albedo from `moonSurface().albedo` sampled by lon/lat, 128² grit triplanar, fade 100–1200 m — "untextured beige" at 180 m |
| `moon.js` v4 (PR #15) | unmerged | `vertexColors` from the sampler, `rockTexture()` 256² cellular cracks (4 m tile), height strata bands with `fwidth` anti-alias, slope tint, roughness `.97→.52` by frost, derivative normal `grain·.025·detailFade` |
| `terrain-material.js` | **not adopted** (326 lines, Claude) | GPU value noise with analytic gradients, 10 octaves 6 cm–500 m, exact planet height reconstruction, layers grass/dirt/rock/sand/snow/ice; API `createLandMaterial({planetAlbedo, albedoReady})` + per-frame `updateLandMaterial(m,{renderOrigin,sunDirection,time,cameraAltitude})`. Request 22 says adopt for Aeon. Its layer section is Aeon-specific; the octave scaffold (`tmOctave`, `tmNoised2`, `tmRidge`) is body-agnostic. |

Lighting (`lighting.js`): sun `DirectionalLight(0xfff1dc, 3.4)`, 2048² shadow map ±110 m, shadows only < 1500 m;
hemisphere `.08 + .35·daylight·e^(−alt/60 km)` (airless: `.055`, neutral); PMREM sky env `.04 + .4·daylight·…`
(airless `.015`). The only per-body switch is the `airless` boolean. Rule of thumb: 3.4 × albedo .3 ≈ 1.0 → ACES mid-tone;
albedo ≥ .9 clips (polar). Emissives > 1 are fine; > ~6 blow to white.

Distant-band rule (defect 10, PR #15): vertex colour must carry identity from 1.6 km to 20 km (no dead band), and
sub-metre detail must live in a mipmapped fragment texture, never in vertex noise sampled by coarse patches
("patchwork grid").

## 5. Atmosphere and clouds — **single-body, hard-coded to Aeon**

`atmosphere.js` is one full-screen composite: uniforms `radius = RADIUS`, `atmosphereRadius = 1 + 70000/RADIUS`,
`cameraPlanet = worldPosition/RADIUS` (Aeon at the origin, always), `exposure 1.08`. Constants in GLSL:
`BETA_R = (5.802e-6, 13.558e-6, 33.1e-6)`, `BETA_M = 3.996e-6` (grey, ×1.1 extinction), `density = (e^(−h/8000),
e^(−h/1200))`, 16 view samples + 6 light samples, HG `g = .76`, inscatter gain 11, sun disk angular radius
.0048 rad (fixed), stars from a 950-cell hash, daylight fade `smoothstep(−.12,.2, up·sun)·e^(−alt/35 km)`.
Clouds (`cloud-volume.js`): 32³ noise, shell 1800–4600 m of Aeon, 16 steps, coverage `smoothstep(.44,.72, weather)`,
sun shadow by two extra taps; they use the same `radius`/`cameraPlanet`, i.e. Aeon only.
Selene has no atmosphere; the pass still runs unchanged (Aeon stays visible from Selene). **There is no per-body
parameter object.** Any second atmosphere must add its own centre/radius/scale heights/betas and keep Aeon's path
byte-identical. Flight air (`flight-model.js FLIGHT`: density 1.225, scale height 8000, atmosphere 70 000, plane
20 000) is also Aeon-only: `navigation.flightEnvironment` returns vacuum for `airless` bodies and
`environmentAt(position, RADIUS)` (origin-relative!) otherwise. `audio.js` mutes wind when `airless`.

## 6. The second-body pattern (Selene) — checklist for a new body

1. **Constants + sampler** (`moon-world.js`): radius, position (frozen array), gravity, `MAX_HEIGHT`, generator
   version, landing direction, own seed. One pure `surface(x,y,z) → {height, colour…}` used by mesh, normals, contact
   and walking. Sample 2000 Fibonacci directions + poles + seams in a test; negative heights are valid on airless bodies.
2. **Swept contact** (`constrainMoonStep`): bounding sphere `R + MAX_HEIGHT + clearance`; march with step
   `min(250, h/20)`, ≤ 4096 iterations, 24 bisections, stop at the checked point when the budget runs out
   (`limited:true`); clearance 3.2 m = ship belly.
3. **Registry** (`celestial.js`): `{id, name, center, radius, gravity, airless}`; `bodyAt` domain 8 R;
   `bodyHeight` chooses the sampler (currently by `airless`, Aeon clamps to sea level).
4. **Navigation** (`navigation.js`): `flightEnvironment` per body; `transitMoon(altitude 180)`; `dryGround()` true when
   airless; `touchDown()` orients on `bodySurfaceNormal` for airless bodies; walking floor from `bodySurfacePoint`
   (`h = airless ? 0 : terrainHeight` guards the Aeon shoreline only); substep loop calls `constrainMoonStep` first.
5. **Rendering** (`moon.js`, `moon-terrain.js`): a `MoonTerrain` quadtree parented to the scene, material with
   `customProgramCacheKey`, eclipse dimming `material.color = .035 + .965·visibility`; `main.js` calls
   `moon.update(origin, origin)` every frame.
6. **Lighting/audio**: `lighting.update(normal, sun, altitude, airless)`; `audio.update({airless})`.
7. **Travel** (`travel-model.js`): `TRAVEL_TARGETS = [targetFrom(AEON,100 km,150 km), targetFrom(SELENE,20 km,50 km)]`
   — exclusion must exceed `MAX_HEIGHT`; `planTravel` rejects routes through any target's exclusion sphere and the
   station (2 km). `navigation.travelRoute()` adds obstacles.
8. **Map** (`system-map.js/.css`): a `.map-body[data-travel-target]` button, a description string in `refresh()`,
   absolute CSS position; `system-map.css` phone overrides.
9. **Destination** (`index.html` `[data-destination]` button 07, help text; `style.css` 7-column grid ≥ 1100 px):
   `main.js setCourse()`/`transit()` branches, the transit wait condition, HUD strings (`nearMoon = nav.body.airless`
   — must become an id switch with three bodies), `window.starAgent.state.moon` diagnostics.
10. **Tests**: `tests/moon.test.js` (bounds, seam, contact, crater, precision, edge sharing, streaming, audio),
    `tests/navigation.test.js` (land/walk/jump/reboard, pole/far side, domain crossing), `tests/travel-model.test.js`
    targets; browser journey `scripts/moon.spec.js` + `moon.config.js` (own port, `npm run test:browser -- -c …`).
11. **Evidence**: screenshots + `environment.json` (browser, GPU string, viewport, render scale); curated PNGs in
    `docs/`; SwiftShader proves rendering, not frame rate.

## 7. Known defects and lessons (do not repeat)

- **D1 Selene plane (1.2/5)**: budget 8/frame, `ready` at LOD 2, no metre-scale octaves. Fix pattern: 64/frame
  < 5 km, prewarm the landing column, `ready ≥ 12` near ground, add ±1.5 m @ 30 m and ±0.3 m @ 8 m octaves + fragment
  relief.
- **D2 snow flat + clipped**: a material branch that bypasses the layers and an albedo ≥ .9 under sun 3.4 → paper.
  Every material branch must keep a relief layer and a detail normal; keep bright albedos ≤ ~.62.
- **D8/D9 budgets**: orbit ≤ 300 draw calls — one mesh per patch, no water mesh where there is no water; skip or
  quarter the scene render under a modal.
- **D10 distant band + horizon stairs**: carry material 1.6→20 km; geomorph/hysteresis still open (request 11).
- PR #15: `fwidth` anti-alias on high-frequency shading bands; triplanar mipmapped textures for sub-metre detail;
  transparent objects vanish against space unless the composite keeps alpha; verify the *served* build (hash), not
  HTTP 200; wait for zero builds before judging silhouettes.
- `main.js` transit gate and QA gate both read `state.ready` / LOD — make the gate honest or QA passes a blob.
- Ownership: `main.js`, `navigation.js`, `planet.js`, `atmosphere.js`, `world.js`, `index.html`, `style.css` are Astra's;
  since the "Branch & PR rules" every topic is an isolated worktree + PR against `feat/visual-fidelity`, and shared
  files are edited additively (no wholesale copies; `HANDOFF.md`/`ROADMAP.md` append-only).

## 8. Open questions

1. `Body` abstraction (ROADMAP §3): descriptors still carry no sampler/atmosphere/material; `bodyHeight` switches on
   `airless`. A `height()` function per descriptor is the smallest step.
2. Per-body atmosphere (and per-body `FLIGHT` air) — see §5; also the sun disk's fixed angular size.
3. Orbits: everything is static; "Keplerian at 1× real time" needs body-relative navigation or an epoch-frozen position.
4. Geomorph + hysteresis for both quadtrees; worker-based streaming for non-Aeon bodies (Selene is synchronous).
5. `terrain-material.js` adoption for Aeon vs the layered `surface-materials.js`; which one new bodies should extend.
6. Water draw calls (defect 9) and modal render skip.
7. PR #15 merge order vs anything that touches `moon-*.js` or the atmosphere composite (alpha clear).

## 9. Pyre — the hot inner planet (this PR)

See `docs/pyre.md` for parameters and tuning. What Pyre adds to the pipeline:

- **Epoch-frozen circular orbit** (`pyre-world.js pyreOrbitPosition(ms)`): 10 M km around the star, period from Kepler
  with Aeon's assumed 120-day year (30.4 d), phase from wall-clock time at page load (`?epoch=` pins it for tests).
  Tidally locked: the surface function is evaluated in the orbital frame (+Z toward the star), so the sub-stellar point,
  the 400 °C day side and the terminator are fixed on the surface. Landing site sits on the dusk terminator.
- **Per-descriptor sampler**: `celestial.js` bodies carry `height(x,y,z)` and `water` flags; `bodyHeight` no longer
  switches on `airless`. Aeon/Selene behaviour is unchanged.
- **Per-body atmosphere**: `atmosphere.js` gains a second atmosphere slot (`bodies[]` uniforms: centre, radius,
  height, Rayleigh/Mie betas, scale heights, g, gain). Slot 0 is Aeon with the exact former constants; Pyre is slot 1.
  Each slot is skipped when the camera is farther than 400 body radii; clouds stay Aeon-only. Distant bodies are painted
  as sun-style discs in the same pass (`pointBodies`), attenuated by the atmosphere like the sun.
- **Worker-streamed second body** (`pyre-terrain.js` + `pyre.worker.js`): the `planet.js` job pattern (pool, transfer,
  distance sort) with the Selene precision form, a landing-column prewarm, `ready` gated on altitude
  (≥ 12 below 2 km), sibling `lastUsed` stamping, horizon cull with `MAX_HEIGHT/R`, and a synchronous fallback for
  node tests.
- **Emissive terrain**: vertex `pyreData` (activity, fresh flow, sulphur) + a 256² cellular crack texture drive an
  emissive lava term (night 3.0, day ×.25) and per-layer roughness; a 1024×512 glow map baked in the worker gives the
  night-side glow from orbit.
