# Controller is a feature requirement

Cargo tractor: Menu → Trade → Cargo equips the handheld beam. Hold RT to lock and
guide a crate; sticks retain move/aim, D-pad up/down changes hold distance, left
aligns to the nearby ship and right holsters. X secures a compatible nearby grid.
These D-pad actions consume the existing equipment/quick-item shortcuts only in
tractor mode. Menus and focus/device loss stop the beam and retain the shared
neutral-input gate. See [tractor controls](cargo-tractor.md).

Every playable feature must work with a standard controller from entry through exit.
A trigger value in a unit test is insufficient: players must be able to discover the
action, equip its tool, reach its target, activate it, inspect the result and return
to play without a mouse or keyboard. Xbox labels refer to the browser's W3C standard
mapping, not operating-system Bluetooth status.

HUD display: **Menu → Settings → HUD** cycles Everything, Markers and reticle,
then No HUD. The menu remains reachable in every mode; B resumes play. Tab does
the same during keyboard gameplay and retains normal focus navigation in dialogs.
On touch screens, a two-finger tap on the view restores Everything.

## Shared bindings

| Context | Binding | Action |
| --- | --- | --- |
| Everywhere in gameplay | Menu | Gameplay menu: Comms, Map, Contracts, Inventory, Loadout, Ship, Settings |
| Everywhere in gameplay | View | Backpack |
| Dialog | D-pad / left stick | Move visible focus between available controls |
| Dialog | A / B | Activate / close and return |
| Dialog | Right stick | Scroll |
| Flight / walking | Left / right stick | Move / aim |
| Flight | A / B | Rise / descend |
| Flight | RT / R2 | Fire selected ship weapon (pulse / solar lance / singularity) |
| Flight | LB / RB | Roll |
| Flight | Y / X | Land or launch / interact |
| Flight | LT / right-stick click | Brake / flight assist |
| Walking | A / X | Jump / interact, including hatch and cargo |
| Walking / EVA | D-pad right | Equip or holster mining tool |
| Walking / EVA | RT | Fire equipped weapon or mining tool |
| Walking / EVA | D-pad left | Cycle weapon 1, weapon 2 and tool |
| Walking / EVA | D-pad up / down | Select next quick slot / use selected item |

| Walking / EVA | D-pad right | Equip or holster held tool |
| Walking / EVA | RT | Fire equipped cutter, carbine or sidearm |
| EVA | A / B | Rise / descend |
| EVA | LT | Brake |
| EVA | LB / RB | Roll |

EVA bindings require the navigation EVA integration. New bindings must be agreed
across tools, navigation and interface owners before implementation; never assign
RT simultaneously to EVA translation and mining. Existing keyboard and touch
routes remain available.

## Integration

`GamepadInput.poll({focused, enabled, ui})` has separate gameplay and modal results.
Set `ui` when a native dialog is open. `ui` contains axes and button edges; gameplay
fields are zero while it is active. On connection, focus recovery and context
changes the player must release all controls before input arms. A held RT cannot
resume firing as a dialog closes. Device replacement and unsupported mappings
must give a useful status while leaving keyboard input usable.

Call `nav.onControllerInput?.(pad, dt)` immediately after polling, before navigation's
modal early return. Install `createControllerUI` from `src/controller-ui.js` and
route this callback to its `update`. Remove legacy Menu/Scroll/HUD handlers from
that update path to avoid double dispatch. Root main supplies:

```js
const controllerUI = createControllerUI({
  nav,
  destinations: [{ id: 'moon', label: 'Selene', activate: () => transit('moon') }],
  openBackpack: () => nav.openBackpack?.(),
  toggleTool: () => miningTool.toggleSelected(),
});
nav.onControllerInput = (pad, dt) => controllerUI.update(pad, dt);
```

