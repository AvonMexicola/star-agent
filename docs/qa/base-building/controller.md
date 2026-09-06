# Construction controls and validation

Date: 2026-09-07. Physical-controller testing has not been performed.

## Implemented interface

Build is reachable through the command menu on foot outside the ship, keyboard B,
or the visible touch/pointer shortcut. The palette lists the eight implemented
pieces with their actual material costs. Placement, rotation, snapping and height
adjustments all call the same BuildSystem methods from controller, keyboard and
touch. Ordinary parts rotate 90°; walls flip 180° on their selected edge.

Recipes show their pack ingredients/output, 1/10/Max batch presets and the exact
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

The final full-kit production journey **passed**: one Playwright test, 10.7 minutes,
Chrome 151.0.7922.173, native ANGLE GL on AMD Radeon 860M, 1440×900, no browser
page errors. It used an injected standard Gamepad and physically selected Selene,
landed, left through the hatch, moved 3m onto the checked flat shelf, and placed all
eight piece types (nine pieces including two foundations). Four real round trips
to ship cargo supplied construction materials. The controller rotated the stairs
180°, climbed them, opened/closed the doorway, walked into the room, deposited and
withdrew the final metal stock through the crate, enabled the mainframe buffer and
filled it, then climbed onto the supported upper floor at local
`[4.000008, 5.05, 4.019188]`. Opening Equipment before mainframe supplies verified
that supplies explicitly restore the Cargo view. Backpack return and full claim
and container-content equality after reload passed.

The accepted build predates the subsequent backpack-capacity, mining-skill and
Deposit-all changes. Its explicit fixture used the then-current 24kg mineral pouch,
22kg of construction materials in the pack and 62kg on the ship. It neither mined
nor granted additional resources during play. Physical Xbox hardware and a
fly-away-and-return route remain untested.

Failure history is retained in the evidence directory. Earlier runs exposed a
real spherical-terrain foundation contact precision issue, fixed with a consistent
1mm tolerance and regression. A subsequent three-piece run completed climbing and
reload but failed a strict negative-zero comparison, corrected to compare JSON
save representations. Full-kit attempts then rejected an uneven bay correctly,
blocked a stair-side crossing correctly, and exposed a 2.8mm terrain depression at
the mirrored stair foot. No collision rule was relaxed for these terrain/path
failures. The accepted route physically backs up 3m before claiming; 21 canonical
samples and actual Navigation preflight verified the flat footprint. Evolving
3/4/7/9-piece preflights caught a later wall crossing and verified the final
west-of-core cargo bypass in both directions. These failed attempts are not passes.

Earlier software-renderer runs used short timed strafe pulses that were not
reliably sampled at approximately 1 frame/sec. The test now waits for measured
movement, and native ANGLE GL substantially reduces runtime. This does not change
game movement or placement rules.

Evidence is saved under `/tmp/star-agent-build-gameplay/`, including placement
captures, automatic failure state and trace. A passing run writes `journey.json`
with the actual browser, renderer, viewport, resulting claims and browser errors.

`BUILD_FULL_KIT=1 npm run test:browser -- -c scripts/build-gameplay.config.js`
reproduces the accepted full-kit route. `full-kit-run.log` retains raw production
build/test output; `full-kit-journey.json` records browser/GPU/fixture, placed pieces
and errors. `upper-floor-controller.png`, `crate-controller-transfer.png` and
`mainframe-controller-buffer.png` show actual game interactions. The upper-floor
capture was inspected and visibly shows the landing and staircase rails.

The final focused UI revision on the current 16kg-stack runtime passed all four
tests together in 10.7 seconds: controller/touch fixtures now contain
the real `#fleet-button` and `#keyboard-hints` elements, both hidden while building
so they cannot overlap the phone Height controls. Body labels show names (Aeon),
and Max uses ingredient and output-slot validation: a full eight-slot pack can
process its entire 4kg basalt stack when doing so frees the required output slot.
The full-slot fixture uses eight distinct carried types, so its 4kg basalt stack
still occupies one slot with the new stack size; processing it entirely frees the
needed output slot. Cinematic entry is suppressed,
and the hidden HUD no longer reads the deep-cloned build-state snapshot each frame.
Phone screenshots were inspected; broader art/presentation findings remain in the
independent Opus review and are not cleared by these functional checks.

## Deposit-all and current-capacity follow-up

After the capacity/skill update, `npm run test:browser -- -c
scripts/deposit-gameplay.config.js` passed **4/4 cases in 3.7 minutes** on a fresh
153-module production build (3.31s, `main-acpY2RmM.js`). Each case starts in the real
ship and presses X to stand in its physical cabin. An explicit pre-load fixture
supplies 11kg of mixed basalt, copper, ice and concrete, plus carried ammo, a
bandage and rations. It does not inject a pose, invoke storage methods directly,
or grant anything during play.

The cases enter ship Cargo and activate **Deposit all resources** with an injected
standard controller, native keyboard, and actual CDP touch events at 390×844.
All resources move aboard, while carried supplies, equipped gear, XP and cut
revision stay unchanged. A fourth case fills the ship's current 192kg resource
capacity before load; Deposit-all fails with visible feedback and leaves both
containers unchanged. Every case closes/reopens the backpack and verifies saved
container/loadout/progression equality after a page reload. No page errors occurred.

Committed captures: [desktop](deposit-desktop.png), [phone](deposit-phone.png),
and [full-ship rollback](deposit-full-ship.png).

Evidence: `/tmp/star-agent-deposit-gameplay/` contains per-case before/after
screenshots and JSON snapshots. `touch-before.png` was inspected: the Deposit-all
button and Mining level bar are visible above the inventory at phone width, with
no document overflow. `controller-after.png` visibly retains ammo/bandage/rations
in the pack and shows the materials aboard. These tests verify that transfers do
not award XP; actual mining awards are covered by the separate materials check.

The full-kit cargo helper now adapts to 16kg stacks: it uses Transfer one whenever
a whole stack would exceed the exact requested amount. Offline real MiningStore
transfer/debit arithmetic passes with the unchanged finite fixture and leaves
exactly 1kg metal for the crate/buffer interactions. The historical 10.7-minute
full-kit browser pass remains evidence for the earlier compiled 4kg-stack build;
it was not rerun solely for this test-helper adaptation.
