# Navigation map and relativistic targeting

Open **M**, D-pad left in flight, or **Menu → Map**. Click the star for a centred
view of Aeon and Pyre; click a planet for its moon and Aeon Orbital where present.
Breadcrumbs return to the parent. These are relationship charts with explicitly
schematic orbits, not an orbital simulation. The ship's current body/altitude and
all ranges come from real double-precision world positions.

**Locations** lists the selected body's canonical surface destinations, including
coast, forest, highlands, polar regions, Selene's landing region, Pyre's twilight
region and Miasma's named sites. Existing player bases join their parent world's
list. **Signals** lists available filtered navigation contacts. **Filters** controls
worlds, stations, ships, bases, friends/pilots, mission signals and surface sites.
Friends/pilots is the live Comms roster; there is no social friendship protocol.
Empty categories display zero rather than invented content. Filter preferences
persist locally; a selected bearing remains visible even when its category is off.
The HUD bounds the display to the nearest16 signals, prioritizing the selection.

The whole gameplay screen stays inside its viewport. Desktop shows the chart and
browser beside each other. Phone switches between Chart, Locations, Signals and
Filters; longer lists use Previous/Next pages. LB/RB changes gameplay tabs;
D-pad/left stick moves visible controls, A selects, and B resumes. Map browsing
holds flight and scene rendering; closing clears held menu inputs.

## Charge, engage, arrive

Selecting a destination sets a bearing and never launches the ship. Close the map
and aim the ship's nose at the bearing. A world can also be acquired directly by
looking at its visible disk, without a map selection. Foreground worlds occlude
hidden destinations. The nose reticle gains a ring labelled **Powering relativistic
drive**. Hold a clear target for three seconds, then use **N**, **J**, **LB + RB +
D-pad up**, or the on-screen **Engage relativistic drive** button. Charge alone
never engages. Turning off target, opening a dialog, losing focus, changing a
controller or losing the signal invalidates its charge.

The existing analytic travel trajectory accelerates and brakes continuously at up
to0.9c. Signals receive a20km stand-off; body approaches end20km above the canonical
surface on the near side. Surface locations approach along the local vertical.
The star retains its500,000km thermal stand-off. Complete segments are checked
against terrain envelopes, stellar exclusion and station bounds; blocked routes
must be cleared in normal flight. Atmosphere departures require20km altitude and
retracted landing gear. A moving signal is sampled again at engage, then the
arrival position is fixed for that flight. X/LT aborts with controlled braking.
With no aimed or selected destination, N retains the existing free heading drive.

Targeted travel currently runs offline; shared pilots remain trackable, while
server authority and online movement remain unchanged. Navigation does not grant
new inventory, mission completion or combat authority. Patrols still require
physical final approach and fighting. Read the [promise ring field note](lore.md)
for the fictional drive lore.

## Verification

`tests/navigation-targets.test.js` checks canonical arrivals, point stand-off,
continuous samples/abort, blocked hemispheres, line-of-sight acquisition, invalid
signals and charge loss. Existing navigation/travel tests retain legacy trajectory
invariants independently of the new UI adapter.

`npx playwright test -c scripts/navigation-targets.config.js` exercises the actual
map, controller routes, hold safety and flight in one worker. See
[the navigation QA record](qa/navigation-targets.md) for outcomes, environments,
failures and inspection limits. Injected Gamepad testing is separate from a
physical controller or independent acceptance.
