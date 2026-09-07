# Navigation targets QA

Feature: SA-NAV-001 / feat/navigation-targets. Builder inspection; independent
acceptance and a physical controller are not claimed. Target preview5493 is
separate from shared preview5178 and its persistent API/database. No database
schema, account data or production deployment changes.

## Implemented checkpoint

3dfd963 implements the hierarchical map, paged filters/locations, real navigation
signals, nose-lock charge, continuous20km approaches and the promise-ring lore.
38e5bfe reconciles it with fitted weapons through shared931ea10; the package test
list conflict was resolved by retaining both owners' suites. RT fire and server
authority are preserved. Further inspection refinements are recorded below.

The map is an explicitly labelled relationship chart, not an orbital simulation.
Friends/pilots is the live Comms roster, not a social friend protocol. Targeted
travel is solo-only; shared signals remain trackable. Stellar approaches retain
500,000km photosphere clearance. Routes to obscured locations require manual
repositioning. Moving contacts are sampled at engage; arrival then stays fixed.

## Checks performed

- Initial navigation model + inherited suite:675/675 units; after reconciling
  fitted weapons,692/692. A subsequent targeted suite includes12 passing checks
  for canonical arrivals, deep-crater approaches, clear/blocked routes, analytic
  flight and abort, disk acquisition, charge invalidation and HUD arrow bounds.
- Repository checker and production builds pass. The existing Vite chunk-size
  advisory remains; no runtime dependency was added.
- Native Chromium151 / AMD Radeon860M ANGLE GLES3.2, single Playwright worker,
  1440×900 and390×844. All successful cases below recorded zero page/console and
  failed-request errors. Injected standard Gamepad; no hardware controller.
- First matrix pass39.4s: star/planet/moon hierarchy, station relationships, all
  views at both viewport sizes, filter persistence, unchanged pose and held
  rendered-frame count. Visible controls fit their content rectangle and content
  has no horizontal/vertical overflow.
- Controller travel pass1.1m: map entry/drill/selection, premature engage rejection,
  nose charging, Menu/focus/disconnect/replacement invalidation, drive shortcut,
  LT abort, clear target, unselected moon acquisition, continuous movement,
  automatic20km arrival, normal thrust and braking afterward. Pose was read for
  right-stick steering; it was not assigned or teleported during the journey.
- Keyboard/pointer pass1.0m: Kestrel steering via arrow keys acquires Aeon without
  map selection; on-screen drive control engages, brakes at20km and returns to
  the responsive map.

Commands: `npm test`, `npm run check:repo`, `npm run plan:checks -- --base
origin/dev/all-features`, `VITE_DEV_TOOLS=1 npm run build`, and `NAV_EVIDENCE=...
NAV_RESULTS=... npx playwright test -c scripts/navigation-targets.config.js`.
Logs/raw captures are in the task cache outside Git. A focused final recheck and
curated captures are pending for the refinements below.

## Failures, corrections and limits

The first layout fixture matched both a dialog state attribute and its view
button. It was scoped to `button[data-map-view]`; the matrix then passed. The
controller signal fixture completed selection/filter/neutral-input actions but
expected an arrow while the nose was on the patrol. That target was correctly
represented by the reticle instead. The recheck asserts that label, then steers
away to verify the directional marker, and also pages phone surface locations.

Inspection found edge labels overlapping cockpit readouts. Navigation now passes
custom safe bounds to the existing projection helper, suppresses the redundant
flight-state label behind the ring, and supplies the real target to the cockpit
MFD. The existing recovery beacon keeps its original bounds. NPC raiders also
join the Ships filter while an engagement exists.

A sampled radial approach to a deep Selene crater was incorrectly rejected by
its global highest-peak envelope. Body approaches follow a single radial to the
canonical surface +20km, so that destination body no longer applies the unrelated
highest-peak test. All intervening bodies/stations still validate the full segment;
non-radial surface-site routes keep their conservative terrain bounds.

The immediate20km lunar arrival capture showed streaming terrain before its
higher detail settled. The final visual fixture waits for streamed lunar LOD12
and additional rendered frames. Flight/arrival assertions use actual completed
travel, independent of that visual wait. No renderer performance acceptance is
claimed from these functional tests.

Retained CI/dev-launcher and older stellar/Pyre inspection fixtures were adapted
to hierarchy/charge and new approach clearance. Their long art tours were not
rerun for this checkpoint; previous art acceptance does not certify the new
near-surface travel views. Full visual/regression evidence is limited to the
cases explicitly listed here.
