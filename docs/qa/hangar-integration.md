# Hangar stack integration review

PR #20 combines the Nomad cockpit refinement, unlockable Atlas, twenty modular
hangars, central hub, cargo transfer and manufactured service-corner finish with
`feat/visual-fidelity` at `029cae8`. The production candidate preserves the current
playable opening, system travel, water, player menu and controller handoff.

## Integration decisions

- StationComplex shares the opening's direction and tilted orientation across
  pods, rings and hub. Controlled doors and their collision follow the opening.
  The cinematic locks its berth; render transforms use the final camera origin.
- The active ship layout is selected before starting the opening. Saved Atlas
  players spawn ahead of its full hull; its cinematic camera clears the wide
  cockpit. Fleet selection cannot interrupt the cinematic.
- Travel collision uses the fixed complex centre. Physical player position
  selects the nearest berth; the cinematic camera cannot change that selection.
- The structural slab remains below the authored deck. Modular hero and LOD
  station assets are retained. The separate station hull refinement in #22 is
  outside this candidate.

## Verification

- `npm test`: **152 tests passed** at runtime candidate `7a73ecf`, including tilted twenty-pod layout, controlled
  doors, saved Atlas spawn/boarding/lift, fixed travel keep-out centre, structural
  floor and actual GLB aisle/clearance tests.
- Production build passes with the existing bundle-size advisory.
- Initial production browser run: four tests passed. It covers Nomad's complete
  opening, rear hatch/ramp boarding, seat and launch; controller handoff and
  `intro=0`; moving-camera floor checks at scale 1 and .55; and saved Atlas opening,
  camera clearance, fleet guard and map.

- Combined browser coverage: all **17 distinct cases pass** across the initial
  four-case run, the remaining regression run and a focused five-case rerun.
  Coverage includes Atlas unlock/selection, all three lift rides, persistent
  inventory and missing-asset fallback; cargo Take all; physical elevator entry,
  hub/berth-20/parked-ship return; rotating rings; finish rendering and optional
  asset fallbacks; Nomad flight through the doors, docking, physical ramp boarding
  and departure; desktop/390×844 menus, controller handoff and continuous travel
  to Selene and back.
- The remaining twelve-case run initially had **11 passes and one failure**:
  the controller Menu test released its button for a fixed 250 ms, which could
  fall entirely between SwiftShader frames. The fixture now waits for actual
  input polling and rearming. The focused rerun passes all five cases, including
  that controller flow, saved Atlas, desktop/phone menu and the elevator race.
- Review found and fixed a real integration race: Help/orbit shortcuts could
  interrupt an elevator fade after its dialog closed. Both entry points now
  respect the existing navigation pause. The regression starts a transfer,
  dispatches H/O in that fade, verifies arrival and parked-ship preservation,
  then verifies normal Help → High orbit remains available.

The seventeen-case coverage preceded the final exterior visibility correction.
That bounded change was verified with the complete 152-test suite, including
camera/physical-position separation, hidden-station collision and near-hub
restoration, plus the complete production tour below. Unrelated gameplay cases
were not repeated after a render-only visibility change.

## Final production tour

Runtime candidate `7a73ecf`, production asset `index-E60SiKWO.js`, completed
2026-09-06 at 13:05:50 Europe/Amsterdam. Root inspected all eight scene captures.
Chromium **151.0.7922.173**, WebGL 2 / ANGLE Vulkan **SwiftShader**, seed 7291,
1600×900, device scale 1, render scale 1. There were **zero console/page errors,
warnings, failed requests or unexpected browser lifecycle events**.

Each world view uses a fresh browser process and context. Opening, cockpit and
two interior views share a fifth fresh session. Workers were drained, visible
terrain LOD and patch counts settled before each capture. These are controlled
camera views; physical boarding and continuous travel are covered separately.

| Inspected view | Draws | Triangles | Visible terrain LOD |
|---|---:|---:|---:|
| [Orbit](hangar-integration/01-orbit.png) | 477 | 304,642 | 3 |
| [Coast, 95 m](hangar-integration/02-coast.png) | 422 | 489,185 | 16 |
| [Forest, 95 m](hangar-integration/03-forest.png) | 525 | 1,359,235 | 16 |
| [Highlands, 700 m](hangar-integration/04-highlands.png) | 261 | 237,842 | 14 |
| [Opening, exactly t=10](hangar-integration/05-hangar-t10.png) | 422 | 653,379 | 6 |
| [Seated cockpit](hangar-integration/06-cockpit.png) | 439 | 641,612 | 6 |
| [Service corner](hangar-integration/07-corner.png) | 360 | 523,976 | 6 |
| [Operations gallery](hangar-integration/08-gallery.png) | 344 | 516,064 | 6 |

The coast view stays at the fixed destination but faces the sea using the
authoritative terrain sampler. Its heading differs from the earlier baseline;
water is distant and the near ground remains broad and flat. Forest LOD colour
bands and highland faceting remain visible baseline art limitations. The opening
uses `intro=1`; other world views use `intro=0`. The cockpit is a seated fixture.
These captures are manually inspected review evidence, not a claim of a completed
pixel-matched baseline comparison. The existing baselines were not replaced.

[Desktop menu](hangar-integration/09-menu-desktop.png) and
[390×844 phone menu](hangar-integration/10-menu-phone.png) come from the successful
focused browser rerun. They retain the current player interface with Fleet/lift
help and collapsed quick transit.

At the prescribed **1440×900**, the affected view measurements were:

| View | Draws | Triangles | Mean observed RAF interval, software renderer |
|---|---:|---:|---:|
| Opening hangar | 412 | 645,481 | 725.0 ms |
| Cockpit | 435 | 637,740 | 756.2 ms |
| Service corner | 357 | 523,940 | 687.5 ms |
| Gallery | 344 | 516,064 | 579.1 ms |

Counts include shadow passes and fit the 600-draw / 900,000-triangle hangar budget.
Each timing sample is eight RAF intervals; these software-renderer observations
do **not** establish the 10 ms laptop-GPU budget. Hardware validation remains open.

The first tour stopped after three views when its browser closed; its cause is
unknown and that run is not a completed pass. It also exposed 93 extra orbital
draws / 22,116 triangles from the always-visible station exterior. Matching the
existing 600 km camera cutoff removes exactly that delta. Final orbit counts
match the recorded base (477 / 304,642); the inherited 300-draw orbit budget breach
remains. Full reports and failed-run evidence stay in `/tmp`.

## Review status

Independent Opus visual review has not run. The attempted reviewer invocation
returned HTTP 429 with a session reset at 13:50 Europe/Amsterdam on 2026-09-06.
`QUALITY.md` requires its rubric to pass, or an explicit Cees “polish later”
decision, before merge. No review score or hardware performance approval is
claimed by these functional checks.

The operations gallery remains decorative architecture with static graphics.
Distant block storage, ceiling/wall construction, bright navigation signs and
hub furniture remain follow-up art work. This candidate does not add multiplayer
networking; twenty pods are the reusable station layout.
