# Mineral-concrete kit production record

2026-09-06, isolated `feat/base-building`, base `6f80fc0`. Original scripted
construction, no third-party asset or generated-image source. This is the first
bounded eight-piece construction kit, not completion of the wider base plan.

The walking-distance target is board-cast mineral concrete with visible casting
ties, restrained steel edging, tread nosings and manufactured manual hardware.
The mainframe uses white armour, dark polymer and mint status graphics. Those
static lines identify the panel; live storage and claim state belong to the
interaction UI. The crate has a gasket, latches, carry handle and protected corners.

The initial export, counts and captures below are historical. The current
September 7 polish adds vertex-colour concrete variation, structural armour and
mint fixtures, fuller rails and layered stair service details. See
[polish production](polish-production.md) for current in-game evidence and review.
Current kit totals **21,228 triangles / 1,869,528 encoded GLB bytes**; each piece
remains below 10,000 triangles and 1 MB, with the same two shared 256² WebP maps.
Twelve geometry checks include authored colour preservation and noncoplanar trim
layers. Current manifests, not the original studio totals, identify the export.
Use `env ALSOFT_DRIVERS=null` before the Blender command if headless audio shutdown
hangs; the final export completed with that authoring-only setting.

## Source and contract

Rebuild with:

```sh
blender --background --factory-startup --python-exit-code 1 --python blender/build_base.py
node --test tests/build-geometry.test.js
```

The builder reads canonical solids from `src/build/definitions.js` through Node.
Blender and ImageMagick are authoring dependencies, not runtime dependencies.
The script writes eight GLBs, two shared 256² WebP maps and the measured manifest.
The manifest records actual bounds, material batches, triangles, encoded bytes and
SHA-256 per GLB. The maps use metre-scaled planar UVs with a 2 m repeat. Albedo
contains board colour variation; independent procedural bump represents fine
casting texture. Colour is sRGB and bump stays linear. Shared runtime loading
avoids copying a texture into every GLB, and failed loads reject placement visuals
instead of certifying a primitive substitute as finished.

All pieces use game metres, Y up, origin on their support surface. Foundation
extends down 0.6 m, floor down 0.18 m. Walls are 4 m wide × 3 m high × 0.3 m thick.
Stairs are 2 m wide, 4 m long and rise 3 m toward local -Z in twelve 0.25 m steps.
The doorway aperture is 1.5 m × 2.25 m. Named `DoorPanel` contains `DoorLeafLeft` and `DoorLeafRight`; the two
0.74 m leaves translate 0.8 m in opposite directions into their jamb pockets.
Their independent clone transforms and colliders follow the same open fraction.
The complete sweep stays within X=±1.54 m, leaving both module corners free. Mainframe and crate origins are their feet;
the front faces local -Z.

Structural collision follows canonical solids. Small bevels and trim have a
20 mm support tolerance; the top-of-stair handrails extend to about 3.98 m and
have narrow non-supporting collision segments following the sloped handrails and
posts. A sideways walking regression verifies the rails stop the standing capsule.
Complete placement envelopes include the rail height and door travel reservation. Walls with openings have
separate structural boxes and glass is blocking. Door collision remains present
at its translated position. Walking uses substeps, cylinder-to-box checks, axis
sliding and support reachable from prior feet; overhead floors do not teleport a
character upward. Planetary support remains navigation's responsibility.

## Validation and actual review

Nine geometry checks pass: manifest versus loaded GLB counts and budgets; full
capsule clearance through the moving door; long-frame wall crossing; ascent and
descent of all twelve steps without jumping plus overhead-floor isolation; actual
GLTFLoader ray intersections compared with authored floor/stair support and the
moving door opening; sideways stair fall protection; rotated full door-travel
reservation; and complete claim-envelope containment of measured GLB bounds; and explicit
perpendicular/inline neighboring-wall clearance around both pocket sweeps. Node's configured reporter counts the test file as one unit.

The real Three renderer inspection page is `/dev/build.html` on Vite. Reproduce
captures with `node scripts/capture-base-kit.mjs` while serving port 5295.
The raw public dev page uses source imports and is an authoring tool, not a
production feature route. Capture environment: Chromium, AMD Radeon 860M through
ANGLE GL, 1440×900, ACES, logarithmic depth, shared runtime asset factory. The final
kit view after the pocket-door correction renders **47 draws / 20,690 triangles**, including repeated kit pieces,
a ground plane and the 1.80 m reference. This is a count observation, not a
frame-time benchmark or a production gameplay acceptance claim.

- [Kit contact sheet](kit-desktop.png)
- [Manual doorway](doorway-desktop.png)
- [Mainframe close view](mainframe-desktop.png)

First browser launch failed inside the sandbox at Chromium crashpad socket
permissions; the authorized host run completed. First capture had one favicon
404, a poor back-facing core camera and a black inspection floor. The page now
provides an inline icon, shows the control face and uses a lit neutral floor.
The rerun completed with zero console errors/page errors. The capture browser
closed after the three images. These images were inspected by the author.

Independent Opus rubric, complete controller construction journey, integration
capture and production performance remain integration gates. No visual rubric
pass, merge or deployment is inferred from the asset checks. The first kit omits
triangles, half walls, foundation height adjustment, ramps, locks, separate glass
fitting, pressure sealing and habitat protection.

## Door enclosure correction

The first single-leaf design reserved travel beyond the 4 m module, preventing
normal adjacent walls and therefore a closed room. It was replaced with opposed
pocket leaves inside the existing jambs. The builder, named animation nodes,
collision, placement reservation and manifest were changed together. A regression
checks both perpendicular neighbors and an inline neighbor; actual GLB rays test
closed and open states. Nine geometry checks pass after the rebuild. The original
44-draw contact sheet predates this correction. All three linked captures were
replaced by the final corrected rerun: 47 draws / 20,690 triangles in the kit view,
zero console/page errors, the same AMD backend and 1440×900 resolution. The final
doorway capture shows both leaves retracted within the jambs. The browser closed
after capture and the GPU slot was handed to the controller-journey agent.

## Vehicle envelope correction

Independent code inspection found that the initial build obstacle adapter used a
seat-center ray and a 0.35 m stopping offset for flight, so wings and noses could
cross a building even while the ray missed. Flight now supplies the actual
`layout.flightBounds` relative to `seatEye`, rotated by the navigation orientation.
Each claim projects that envelope into its own axes and expands building boxes
for a continuous translation sweep. EVA uses a standing-body box around the eye.
Weapon/selection rays retain their unexpanded geometry behavior.

The expansion is conservative: rotated box corners include some empty hull space,
and it is a translational sweep at the current orientation rather than a swept
rotating mesh. Existing contact can move outward or tangentially, allowing takeoff
from a floor. Two navigation regressions cover wing-center misses, early nose
contact, a safely separated flight path, EVA edge contact and upward floor escape.
All three build test files pass after the correction. These checks do not replace
a complete physical flight/controller journey.

## Curved-ground entry tolerance

The controller route exposed a real 24 µm difference between the site tangent
plane and curved ground. A nominal 0.3 m foundation then exceeded the old 10 µm
step allowance and blocked the staircase entry. Support and vertical-contact
comparisons now share a 1 mm tolerance. The exact failed eye-position regression
first reaches the foundation and advances onto the first tread on its next
resolve; a 0.305 m foundation remains too high for a 0.3 m step. Geometry and
navigation tests pass after this correction; the controller rerun is separate.
