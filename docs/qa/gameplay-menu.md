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
- Final menu and combat regression results are recorded below.

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

## Final menu evidence

Both menu cases pass in1.7m: the expanded no-scroll matrix (41.6s) and complete
controller inventory/loadout/Dev transaction and input-safety route (57.4s).
Escape opening/closing also passes. No page or console errors.

- [Desktop contracts](gameplay-menu/desktop-contracts.png)
- [Desktop inventory](gameplay-menu/desktop-inventory.png)
- [Desktop map](gameplay-menu/desktop-map.png)
- [Phone loadout](gameplay-menu/phone-loadout.png)
- [Phone map](gameplay-menu/phone-map.png)
- [Dev console list](gameplay-menu/phone-dev-consoles.png)
- [Controller text entry on phone](gameplay-menu/phone-keyboard.png)

Reproduction: `VITE_DEV_TOOLS=1 npm run build`, then
`npm run test:browser -- -c scripts/gameplay-menu.config.js`. The standalone
preview uses5491. Set MENU_TMPDIR, MENU_RESULTS and MENU_EVIDENCE to writable home
cache paths when the machine's per-user temporary-directory quota is exhausted.


## Combined integration and combat

Merged the concurrent persistent-account development head d1db78d into this lane
at dc570a3. The merge leaves the tested client UI unchanged and preserves the
PostgreSQL/Prisma runner, data location and existing account handoff. Combined
669/669 unit checks, repository checks and production build pass.

Both full controller patrols pass through the new tabs: Nomad1.1m and Kestrel1.0m,
including contract acceptance, continuous flight, target/weapon selection, kills
and combat report. The old pointer fixture still looked for the now-replaced Close
patrol button; changed it to the real Resume control. Keyboard/pointer combat,
NPC-caused loss, recovery and phone controls then pass1.9m; the additional controller
diagram regression passes53.8s. Six browser cases pass across these focused runs.

A prior diagram regression failed on seven external fonts.gstatic.com requests
with ERR_ADDRESS_UNREACHABLE. The request URLs were recorded; they are the existing
Google Fonts dependency. The last diagram rerun has zero page/console errors. The
keyboard rerun retained external-font request failures in its log, with no page
errors; gameplay and recovery passed using fallback fonts. The retained menu
layout matrix/captures were produced by the zero-diagnostic menu run. This is not
a claim that the external font service is always reachable.
