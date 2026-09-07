# Base-building fixed-viewpoint regression tour

The existing `scripts/integration-tour.mjs` completed with exit 0 against the
isolated production preview on port 5296. All six world images were inspected,
as were its additional desktop and phone map captures. The combined collector
recorded **zero page errors, console errors or console warnings**. No runtime
changes were made for this check and no historical baseline was overwritten.

```sh
INTEGRATION_URL=http://127.0.0.1:5296 \
INTEGRATION_EVIDENCE=/tmp/star-agent-base-tour node scripts/integration-tour.mjs
```

Chromium 151.0.7922.173; ANGLE AMD Radeon 860M Graphics (radeonsi krackan1 ACO),
OpenGL ES 3.2. Launch flags: `--no-sandbox --enable-gpu --ignore-gpu-blocklist
--disable-dev-shm-usage --use-gl=angle --use-angle=gl`. Seed 7291; render scale 1.
World captures are 1600×900, desktop map 1440×900 and phone map 390×844. The tour
ran alone on the GPU, then explicitly released it to the controller journey.

## Actual measurements

| View | Draw calls | Triangles | Median RAF interval |
|---|---:|---:|---:|
| Orbit | 491 | 338,450 | 16.7 ms |
| Coast, 95 m | 530 | 1,167,408 | 16.7 ms |
| Forest, 95 m | 669 | 1,308,846 | 16.7 ms |
| Highlands, 700 m | 326 | 658,836 | 16.7 ms |
| Hangar opening | 614 | 932,546 | 33.4 ms |
| Cockpit, seated | 554 | 799,556 | 33.3 ms |

Counts are the renderer's complete frame counters with automatic reset disabled,
reset once before atmosphere/scene rendering, including shadow and postprocessing
draws. RAF is the median of 45 callbacks and includes display refresh; it is not
GPU execution time. Terrain LOD reported settled with zero morphing, waiting or
merging in every capture. The forest reported 7,436 trees and no pending tiles.

Against QUALITY.md's numerical budgets, orbit exceeds 300 draws, and hangar
exceeds 600 draws and 900,000 triangles. Forest and cockpit scene counts are
within their limits. The budget reference resolution is 1440×900, while these
world views use its prescribed 1600×900 regression resolution. The measured
16.7/33.3–33.4 ms RAF intervals do not establish the 8/12/10 ms frame-time gates;
**no overall performance acceptance is claimed**.

Both map records contain 490 draws / 338,446 triangles and 16.7 ms RAF. Those
scene counters are stale: `src/main.js` returns when the map is open before
resetting renderer counters or drawing the scene. They are not evidence of a
modal rendering-budget failure or a live modal scene-cost measurement.

## Visual comparison and findings

The qualitative references inspected were the orbit/coast/highlands images in
`docs/qa/navigation-map/tour/` and forest/hangar/cockpit images in
`docs/qa/main-integration/`. Their differing viewport widths, HUD states and
capture timing prevent a valid 2% pixel-diff claim. These comparisons do not
attribute every historical difference to this feature branch.

- Orbit retains the cloud-covered globe, atmospheric limb and dark space framing.
  The extra distant body appearance differs from the older navigation-map image.
- Coast retains the broad yellow-green terrain and scattered stones. The fixed
  bearing still looks inland: this image does not satisfy a sea-facing coast
  acceptance view and its low-relief horizon remains visually weak.
- Forest retains the mixed near silhouettes, lighter distant tree representations
  and rolling green terrain seen in the main-integration reference. The strong
  near/distant appearance transition remains visible; still images do not prove
  freedom from LOD popping during movement.
- Highlands retain the major ridge composition. Current snow/rock texturing is
  more detailed than the old faceted navigation-map reference; relief is clear.
- Hangar retains the authored deck, ship, astronaut, amber markings and planet
  backdrop. **A mining-tool viewmodel appears to float ahead of the third-person
  astronaut during the opening**, and the tool panel/hotbar cover the cinematic.
  This differs from the historical main-integration image and was reported to the
  integration owner. Root verified that the missing opening visibility gate also
  exists on production baseline `6f80fc0`; it is an inherited issue, not an
  established construction regression. The visible Build shortcut during opening
  was also reported; root owns its follow-up gate fix. This capture predates that
  fix. The bright deck markings remain an exposure review item.
- Physical keyboard walking, hatch opening and boarding reached the pilot seat.
  Cockpit MFDs, braces and hangar backdrop render coherently; the visible state
  correctly reads LANDED. This is a keyboard boarding check, not controller or
  physical-device acceptance.
- Desktop map labels, selected Selene route and action panel are readable. Phone
  layout fits horizontally and places destination details below the map; its
  lower action area is below the initial viewport. This capture did not exercise
  scrolling or touch activation, so it does not establish their reachability.

## Evidence and limits

[Orbit](tour/orbit.png) · [Coast](tour/coast.png) ·
[Forest](tour/forest.png) · [Highlands](tour/highlands.png) ·
[Hangar](tour/hangar.png) · [Cockpit](tour/cockpit.png) ·
[Raw measurements](/tmp/star-agent-base-tour/record.json).

The extra map images remain at `/tmp/star-agent-base-tour/map-desktop.png` and
`/tmp/star-agent-base-tour/map-phone.png`. Terrain viewpoints use debug transit
and fixed aiming; the opening capture waits until elapsed time is at least ten
seconds, then samples frames, rather than freezing exactly t=10. HUD is hidden
for the four terrain/orbit shots, but reload restores it for hangar/cockpit.
This tour does not place base assets; the separate base-scene and material/core
journeys carry that evidence. It is not an independent Opus rubric review and
provides no review score. Visual acceptance and unresolved budgets remain open.

READY FOR REVIEW: docs/qa/base-building/tour.md, docs/qa/base-building/tour/
