# Energy effects

Branch `feat/particle-effects` is stacked on expedition PR #24 (`beec1b1`).
It adds effects to that playable mining/EVA baseline. The shared controller,
station, equipment and Atlas working directories are unchanged.

PR #24 is also integrating the initial particle director independently. When
combining the branches, keep one director and bloom pass and preserve its newer
regional deposit extraction forwarding alongside this arsenal adapter.

## Try it

Run `npm run dev` and open `/effects/` for the interactive range. Four scenes
show the real Nomad asset with afterburners, a mining/collection demonstration,
three weapon families and a surrounding slipstream energy field. Weapon
configuration adds cobalt, crimson, solar, viridian and violet emission colors. Drag to orbit and scroll to zoom;
the controls offer drive output, afterburner, pause, bloom and reduced motion.
The production build includes the range as a separate Vite entry.

In the game, Shift boosts; 1/2/3 selects cobalt pulse, solar lance or singularity
while flying; J or controller A fires. On foot or in EVA, 1/2/3 equips the solar
carbine, crimson sidearm or mining cutter. T, captured mouse, the hold button or
controller RT fires the equipped item. Command menu actions select every weapon
and ground tool with controller focus; D-pad right holsters the current item. Normal flight
speed drives the travel field, including reverse and sideways motion. Controls
H offers bloom and reduced-motion settings and a link to the range. The OS
reduced-motion preference supplies the initial setting.

## Integration contract

- `src/effects/energy-effects.js` owns the visual director. `fire()` accepts a
  muzzle, direction, weapon profile, optional emission color and validated hit.
  Solar lances resolve immediately; pulse and singularity projectiles impact on
  arrival. Singularity cores have orbital filaments and expanding shock rings.
  `collect()` accepts a committed
  extraction position, its three mineral yields and its surface normal.
- `src/effects/flight-effects.js` adapts navigation poses, speed, boost and J.
  Ship A firing uses the same armed Gamepad result as navigation.
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
  The original engine/mining meshes and contact light remain. Solar lances use
  a separate six-slot core/shell pool. Slipstream adds one local tubular mesh
  with braided filaments, wave packets and diffuse cyan-violet emission.
- The bloom pass uses three half-float resolutions (half, quarter, eighth),
  horizontal/vertical filtering and a soft HDR threshold. It adds six small
  fullscreen draws. Atmosphere composites bloom before its existing tone map;
  the sun shader and cloud model are unchanged. Disabling bloom skips its draws.
- Custom geometry shaders include logarithmic-depth chunks. Transparent effects
  test existing depth and preserve target alpha so stars remain visible behind
  energy. Origin jumps, quick transit and focus loss clear active trails.
- Reduced motion removes transit streaks and reduces sustained spark/exhaust
  emission, and disables the slipstream field; it retains the beam, contact feedback and collection fragments.

## Scope and limits

All weapons provide visual firing and impacts. This is not a damage, enemy,
combat-balance or weapon-inventory implementation. Ground gun impacts do not excavate rock or grant minerals.
Ship firing is J/A; controller flight triggers still ascend and descend.
Ground impacts use the authoritative body-height function; local mining rocks
and station walls use their collision/render geometry. Bolts do not yet query
all distant decorative ring bodies or moving targets. Field weapons reuse the
same query from both the eye and the calibrated muzzle, including fine near-ground
checks. Pending older equipment loads are detached if another tool was selected. Spark debris is cosmetic
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
are recorded alongside them. The original production range and game checks passed
with zero page/console errors. The updated numerical suite passes all 194 cases
across 27 test files.

## Arsenal / slipstream follow-up

`npm run test:browser -- -c scripts/effects-v2.config.js` exercises the rebuilt
slipstream, reduced motion, three weapon types and alternate color, mobile controls,
keyboard repeat/selection guards and touch firing. The controller acceptance
case starts in orbit and uses only injected standard Gamepad input to select
and fire a ship weapon, transit, land, leave the cabin physically, approach a
deposit, equip/fire both ground guns, switch to the cutter, mine, inspect cargo
and return to play. Debug state is read only for steering and assertions.
Gun hits preserve the mining revision and inventory. Held controller actions
are checked across menu selection, focus loss, disconnect, device replacement
and unsupported mappings. No physical controller or hardware FPS claim.

Follow-up captures: `docs/qa/energy-effects/v2/`.
