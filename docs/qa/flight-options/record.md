# Heading drive, ship utilities, held equipment and meadow options

Candidate: `feat/flight-options`, based on integration `6f80fc0`. Isolated worktree
`/tmp/star-agent-flight-options`; preview http://localhost:5290. Production remains
on the previously deployed integration while this candidate is verified.

The player can spool a free heading with N, disengage with N or X, retract gear
with G, and toggle contextual lights with L. Landing/launch moves to B, Fleet to U;
controller Y remains landing/launch. Selected map routes still use J. Graphics
settings persist grass range/density and render resolution locally.

Manual travel reserves its forward ray against world envelopes, the station and
star. It analytically accelerates up to 0.9c after a three-second spool, then
brakes continuously when disengaged. A blocked ray gets a finite stop before the
obstruction. Low airless departures additionally validate the full departure
segment against canonical lunar terrain; unsafe or budget-limited sweeps reject
entry. The minimum local clearance is 100 m. The manual heading stays locked
until disengagement.

The existing four landing assemblies on each ship are retained from Blender and
exported as named moving nodes. Animation retracts the telescoping geometry over
1.8 seconds. Navigation deliberately keeps its conservative deployed collision
envelope; retracting does not permit squeezing the hull into smaller gaps. Landing
assist deploys automatically. This does not activate the separate suspension
physics prototype. Both ship builders remain reproducible with `--runtime-only`;
the checked-in older .blend files are historical snapshots, not updated source.

One Equipment instance changes between the first-person socket and the character's
calibrated hand socket, preserving ammo, heat and firing authority. A final wrist
correction aligns the barrel to the aim ray, with a two-joint support-arm solve.
Cabin/menu inactivity holsters the item and clears the aiming pose.

The original 10 m interactive meadow stays detailed. An intermediate InstancedMesh
uses five tapered triangle blades per tuft out to28m, overlapping the near blades
at6–10m. A distant InstancedMesh uses three crossed, procedurally masked cards per
cluster, overlapping the intermediate blades at20–28m. Placement
uses the shared deterministic spherical grid and canonical terrain; local doubles
are subtracted before instance floats. Enumeration, sampling and matrix preparation
share a2ms frame budget (0.8ms intermediate /1.2ms distant, each capped at512
candidates). Each previous mesh remains until its replacement is ready, with
10m intermediate and20m distant preload margins. Root-to-tip color gradients and
lighting agree across the layers; canonical-world wind phase survives rebasing. Range defaults to80m, density75%;
40/80/160m and50/75/100% are user-selectable. Far grass is a cheaper representation,
not the detailed mesh replicated to the horizon. The current lower presets change
the intermediate/distant layers; the original near blade density is retained.

## Proceedings

- First source tests:461 passed, build passed. Independent review found a110m
  lunar tangent ray could cross a crater rim; reproduced and fixed with the
  canonical terrain sweep. Added that exact regression fixture.
- Initial distant enumeration allocated/sorted the whole field synchronously.
  Independent CPU harness measured23/50ms at80/160m. Budgeting enumeration and
  matrix preparation reduced first-frame work to1.65–2.36ms (max observed4.54ms).
  These are CPU harness measurements, not hardware FPS claims.
- Initial visual fixture left the ship lamp on an unaccompanied walker. Fixed
  visibility to require the pilot context or an actual parked ship position.
- Distant vertical card normals made the grass nearly black. Upward rounded
  lighting removes the orientation-dependent dark cards.
- Initial hand attachment kept an upward barrel pose. The wrist correction and
  support-hand solve now keep the firing direction and visible weapon together.
- Initial screenshot input raced a gameplay frame and still selected the cutter.
  Browser assertions now wait for actual rifle selection and light visibility.

## Verification and acceptance

Functional and visual review are separate. Final regression counts, independent
visual report, performance context and delivery status are recorded below when
complete. Current browser evidence lives in `/tmp/star-agent-flight-options-evidence`.
Controlled orbital/meadow inspection is labelled separately from actual injected
controller gameplay journeys. No physical controller was used.