A feature dialog must use semantic buttons with names, real disabled state (or
`aria-disabled="true"`), a visible close action and normal `close` cleanup. Mark the
preferred first action `data-controller-focus`. Give rerendered controls stable
`data-controller-key` values so focus survives transfers and slot updates. Never
bind functionality only to pointer hover, dragging, pointer lock or key events.
Controller activation invokes the same real click action used by other inputs.
For text entry or other controls requiring richer editing, provide an explicit
controller-compatible route and tests; generic focus alone does not implement
text entry. Do not claim arbitrary text-entry support from this router.

## Required evidence before feature completion

- Document bindings and contextual controller hints; show visible focus in every UI.
- Exercise the whole gameplay journey using injected standard Gamepad input. Do
  not call movement, orientation, interaction or mining methods to skip the path.
  Reading debug state for assertions or steering feedback is fine and must be stated.
- Assert the real gameplay result and inventory change, not just the input value.
- Test neutral arming, held actions across modal open/close, focus loss, disconnect,
  device replacement and unsupported mappings. No stale action may replay.
- Include controller navigation of the result UI and return to play; verify
  disabled controls are skipped and focus survives item-list rerenders.
- Run keyboard/touch regressions for shared input changes. Inspect a screenshot
  while the visual action is occurring; a screenshot after releasing the laser
  cannot prove its beam is visible.
- State whether an actual physical controller was used. Browser injection verifies
  application routing, not Bluetooth pairing, firmware, OS drivers or real devices.

## Current validation

`node --test --test-isolation=none tests/gamepad.test.js`: 8 numerical tests pass.
`npm run test:browser -- -c scripts/controller.config.js`: 1 browser integration
fixture passes, exercising destination selection, equip, backpack focus/transfer
and held-trigger suppression without pointer or keyboard. This fixture uses the
real router and GamepadInput but stub gameplay callbacks; it is not evidence of
walking or carving in the real game.

`scripts/controller-gameplay.spec.js` supplies the production-game acceptance
journey and saves a screenshot with RT held, collected contents and diagnostics.
Run `npm run test:browser -- -c scripts/controller-gameplay.config.js` after main,
mining tool and navigation integration. Do not count this journey as passed until
its actual run completes. No physical-controller validation was available during
this implementation.

## Equipment loadout

Menu → Equipment opens the shared inventory dialog on its Equipment tab. View
opens Storage; choose the Equipment tab with D-pad and A. Slot, draw, stow,
assignment and medical-use buttons all use the native dialog focus router.
RT spends a compatible ammo-slot charge through the Equipment fire gate before
a weapon pulse is emitted; the mining tool uses its heat budget instead.

In walking/EVA, D-pad left cycles held slots; right selects or holsters the tool.
Up selects the next quick slot and down uses it. These are edge actions, not
held repeat actions. Flight still uses up/down for speed and RT/LT for translation.
Slot changes explicitly suspend gameplay until controls return to neutral.
Keyboard 1/2/3 draws the held slots, 5–8 uses a quick item (4 changes camera) and K opens Equipment.
On-screen shortcut buttons and inventory actions retain pointer/touch support.

`loadout.spec.js` covers a complete controller-only equipment and Selene journey,
including slot swaps, ammo reassignment, tool mining, both weapons, quick-item
shortcuts, a held RT across inventory closure and return to the backpack.
Medical success uses an injured-save fixture in `loadout-ui.spec.js`; no natural
injury source is claimed. Shared interruption tests continue to cover focus and
device reconnect. Physical Xbox testing remains separate from injected inputs.

## Energy arsenal follow-up (PR #27)

Command menu actions equip each handheld tool outside the cabin and select each
ship weapon in flight. Disabled actions are skipped by the shared focus router.
The effects/input adapter owns A firing only in flight, where A had no existing
action; navigation retains A jump/EVA rise. RT retains flight ascent and fires
the equipped tool only on foot or in EVA. No raw second Gamepad poll is used.
Equipment/weapon changes suspend shared input until neutral, as do menu closes.
The new route is `scripts/controller-effects.spec.js`: controller-only ship
selection/fire, physical lunar landing/exit/approach, both gun selections and
impacts, cutter mining, cargo UI and return. It also covers held RT across focus,
disconnect, replacement and unsupported mapping. Debug state is read only for
steering and assertions; no physical controller testing is claimed.

