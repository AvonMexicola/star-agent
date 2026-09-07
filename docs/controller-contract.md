# Controller is a feature requirement

Every playable feature must work with a standard controller from entry through exit.
A trigger value in a unit test is insufficient: players must be able to discover the
action, equip its tool, reach its target, activate it, inspect the result and return
to play without a mouse or keyboard. Xbox labels refer to the browser's W3C standard
mapping, not operating-system Bluetooth status.

## Shared bindings

| Context | Binding | Action |
| --- | --- | --- |
| Everywhere in gameplay | Menu | Command menu: destinations, backpack, tool, help |
| Everywhere in gameplay | View | Backpack |
| Dialog | D-pad / left stick | Move visible focus between available controls |
| Dialog | A / B | Activate / close and return |
| Dialog | Right stick | Scroll |
| Flight / walking | Left / right stick | Move / aim |
| Flight | RT / LT | Rise / descend |
| Flight | A / ✕ | Fire selected ship weapon (pulse / solar lance / singularity) |
| Flight | LB / RB | Roll |
| Flight | Y / X | Land or launch / interact |
| Flight | B / right-stick click | Brake / flight assist |
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