Inherited world, station and full-project visual/performance defects from PR34
remain outside this batch; this record does not certify them as fixed.

## Recorded checks

- Final unit pass after the station targeting correction: `npm test`, **467/467**.
- New feature browser suite: **2/2**, production build, Chromium151.0.7922.173,
  AMD Radeon860M hardware ANGLE/OpenGL ES3.2, viewport1440×900, captured render
  scale0.8. Includes persisted settings reload, actual weapon selection, both
  Nomad gear endpoints, free-heading spool/disengagement, controller-only input
  route and held ascent across modal closure. No console/page errors.
- GLB geometry tests reconstruct both assets, verify four gear assemblies, y=0
  contact when extended, retraction within the old horizontal envelope, and exact
  return to the landing plane. Utility-light origin rebasing and no unaccompanied
  ship lamp are covered. A skeleton test verifies barrel alignment, stationary
  firing wrist and reachable support grip.
- Independent first visual review: **3.67/5, changes required**. Retained in
  `first-review.md`; its own captures were1600×900 and390×844. Required matching
  fine/distant grass lighting and correcting the cockpit's old L landing label.
  Near grass now uses the same upward diffuse response with a retained geometric
  contribution, and the MFD shows B (controller Y) for landing.

The expanded physical controller journey exposed an inherited station weapon bug:
`createWeaponTarget` read `Station.group`, but the game now uses StationComplex
with multiple roots. Actual rifle shots raised `undefined.layers` errors. Targeting
now traverses the visible complex roots, excludes hidden geometry, and applies
instance transforms to hit normals. Its large-origin/hidden-root regression passed.
The affected controller journey then passed including physical departure; the
other three opening/startup journeys had already passed on this candidate.

Keyboard/controller reproduction: `npm run test:browser -- -c
scripts/flight-options-boarding.config.js`; the corrected affected case was rerun
with `--grep 'controller hangar reveal'` (1/1). Feature suite remains2/2. The
controller rifle-fire screenshot uses1440×900 at render scale0.55 for that journey;
it establishes the real action and route, not high-resolution art quality.

Representative screenshots: [desktop settings](graphics-desktop.png),
[phone settings](graphics-phone.png), [160m meadow](meadow-160m.png),
[held rifle](character-rifle.png), [controller firing](controller-rifle-fire.png).
See the independent reports for full-scale art captures and exact viewpoint metadata.


## Grass transition follow-through

The second independent review of89ce649 scored **3.83/5, changes required**;
[second-review.md](second-review.md) retains the exact report. Matching diffuse
lighting alone left crossed clusters visibly different from fine grass inside
walking distance. The follow-up adds the intermediate blade layer described
above, moves the card overlap to20–28m, and matches root-to-tip color. Stable
world-derived wind phases prevent a visible phase reset when a field is rebased.
The production build and affected browser fixture passed again (**1/1**) with
both intermediate and distant fields populated and completely published. No
console/page errors were recorded. This rerun follows the earlier full2/2 feature
suite; unaffected controller behavior was not gratuitously rerun for grass geometry.
The third independent review of32782e5 also scored **3.83/5**; its exact report is
retained in [third-review.md](third-review.md). It confirmed the inner improvement
but found the outer20–28m card overlap still sparse and olive. The next correction
preserves filtered alpha coverage instead of discarding mipmapped blades at a hard
threshold, uses32 individually shaded blades in the shared128px mask, and pads
transparent RGB to prevent black color bleeding during minification. Per-instance
stochastic coverage lets overlapping far clusters contribute independently.

The first coverage variant passed the affected browser check1/1. A subsequent
intermediate variant was terminated with exit143 before producing a result; it is
not recorded as a test pass. The final combined source passed its production build and affected browser
fixture again (**1/1**, zero page/console errors); independent visual review is
next. Log: `/tmp/star-agent-flight-options-stochastic-browser.log`. No extra scene meshes or triangles
were added by the mask correction.
