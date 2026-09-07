# Phase 1 landing-gear solver — ready for integration

Prepared by Astra helper, 2026-09-05, at Cees's request to help the other Astra.
Ownership: only `src/landing-gear.js`, `scripts/landing-gear.test.js`, and this
file. Navigation, flight model, rendering, ship geometry, package scripts and
Git/PR integration remain with main Astra. The shared checkout changed from
`feat/visual-fidelity` to `feat/blender-nomad-ship` during this work; the helper
did not switch branches or commit another agent's work.

## Delivered

`evaluateLandingGear(body, struts, raycast, previousState?, options?)` evaluates
one ray per deployed strut and returns world force (N), world torque (N m),
per-strut compression and contact data, load in standard g, events, and the next
contact state. It does not mutate inputs, move the ship, create geometry, or
define a terrain/deck height. No new dependencies.

- Default travel 0.6 m, per-strut stiffness 120 kN/m and damping 18 kN s/m.
- Progressive bump stop beyond travel; animation compression stays within 0–1.
- Angular velocity contributes to individual pad speed and damping torque.
- Surface velocity supports moving decks; side/underside hits do not support gear.
- The damper never pulls a departing pad back onto the ground.
- Per-strut `touchdown` events give closing speed in m/s.
- `hard-landing` reports support load above 6 g (configurable), at most once per
  contact episode. Peak loading can trigger it after initial touchdown.
- World positions remain JS doubles. Lever arms are formed locally before adding
  the world position, avoiding astronomical-coordinate subtraction for torque.

## Integration contract

```js
import { evaluateLandingGear } from './landing-gear.js';

const result = evaluateLandingGear({
  position: shipCentreWorld,       // centre of mass, not pilot eye
  orientation: shipQuaternion,   // normalized
  velocity: shipWorldVelocity,
  angularVelocity: shipLocalAngularVelocity, // same convention as flight-model.js
  mass: 12000,
}, authoredStruts, raycastSupport, previousGearState, { deployed: true });

previousGearState = result.state;
// During the existing fixed physics substep, add result.force / mass to the
// other acceleration, exactly once. Convert result.torque to ship-local axes
// and use the ship's inertia tensor for angular acceleration.
// Drive strut animation from result.contacts[i].compressionRatio.
// Feed result.events into the future damage/audio systems.
```

Each authored strut supplies `{ id, mount: Vector3, restLength }`. `mount` is a
ship-local offset from the centre of mass. Travel/stiffness/damping/bumpStiffness
can be overridden per strut. Rest length must be at least the specified travel.
There are deliberately no production mount coordinates in this solver: the
active walkable ship and optional `ship-mk2.js` have different gear layouts.
Put the chosen rig's dimensions in `boarding.js` and reuse them for geometry.

`raycastSupport(origin, direction, maxDistance, strutId)` returns the closest
supporting hit `{ distance, normal: Vector3, velocity?: Vector3 }` or `null`.
Distance is along the supplied unit direction in metres. The normal is world
space and points out of the surface. Do not mutate query arguments. The callback
must use `world.js` terrain and the actual station deck, respecting openings and
deck edges. `station.deckHeightAt()` supplies a radial height, not a ray distance:
do not pass it directly as `distance` or treat the planar deck as a spherical floor.

## Remaining work and limitations

This is a tested contact-force module, **not a playable suspension delivery**.
Do not mark Phase 1 complete yet.

1. Add the authored rig and correct COM/eye conversion. The current hull collision
   bounds and boarding ramp assume the old static pad plane. Preserve cabin/ramp
   agreement at the settled ride height; account for suspension sag in rest pose
   and animation. In the four-strut test fixture, 12 t at 1 g gives 0.24525 m sag.
2. Add the terrain/deck ray adapter, then integrate force and torque in the fixed
   physics loop. Do not apply the force once per internal flight-model substep
   AND once again per frame. Raycast again after moving the body each substep.
3. Keep the existing swept collision and fallback floor support. Point suspension
   rays alone cannot catch a mount that has already tunnelled below a surface;
   bump-stop forces do not constitute a hard penetration constraint.
4. Gate the assisted velocity servo during suspension settlement so it does not
   cancel the spring response. Preserve deliberate docking/landing controls.
5. Add tire/static friction or parking support separately. There is no tangential
   friction here. Spring forces follow the supplied contact normal; this is an
   approximate normal-contact suspension, not a full articulated strut model.
6. Wire the events to a damage policy; `supportG` is instantaneous contact force
   divided by mass and standard g, not a measured net acceleration or hull HP.
7. Add this test file to `package.json` once integrated and run the full boarding,
   station and touchdown browser journeys with visual evidence.

## Verification

Node v26.7.0: **13 tests passed** with:

```sh
node --test --test-isolation=none scripts/landing-gear.test.js
```

Tests cover airborne/retracted query counts, analytical static sag, damping and
separation, touchdown at exactly full extension, roll damping, moving surfaces,
independent uneven contacts/slopes, bump stops, damage latching/rearming,
rotation and precision at 25 billion metres, immutable inputs, invalid hits,
and an eight-second drop settling correctly at 120 and 240 Hz.

The default isolated `node --test` runner in this sandbox reported only the file
as one passing test, without its individual cases. Using `--test-isolation=none`
executed and reported all 13; the pass count above is from that explicit run.
No shared build output or browser tests were run by this helper, because the
module is not imported by the game yet and main Astra owns those checks.
