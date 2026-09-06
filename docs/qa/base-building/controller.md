# Construction controls and validation

Date: 2026-09-06. Physical-controller testing has not been performed.

## Implemented interface

Build is reachable through the command menu on foot outside the ship, keyboard B,
or the visible touch/pointer shortcut. The palette lists the eight implemented
pieces with their actual material costs. Placement, rotation, snapping and height
adjustments all call the same BuildSystem methods from controller, keyboard and
touch. Ordinary parts rotate 90°; walls flip 180° on their selected edge.

Recipes show their pack ingredients/output, 1/10/100 batch presets and the exact
transaction validation, including output capacity. Mainframe controls show local
ownership, claim radius, piece count, nonempty supply contents and the explicit
construction-buffer toggle. Opening supplies uses the real inventory dialog.
No research, grid-power, environmental protection or multiplayer UI is claimed.

## Completed focused checks

- `node --test --test-isolation=none tests/build-input.test.js`: 3 passed.
  Covers single-edge placement, conflicting-action consumption, preserved movement
  and jump, cancel precedence, modal/focus/disconnect held-input suppression.
- `npm run test:browser -- -c scripts/build-ui.config.js`: 4 passed.
  Uses actual shared GamepadInput, controller dialog router, MiningStore and field
  recipe transactions. Placement itself is stubbed in this focused UI fixture.
  Verifies controller focus through recipe rerenders, ingredient/capacity disabled
  actions, held-trigger behavior, keyboard entry, an actual touch Place action,
  and the mainframe-to-storage pause handoff. Storage opens from a one-shot
  close handler after navigation restoration, respecting the real inventory guard. A valid full eight-slot pack rejects
  a mass-conserving recipe that would need a ninth output slot without spending
  its ingredients.
- Desktop 1440×900 and phone 390×844 recipe screenshots inspected in
  `/tmp/star-agent-build-ui/recipes-desktop.png` and `recipes-phone.png`. No horizontal
  document overflow; visible controller focus and touch targets remain available.
  `placement-phone.png` verifies the compact placement HUD stays below the centre
  aim point while retaining all 44px touch actions and contextual bindings.

## Physical gameplay journey

`npm run test:browser -- -c scripts/build-gameplay.config.js` runs the production
game on native ANGLE GL at 1440×900. It injects a standard Gamepad and reads debug
state only for assertions/steering. It does not invoke movement, teleport,
orientation, inventory-transfer or placement methods to skip the route.

The finite phase-1 save fixture grants 22kg of processed backpack materials and
54kg of ship materials before game load, respecting the real 24kg pack capacity
and cargo stack rules. This tests imported construction supplies, not the complete
local mining economy. The separate materials journey owns that evidence.

The latest completed run physically selected Selene through the menu, landed,
walked through the hatch, placed a mainframe and foundation, returned aboard for
stair materials through the real controller inventory, returned to the site and
placed the staircase. An initial 1m approach tolerance allowed lateral drift past
the 2m-wide stair. Corrected controller steering now keeps a 12cm centreline
tolerance and exposed a real foundation-entry precision issue: spherical terrain
put the feet 24 micrometres below the site's tangent plane, so the 0.3m foundation
exceeded the 0.3m step limit by more than the solver's 10-micrometre tolerance.
The player stopped at local `[4, 1.74997555, 2.281564]` directly in front of the
stair. A numerical reproduction confirmed the collision rejection. A consistent
1mm contact tolerance and regression now fix it. The next actual controller run
climbed to `[3.999619, 5.05, -1.717270]`, opened the backpack and reloaded; only its
final strict comparison rejected JSON's normal conversion from negative zero to
zero. The expected snapshot now uses the save's JSON representation. A fresh green
runner result is pending; the complete planned phase is not yet claimed.

Earlier software-renderer runs used short timed strafe pulses that were not
reliably sampled at approximately 1 frame/sec. The test now waits for measured
movement, and native ANGLE GL substantially reduces runtime. This does not change
game movement or placement rules.

Evidence is saved under `/tmp/star-agent-build-gameplay/`, including placement
captures, automatic failure state and trace. A passing run writes `journey.json`
with the actual browser, renderer, viewport, resulting claims and browser errors.

`BUILD_FULL_KIT=1 npm run test:browser -- -c scripts/build-gameplay.config.js` adds
three physical cargo trips and builds all eight piece types across two foundations.
Its finite fixture contains 22kg in the pack and 62kg on the ship. It operates the
door, transfers materials into/out of the crate and into the enabled mainframe
buffer, traverses the supported upper floor and checks saved contents. This
extension initially reached the second bay and correctly rejected its uneven
terrain (canonical samples reached 0.77m below the requested deck). Nine samples
on the opposite bay all fit the 0.30m foundation height. A mirrored route exposed
a 2.8mm terrain depression at the stair entry; the normal step limit correctly
rejected it. The prepared route physically backs up 3m before claiming, keeping
the entire footprint on the flat landing shelf. Its 21 canonical samples and
actual Navigation simulation pass all door, perimeter, core, stair and upper-floor
segments (`route-check.mjs` and `route-check.log` in the evidence directory).
The full controller runner has not yet passed. It still does not test
a physical fly-away-and-return route.
