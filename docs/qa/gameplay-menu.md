# Gameplay menu verification — 2026-09-07

Development checkpoint `feat/gameplay-menu`, based on6eda47f. One fixed terminal
frame contains Comms, Map, Contracts, Inventory, Loadout, Ship and Settings. The
Dev tab is included only when the existing development launcher is enabled; it
contains Test starts and Console list. Escape or controller Menu opens the menu.
LB/RB or bracket keys changes tabs; Resume, Escape or B returns to play.

The actual native dialogs retain their transactions, reach checks and input gates.
Switching tabs waits for the previous screen's close cleanup before opening the
next. Long inventory/box, loadout, pilot, fleet, recipe, command and development
lists use focusable page controls. There is no player scrolling in the terminal.
Station comms retains its live roster, hangar requests and account controls. This
change does not introduce a text-chat protocol or pretend offline messages are sent.

## Validation

- Full unit suite:669/669 pass; production build passes with the existing Vite
  large-chunk advisory. Repository checks and suggested check plan inspected.
- Browser controller transaction journey passes: tabs, inventory transfer with
  exact quantity change, stow/re-equip tool, phone equipment paging, Dev location
  paging/selection, Dev console entry, and neutral RT across modal/focus/device
  transitions before a fresh trigger fires again.
- Layout matrix checks actual1440×900 and390×844 screens. It verifies content has
  no horizontal/vertical overflow and visible controls remain inside the panel.
  Includes all eight tabs, Dev consoles, controller diagram, recipes, fleet,
  account and the controller keyboard. Visual inspection additionally checks
  internal panel overlap, which bounding-box assertions alone cannot establish.
- Final combined layout and combat results are recorded below after completion.

## Findings retained

Initial browser startup selected an occupied preview port5401; moved the owned
preview to5491 without stopping the other service. The first fixture used an
unscoped controller-layout locator, which also matched the deliberately hidden
legacy command; scoped it to the open dialog. A later immediate visibility query
ran before asynchronous tab cleanup finished; now waits for the actual Ship panel.

A single-page pager inherited display:flex over its hidden attribute, producing
unnecessary controls. Added a scoped hidden override. Phone map content initially
overlapped the chart and clipped Engage drive: explicit grid rows and removal of
inactive description/drive spacer minima fixed it. Disabled the map's old whole-
dialog entrance animation so tab changes keep the terminal frame stationary.
Desktop recipes needed two cards per page rather than four to retain all actions.

Chromium151 / AMD Radeon860M / ANGLE GLES3.2. Injected standard Gamepad only;
physical-device testing, independent visual acceptance and hardware performance
claims remain separate. No public deployment.
