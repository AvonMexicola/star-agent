# Navigation targets QA

Feature: SA-NAV-001 / feat/navigation-targets. Builder inspection; independent
acceptance and a physical controller are not claimed. Target preview5493 is
separate from shared preview5178 and its persistent API/database. No database
schema, account data or production deployment changes.

## Implemented checkpoint

3dfd963 implements the hierarchical map, paged filters/locations, real navigation
signals, nose-lock charge, continuous20km approaches and the promise-ring lore.
38e5bfe reconciles it with fitted weapons through shared4d38827 (including runtime931ea10); the package test
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
Logs/raw captures are in the task cache outside Git. The final combined map/keyboard passes and focused controller recheck are
recorded below, with curated captures in the adjacent directory.

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
higher detail settled. The final visual fixture waits for the lunar queue to settle at the expected20km LOD7
and additional rendered frames. Flight/arrival assertions use actual completed
travel, independent of that visual wait. No renderer performance acceptance is
claimed from these functional tests.

Retained CI/dev-launcher and older stellar/Pyre inspection fixtures were adapted
to hierarchy/charge and new approach clearance. Their long art tours were not
rerun for this checkpoint; previous art acceptance does not certify the new
near-surface travel views. Full visual/regression evidence is limited to the
cases explicitly listed here.

## Verified final checkpoint

Navigation was reconciled with landmark f0077f6 in bc91a94, preserving both the
new rendering/collision hooks and navigation diagnostics; package test lists and
the shared state getter were merged explicitly. The full combined suite passes
702/702 tests. Thirteen multiplayer UI/client checks also pass, including proof
that legacy online N/J wrappers cannot bypass targeted-drive availability. The
latest production build and repository checker pass.

Four actual browser journeys pass across focused runs: the final map matrix
(48.4s), keyboard/pointer travel, controller surface/mission filters with phone
pagination (1.1m), and controller travel/abort/direct acquisition (1.1m). The
last two pass together in2.2m after the fixes below. Every final result JSON has
zero page/console errors and zero failed requests. Browser jobs are released;
no further navigation GPU job is planned. Physical-device and independent visual
acceptance remain unclaimed.

The slower combined run exposed a real controller gate issue: neutralizing the
controller at engage could delay LT until the short route had reached cooldown.
Neutralization now happens at targeted arrival/abort completion, so active
travel always accepts braking while held inputs cannot carry into normal flight.
The fixture now observes actual acceleration, injects LT through the Gamepad,
and requires an observed abort before clearing the map target and reacquiring
the moon. It no longer relies on automation round-trip speed to brake early.

Final visual inspection also found duplicate patrol beacons. The navigation HUD
owns that signal now; combat retains enemy/lead cues. Existing ship-recovery and
combat ship markers are reused rather than duplicated by navigation. The focused
signal recheck verifies a visible navigation arrow and hidden duplicate waypoint.

The lunar queue reached its expected LOD7 with no pending work before the final
arrival capture. The20km lunar view remains visibly coarse with the existing
terrain representation; this is retained honestly in the capture, not certified
as a new terrain-art result.

Curated views:

- [Centred star](navigation-targets/1440-star.png) and [Aeon, its satellites and surface sites](navigation-targets/1440-surface-locations.png).
- [Phone planet view](navigation-targets/390-aeon.png), [paged surface sites](navigation-targets/390-surface-locations.png), and [filters](navigation-targets/phone-filters.png).
- [Direct-sight moon lock](navigation-targets/direct-sight-ready.png), [20km arrival](navigation-targets/moon-arrival.png), [single patrol bearing](navigation-targets/mission-arrow.png), and [Kestrel reticle](navigation-targets/kestrel-ready.png).

## Local integration record

The final combined source includes construction audio 3a7775a, preserving its
placement hook. All 705 unit tests pass (26.4s); the production build passes
with the existing chunk-size advisory. Navigation source 894b660 was fast-forwarded
into local dev/all-features and its targeting/map modules were retrieved from
http://127.0.0.1:5178/ successfully. No service or database restart was needed.
The audio merge introduced no navigation runtime change after the browser checks
above. This is local integration, not a production release.