## Heading drive, utilities and graphics

Menu → “Heading drive” starts along the current ship heading;
B brakes out of either travel mode. Aim along the horizon or away from the nearest
world. Entry needs 20 km altitude or no atmosphere, plus a safe terrain/station
path. M / the map retains selected-destination travel with J.

Menu offers landing gear, contextual lights, camera view and Graphics. Graphics
uses buttons that cycle grass distance (40/80/160 m), density (50/75/100%) and render
resolution (automatic/60/80/100%); D-pad/A therefore reaches every value. Closing
it uses the shared neutral-input gate. Keyboard G controls gear in flight and EVA
outside the ship, L controls ship floodlights or the suit flashlight, B lands or
launches, and U opens Fleet. Controller Y still lands/launches. Keyboard/mouse
players can reach the command menu through H → Ship systems / Graphics after the
launcher is dismissed.

`scripts/flight-options.spec.js` includes a controller-only orbital start, stick
alignment, drive spool/brake, gear/lights, graphics changes and held ascent across
modal closure. `scripts/opening.spec.js` extends the physical controller boarding
journey with third-person rifle selection/fire, flashlight and cabin holstering.
These use injected standard Gamepad input; physical device testing is separate.


## Direct utility shortcuts

Hold **LB + RB** (PlayStation **L1 + R1**), then press:

| Button | Action |
|---|---|
|D-pad ↑|Spool / disengage free-heading relativistic drive|
|D-pad ↓|Deploy / retract landing gear|
|D-pad ←|Toggle ship lights / on-foot flashlight|
|D-pad →|Toggle cockpit/external or first/third-person camera|
|Menu / Options|Open Graphics settings|

Hold the modifier to see this legend on the gameplay HUD. These invoke the same
command-menu actions and eligibility checks; the drive/gear shortcuts require
the appropriate pilot state. Each press toggles once. Plain LB/RB still roll,
plain D-pad retains map/equipment/throttle/quick items, and plain Menu/View retain
command menu/backpack. Release both shoulders to leave the shortcut layer.
Consumed D-pad holds remain suppressed until that D-pad button releases, avoiding
accidental throttle or equipment activation after releasing the modifier first.

After focus, dialog, disconnect or device replacement, release all controls before
shortcuts rearm. The Graphics chord is suppressed while unarmed rather than
opening the ordinary command menu. Standard Menu remains available in paused help.
The controller-only orbital and physical opening/boarding journeys in
`flight-options.spec.js` and `opening.spec.js` now use these direct shortcuts.

## Multiplayer account entry

On the dedicated multiplayer build, the account dialog opens after loading.
While the station intro is paused, D-pad/left stick and A/B use the normal dialog
router. Menu reopens the account screen during the cinematic; after taking
control, Menu → Pilot account retains the gameplay route. Continue offline closes
the screen without joining or requiring an account. Held movement through dialog
closure must be released before it can take control of the cinematic.

`scripts/multiplayer.spec.js` starts at the bare URL with the intro enabled. It
checks controller switching to Create account, B close with a held movement stick,
Menu reopen, Continue offline, and physical movement into play. The two-pilot
journey also starts there before registration, Join, COMMS and physical docking.
Registration text is still entered with desktop controls; a full controller
keyboard registration and physical-device testing remain separate checks.

## Construction

B enters the shared piece palette while walking outside within 64 m of an owned
mainframe. Menu → Build also establishes a new site on a planet. Point the left
stick at a radial slice and press A; B reopens the wheel
while building. D-pad also browses pieces and the recipes/supplies tabs. Releasing
the stick retains its highlight; B closes without choosing. A choice never places
a piece until a fresh A press after controls return to neutral.
The contextual controls consume the existing shared Gamepad poll:

