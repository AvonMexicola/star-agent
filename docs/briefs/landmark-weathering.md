# Landmark surface detail

Cees accepts the large rock shapes and requests more texture detail and variation.
Keep the existing geometry, seed distribution, physical overhangs and collision.
Improve the actual Aeon landmark material with metre-scaled coarse fractures,
irregular strata, mineral patches, exposed/sheltered weathering and finer grain.
Surfaces should read at walking distance, roughly 30 m, and in the previous
65 m low-flight view. Avoid an evenly brown surface, repeated horizontal stripes,
white stones, texture swimming and dramatic gloss.

Reuse the locally bundled CC0 Rock030 colour/normal/roughness maps and their shared
loader/disposal. Seeded instance rotation/scale supplies stable surface variation;
never derive it from the camera-relative translation or elapsed time. Keep texture
resolution, geometry/instance budgets, LOD fades and logarithmic depth unchanged.
No generated bitmap, additional download, dependency, gameplay/input hook or
database change is needed.

Base: dev/all-features at 6d3abb04ebee4af5cd8d4b96ec4d440b81774bf5. Isolated branch
art/landmark-weathering in star-agent-rock-weathering. Own landmark-material.js,
focused material capture scripts and this task's QA/docs. Port 5383, one Chromium
worker after the existing shared GPU queue. Preserve the integration steward's
shared merge and preview ownership. Publish a coherent narrow checkpoint for
local integration, with independent visual acceptance labelled separately.

Compare identical game poses before/after, including the accepted escarpment,
bridge, close face, shelter and LOD motion. Check map readiness, console/shader
errors, finite frames, unchanged geometry counts and seed stability. Use the
existing landmark invariants and a production build; the previous complete
controller traversal remains the geometry/input evidence for this material-only
change. No new controls or playable route is introduced.
