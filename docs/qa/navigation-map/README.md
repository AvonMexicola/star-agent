# Navigation map QA

Integration base: `afea150`, `feat/visual-fidelity`. Scope is HANDOFF request 20;
world materials, ships and station assets remain integration-base content.

Before images come from the existing opening preview on port 5178. After images
are captured from the production build in `/tmp/star-agent-map-work`, port 5181.
Both use seed 7291 and the same reproducible clear Aeon–Selene route. These are
actual browser screenshots, not concepts. The projection is orthographic; the
chart is not a rotatable 3D model or a complete galaxy atlas.

| Evidence | File |
| --- | --- |
| Desktop before / after | [Before](before-desktop.png), [After](desktop.png) |
| Phone before / after | [Before](before-phone.png), [Chart](phone-chart.png), [Details](phone-details.png) |
| Active drive held | [Drive](drive-held.png) |
| Off-axis projection and zoom | [Off-axis](off-axis.png), [Zoom](zoom.png) |
| Environment and render counters | [JSON](evidence.json) |

The map hold submits zero additional 3D frames. The previous scene's draw count
and triangle count are retained diagnostic values, not work performed under the
map. The recorded animation-frame interval includes shared CPU/software-renderer
load and is **not a laptop GPU frame-time benchmark**. Browser: Chromium 151,
ANGLE/Vulkan SwiftShader; map DOM at native viewport resolution, background scene
render scale recorded in the JSON. No browser console errors or warnings in the
map capture.

Validation and independent visual-review results are recorded below. The first broad test run was interrupted by terminated preview
servers; later cases failed with `ERR_CONNECTION_REFUSED`, not assertion failures.
Final verification uses a dedicated running preview to avoid sharing the test
server's lifetime with other work.

## Functional results

- 132/132 unit tests pass; production build passes (existing Vite bundle-size notice).
- 10/10 Chromium browser tests pass against the production preview: controller,
  flight/boarding, map, continuous return travel, seed/reload and quick transit.
- Separate physical station-floor/ramp boarding, cockpit map hold/resume and launch
  completed with zero browser errors.
- Six 1440×900 captures at render scale 1: [orbit](tour/orbit.png),
  [coast](tour/coast.png), [forest](tour/forest.png),
  [highlands](tour/highlands.png), [hangar](tour/hangar.png),
  [cockpit](tour/cockpit.png). Surface captures wait for LOD ≥13 and no pending
  terrain work. [Tour state/console evidence](tour/evidence.json).

The unchanged world's existing quality defects are visible in these captures:
coast destination orientation, forest LOD colour differences, bright snow and the
hangar/cockpit finish. These remain request 22 work; this map PR does not certify
world art against the 4.0 threshold. Main-thread/software-renderer contention also
makes the captured HUD FPS unsuitable for laptop GPU comparisons.


## Independent visual review

Opus captured and inspected its own desktop/phone/drive/zoom/off-axis images.
The initial score was 3.83; the revised map scored **4.33/5**, no criterion below
4, with a mergeable verdict. [Initial report](opus-review-initial.md),
[re-review](opus-review.md), [reviewer captures](opus/desktop.png) and
[reviewer evidence](opus/evidence.json). PM functional/integration review remains
separate; no deployment is implied by the visual score.

Final follow-through also settles caption wrapping before drawing marker positions
and trims desktop spacing to keep the chart notes visible. Root rechecked these
layout refinements in the browser. Five map/travel integration tests were rerun
after the visual changes; all pass. Body shading is a chart illustration, not a
terrain preview. Exclusion rings retain true dimensions; their numeric altitude
limits are stated in the note because small rings become subpixel at system scale.