| Construction action | Controller | Keyboard / touch |
| --- | --- | --- |
| Enter | B near owned mainframe; Menu → Build anywhere buildable | B or visible Build button |
| Place one piece | A edge | Enter or Place button |
| Next snap target | LB edge | T or Snap button |
| Rotate / flip wall facing | LT / RT edges | Q / E or rotate buttons |
| Foundation height / upper level | D-pad up / down | Up / Down or height buttons |
| Piece wheel | B; left stick points, A chooses | P or Pieces button; pointer / Tab + Enter |
| Exit construction | X | Escape or Exit button |
| Move / look / jump | Sticks / RB | WASD / look / Space |
| Backpack / command menu | View / Menu | Existing inventory and menu routes |

Ordinary pieces rotate in quarter turns. Walls flip facing by 180° on their
selected supporting edge; LB changes the edge. Foundation height uses 0.25m
steps. Non-foundation height selection uses storeys where supported by the
piece's placement rules.

Construction suppresses mining/fire, EVA/boarding shortcuts and quick-item
shortcuts. Its own hints replace the equipment bar and ordinary tool hints.
Dialog transitions use neutral arming, so held A cannot replay placement after
the palette or backpack closes. Construction does not take over EVA controls.

Menu → Field recipes and the palette's Recipes tab use the same native dialog
router. Batch presets, disabled ingredient/capacity failures, actual processing
actions and stable focus keys work without text entry. A nearby physical mainframe
opens its owner overview, explicit supply-buffer toggle and real storage dialog.
The storage handoff keeps gameplay paused until storage closes.

See [construction controller evidence](qa/base-building/controller.md) for the
distinction between the dialog fixture and actual physical gameplay validation.

## Offline space patrols

Menu → Patrol console accepts the two-contact patrol, abandons it, files the combat
report, and offers recovery after loss. The same console is available from the
physical hangar cargo terminal. Fly to its world beacon using normal flight.
A retains ship fire, Menu → Ship weapon chooses the energy array, and Menu → Next
hostile cycles tracking. RT/LT remain ascent/descent. After combat loss, A invokes
explicit recovery; it cannot replay the held firing input through the loss gate.

`scripts/space-combat.spec.js` exercises actual Nomad and Kestrel patrols using
injected standard Gamepads, read-only steering feedback and the real combat model.
It includes input interruption gates, both kills, the report and return to flight.
The separate close-up/keyboard fixture uses controlled poses for visual inspection;
that is not controller-only journey evidence. Physical-device validation is separate.


## Controller layout and trigger revision — 2026-09-07

Supersedes earlier A-fire / RT-ascent descriptions in this historical record.
RT / R2 fires ship weapons; A/B provides vertical thrust; LT brakes and cancels
drive. EVA and on-foot fire remain RT; A still confirms dialogs and recovers
a destroyed ship. Menu → Settings → Controller layout or Help → View controller layout
opens a responsive diagram with Flight, On foot, EVA and Shortcuts & menus views.
The shared dialog router and neutral-input gate apply to the entire route.


## Fixed gameplay terminal — 2026-09-07

Menu / Options and Escape open the last gameplay tab. LB/RB or bracket keys
changes tabs; D-pad/LS moves visible focus; A confirms; B/Escape/Resume closes.
Inventory, loadout, recipes, fleet and development lists use explicit pages.
Page arrows remain focusable at boundaries and do not perform out-of-range actions.
Tab switches await native close cleanup and require neutral input again.
Dev → Console list opens the actual console; Dev is present only with the enabled
development launcher. Settings includes graphics, sound and the controller diagram.

Navigation targeting: Map uses the common fixed gameplay screen. D-pad left opens
it in flight; D-pad/left stick selects, A confirms and B resumes. LB/RB changes
outer gameplay tabs. Point the nose at a visible body or enabled beacon to charge
the reticle ring, then LB+RB + D-pad up engages the relativistic drive. LT aborts.
Charge does not fire the drive automatically; modal/focus/controller changes clear
it. RT remains weapon fire. Keyboard N/J and the on-screen engage button share the
same charged-target command. With no target, the shortcut retains free heading.


