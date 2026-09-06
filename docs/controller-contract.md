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
| Flight | LB / RB | Roll |
| Flight | Y / X | Land or launch / interact |
| Flight | B / right-stick click | Brake / flight assist |
| Walking | A / X | Jump / interact, including hatch and cargo |
| Walking / EVA | D-pad right | Equip or holster mining tool |
| Walking / EVA | RT | Fire equipped weapon or mining tool |
| Walking / EVA | D-pad left | Cycle weapon 1, weapon 2 and tool |
| Walking / EVA | D-pad up / down | Select next quick slot / use selected item |
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
Keyboard 1/2/3 draws the held slots, 4–7 uses a quick item and K opens Equipment.
On-screen shortcut buttons and inventory actions retain pointer/touch support.

`loadout.spec.js` covers a complete controller-only equipment and Selene journey,
including slot swaps, ammo reassignment, tool mining, both weapons, quick-item
shortcuts, a held RT across inventory closure and return to the backpack.
Medical success uses an injured-save fixture in `loadout-ui.spec.js`; no natural
injury source is claimed. Shared interruption tests continue to cover focus and
device reconnect. Physical Xbox testing remains separate from injected inputs.
