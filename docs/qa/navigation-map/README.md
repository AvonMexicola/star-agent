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
| Environment and render counters | [JSON](evidence.json) |

The map hold submits zero additional 3D frames. The previous scene's draw count
and triangle count are retained diagnostic values, not work performed under the
map. The recorded animation-frame interval includes shared CPU/software-renderer
load and is **not a laptop GPU frame-time benchmark**. Browser: Chromium 151,
ANGLE/Vulkan SwiftShader; map DOM at native viewport resolution, background scene
render scale recorded in the JSON. No browser console errors or warnings in the
map capture.

Validation and independent visual-review results are recorded below after the
final checks. The first broad test run was interrupted by terminated preview
servers; later cases failed with `ERR_CONNECTION_REFUSED`, not assertion failures.
Final verification uses a dedicated running preview to avoid sharing the test
server's lifetime with other work.
