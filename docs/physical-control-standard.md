# Physical button and projected action standard

Version 1, 2026-09-06. Implemented first in the Atlas Mark II inspection studio.
This is a reusable interaction contract for ship and station controls.

Every usable physical control supplies a descriptor:

```js
{
  id: 'elevator:crew',
  target: 'Crew lift',
  anchor: [5.5, 3.73, -5.39],
  action: 'Go up',
  enabled: true,
  reason: '',
}
```

The action describes what pressing the button will do. Use a short verb phrase,
not “Interact,” “Toggle” or a component name. The target identifies the mechanism
on a separate line. Disabled controls state the reason; a moving mechanism must
never offer the same action again as if it were idle.

| Mechanism state | Label | Available |
|---|---|---|
| Rider on lift, lower deck | Go up | Yes |
| Rider on lift, upper deck | Go down | Yes |
| Lift elsewhere | Call lift | Yes |
| Lift already at this landing | Enter lift | No; walk aboard |
| Lift securing gates / moving | Securing gates / Lift moving | No |
| Closed ramp / hangar | Open ramp / Open hangar | Yes |
| Open ramp / hangar | Close ramp / Close hangar | Yes |
| Actuator moving / obstructed | Opening… / Closing… / Clear… | No |
| Empty pilot seat / seated pilot | Sit in pilot seat / Stand up | Yes |

`controlAction(kind, state)` in `src/projected-action-label.js` owns these common
verbs. A mechanism adapter owns reach, state, safety interlocks and the physical
anchor. It must read the same authoritative state that operates the mechanism.
Unknown state combinations fail explicitly.

The floating label is anchored just above the physical button face, with a leader
to its position. Show one reachable control at a time. Hide the projected label
behind opaque structure, behind the camera or outside the view. Projection follows
the camera each frame; opaque-geometry checks run at most 10 Hz. Transparent
glazing does not hide labels. Keep a conventional action prompt available when
the selected control is outside the view, and retain the physical control itself.

The descriptor's anchor and camera must share render-local coordinates. In the
planetary game, subtract the double-precision camera origin before building the
render-local anchor. Never upload a planet-scale position to a float matrix merely
to place a label. A moving button's anchor must follow its owning mechanism.

Keyboard uses **F**, Xbox uses **A**, and touch uses a tappable label or **TAP**
action button. Switching input updates the displayed binding. Click/tap, keyboard
and controller all invoke the same operation; that operation rechecks the current
control ID, reach and enabled state before acting. UI text is assigned with
`textContent`. The label is a native button with its action and target as its
accessible name, and a disabled state when unavailable.

## Current consumers and integration boundary

`src/atlas-mark-ii-controls.js` implements the descriptor adapter for both loading
ramps, both crew-lift landings, the moving platform control and the pilot seat.
The studio installs the projected widget and imports the shared `projected-action-label.css` stylesheet.
MFDs and the label both read the actual lift/ramp state.

The hangar verb/state contract is implemented and unit-tested. Station hangar
controls are not changed in this branch. Their owner can adopt the same widget
by supplying the actual hangar-door state, a render-local button anchor and the
existing guarded door operation. Do not infer hangar functionality from the label
example or add a cosmetic “Open hangar” command without the mechanism behind it.
