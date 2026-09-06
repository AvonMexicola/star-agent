# Energy effects

Branch `feat/particle-effects` is stacked on expedition PR #24 (`beec1b1`).
It adds effects to that playable mining/EVA baseline. The shared controller,
station, equipment and Atlas working directories are unchanged.

## Try it

Run `npm run dev` and open `/effects/` for the interactive range. Four scenes
show the real Nomad asset with afterburners, a mining/collection demonstration,
pulse cannon impacts and high-speed travel. Drag to orbit and scroll to zoom;
the controls offer drive output, afterburner, pause, bloom and reduced motion.
The production build includes the range as a separate Vite entry.

In the game, Shift boosts, J fires alternating ship pulse hardpoints, and the
existing T/mouse/RT mining controls operate the upgraded cutter. Normal flight
speed drives the travel field, including reverse and sideways motion. Controls
H offers bloom and reduced-motion settings and a link to the range. The OS
reduced-motion preference supplies the initial setting.

## Integration contract

- `src/effects/energy-effects.js` owns the visual director. `fire()` accepts a
  muzzle, direction and optional validated hit. `collect()` accepts a committed
  extraction position, its three mineral yields and its surface normal.
- `src/effects/flight-effects.js` adapts navigation poses, speed, boost and J.
  Nomad nozzles match the existing hull at ±2.56, 1.86, 4.08 metres. A new hull
  must supply its own nozzles and hardpoint positions before adoption.
- Mining Equipment still owns heat, muzzle calibration and cut requests. Only
  its original VFX group is hidden by the mining adapter. Its shared module and
  authored assets are unchanged. MineableRock emits `onExtract` only after
  successful save and geometry/collider publication. Field forwards the event
  for both surface and space rocks. Particles never grant inventory rewards.
- Particles use a fixed 2,048-instance quad pool and a maximum of 32 live bolts.
  Positions remain JS doubles until the camera origin is subtracted. A single
  instanced draw batches sparks, fragments, streaks, muzzle flashes and rings.
  Three plasma meshes and one nonshadowed contact light complete the director.
- The bloom pass uses three half-float resolutions (half, quarter, eighth),
  horizontal/vertical filtering and a soft HDR threshold. It adds six small
  fullscreen draws. Atmosphere composites bloom before its existing tone map;
  the sun shader and cloud model are unchanged. Disabling bloom skips its draws.
- Custom geometry shaders include logarithmic-depth chunks. Transparent effects
  test existing depth and preserve target alpha so stars remain visible behind
  energy. Origin jumps, quick transit and focus loss clear active trails.
- Reduced motion removes transit streaks and reduces sustained spark/exhaust
  emission; it retains the beam, contact feedback and collection fragments.

## Scope and limits

Pulse cannons provide visual firing and impacts. This is not a damage, enemy,
combat-balance or weapon-inventory implementation. Keyboard J is the initial
ship weapon input; controller flight trigger bindings remain unchanged.
Ground impacts use the authoritative body-height function; local mining rocks
and station walls use their collision/render geometry. Bolts do not yet query
all distant decorative ring bodies or moving targets. Spark debris is cosmetic
and has no rigid-body collisions. Bloom is sourced from depth-tested scene
radiance before atmosphere composition; it is not volumetric light scattering.

The range's ore collection is a demonstration. The game's ore bursts come from
real successful saved cuts. Range output is not a claim that full interplanetary
route management or a complete combat system is implemented. No hardware FPS
claim is made from software-rendered browser captures.

## Verification

- `npm test` — existing numerical/gameplay suite plus particle precision, pool
  reuse, moving collector arrival, hit/miss timing, origin/transit reset,
  reduced motion and committed/rejected/replayed extraction events.
- `npm run build` — game and range production entries.
- `npm run test:browser -- -c scripts/effects.config.js` — all four range scenes,
  real game mining and saved yields, menu cancellation, J fire and high-speed
  flight; shader/page/console errors checked. Images and renderer metadata go
  to `/tmp/star-agent-effects-evidence`.

Curated captures are in `docs/qa/energy-effects/`. Browser results and limitations
are recorded alongside them. The production range and game checks passed with
zero page/console errors; the numerical suite passed all 191 cases across 27 test files.
