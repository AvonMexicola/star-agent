# Focused location arrows — 9 September 2026

HUD location markers now show the selected POI, the next step of each active
contract and spawned player vehicles. Map destinations and saved signal filters
remain available. Optional recovery loot does not become an automatic objective.
The existing ship bearing remains visible while driving a rover; deployed Burrow
and owned, unoccupied Sentry vehicles have live bearings.

Validation: 17 focused source test files pass, including navigation/objective
transitions, marker projection, transport/recovery, rover/Sentry, rotation and
input coverage. `VITE_DEV_TOOLS=1 npm run build` passes with the existing chunk
size advisory. Repository and whitespace checks pass.

`npm run test:browser -- -c scripts/focused-location-arrows.config.js` passes both
cases in 3.5 minutes on Chromium151, AMD Radeon860M ANGLE OpenGL ES3.2, one worker.
The complete injected-controller marker journey covers patrol acceptance,
selection/replacement/clearing, filter changes, cancellation and return to play;
the reload check starts with all saved categories enabled. Desktop1440×900 and
phone390×844 captures were inspected. Keyboard vehicle checks verify the ship
bearing while driving, a physical Burrow exit and both parked vehicle markers.
Both cases report zero application page/console errors. No physical controller,
independent acceptance, full cargo delivery replay or performance claim.

The first browser run passed the initial marker assertions but timed out after
15seconds while reloading at "Preparing Aeon". The fixture now uses the existing
90second scene-loading allowance; no runtime change was needed. Original evidence
remains at `/tmp/star-agent-focused-arrows-run-01`; successful originals and videos
are at `/tmp/star-agent-focused-arrows`. An initial before-capture attempt found
the usual local preview stopped (connection refused); its normal development
entry point was started with its existing persistent local database.

Curated captures: [startup before](startup-before.png), [startup after](startup-after.png),
[phone POI and objective](phone-objective-and-poi.png),
[parked Burrow and ship](parked-burrow-and-ship.png).
The [browser receipt](navigation.json) records the actual renderer and input.

No new dependency, input binding, inventory mutation, schema or protocol change.
Local integration and preview availability are recorded in the shared HANDOFF;
this task does not include a public deployment.

Runtime `b99658b` is fast-forwarded into local `dev/all-features`. The existing
530,509-byte unrelated HANDOFF journal was preserved byte for byte. Before
integration the unselected startup rendered 12 location markers; the checked
new startup renders none. The default local preview is running again on5178
with API8087 and its existing persistent PostgreSQL database.