The radial uses optional `dialog.controllerNavigation(ui)` in the shared router.
It returns a native focus target; confirm/back and device/focus neutral arming
remain owned by the existing router and GamepadInput. `ui.stickX/stickY` carry
analog direction without D-pad contributions. Keep eight slice locations stable.
See `docs/qa/base-building/radial.md` for verification and remaining review limits.

Current B/A/trigger mappings and context checks: [hotkey evidence](qa/base-building/controller-hotkeys.md).

## Combat momentum — 2026-09-07

Flight defaults to fly-by-wire with finite thrust and drift correction. R3 / V
selects unlocked flight; releasing thrust coasts while the ship turns independently.
Hold LT / L2 (keyboard X) for maximum braking, allowing stopping distance.
Menu → Ship → Combat / cruise (keyboard Z) selects the speed regime independently:
Kestrel 220, Nomad 180, Atlas 120 m/s. RT fires only in combat mode, within its
speed limit, with boost off and landing gear retracted. Cruise locks weapons.
Landing assist requires speed below 10 m/s. All hulls retain momentum; Atlas
has the slowest correction. Injected Gamepad evidence is documented separately
from physical controller testing.


## Expanded construction menus

LB/RB changes the active native build tab (Blocks/Shapes/Facilities/Power/Roofs/Resources/
Sandbox supplies/Mainframe when available). Tab changes consume the shared UI
edge before analog focus or A confirmation and suspend until neutral. The hooks
are `dialog.controllerAction(ui)` for tab changes and `controllerNavigation(ui)`
for the wheel; neither polls Gamepad independently. B enter uses the actual saved
claim radius,64m normally or96m after placing a large pad. X outside build mode
operates rack/terminal/hangar/pad-designation interactions through the same shared
native inventory/dialog flow. See `qa/base-building/expansion.md` for evidence.


## Base power and solo server saves

Power is a native bumper-accessible build tab. Solar/wind/battery/fuel generators
use the existing placement controls. Mainframe and machine X/F opens actual
charge/load/health/fuel status; fuel loading, repair and server connection are
native focusable buttons. Async actions suppress duplicate submission and require
neutral input after completion. Mining fuel byproducts appear in the same backpack
and mainframe inventory as other materials. Server connection binds the authenticated
account; switching accounts must stop background uploads. Never put solo base
snapshots into authoritative multiplayer inventory. See `qa/base-power/README.md`
for the actual controller journey and separate database/hardware testing limits.

Removal mode: B opens the build wheel; select Remove tool, aim within12 m, and
A removes one permitted piece. RT/LT cannot fire or rotate while removing; X exits,
B returns to selection, RB jumps. Enter/touch Remove share the same action. Held A
must not delete the piece behind a removed target. The mode shows target outline,
blocked reason and no-refund disclosure. Empty storage and structural dependencies
are validated before mutation and repeated on the solo server command.


Ceiling lights and outer roof tiles use the same placement journey. Select Roofs
with LB/RB, choose a tile with stick/A, then aim at a supported structural ceiling
and press A to place. LT/RT rotate square edge/corner tiles; matching triangle
and quarter-circle tiles inherit the supporting ceiling rotation. Lights appear
in Power and Roofs, mount underneath ceilings, and use aimed X/F to switch after
leaving build mode. Held X must toggle only once; a saved off switch remains off
after reload. See [ceiling and roof record](base-ceilings-roofs.md).

## Personal transport contracts

Menu → Contracts → Transport contracts opens the shared trade dialog's Freight
view. D-pad selects a route and A accepts; B returns to flight. At the actual
pickup terminal, X opens the exchange and Freight → Order my crate issues the
owner's sealed cargo. Equip its tractor action, hold RT to guide, use D-pad
up/down for beam distance and X to secure at a valid cargo-grid slot. At the
destination terminal, Freight → Deposit crate consumes that original crate and
shows the payment and completed-delivery count. B closes the result so the pilot
can walk back, board and launch. These actions use the existing dialog/input
router and preserve neutral-input suppression across modal, native focus and
controller connection changes. See the [player guide](transport-missions.md)
and [recorded journey and hardware limits](qa/transport-missions/README.md).
