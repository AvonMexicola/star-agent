# System navigation map

`M` opens the map. A standard controller opens it with D-pad left; inside the map,
use the left stick or D-pad to move focus, A to activate, and B or Menu to close.
The controls menu also offers a touch-accessible System button. On narrow screens,
the header and flight-hold status stay visible while destination details scroll.

The chart projects Aeon, Selene, the ship and its approach route onto the plane
through Aeon–Selene and world up. World coordinates remain JavaScript doubles.
The scale bar and drive exclusion rings use actual metres; body markers smaller
than eight screen pixels are enlarged for selection. The ship's distance out of
that plane is listed below the legend. The distant star is reported by its actual
ship-relative range outside the local chart; there are no decorative orbits.

Selecting a world changes only the course. Engage starts the existing continuous
travel plan. The chart shows the full plan and remaining segment, distance to the
actual approach endpoint, remaining duration, phase and progress. An aborted drive
shows distance to the braking stop. Blocked starts explain the relevant altitude
exclusion. Fit restores the whole route; zoom centres on the selected world.

Opening the map holds simulation and skips world updates, atmosphere rendering and
tunnel rendering. Animation-frame callbacks continue polling the isolated
controller UI channel. Releasing the map does not accumulate its elapsed time or
apply held menu inputs as flight commands. `state.renderedFrames` exposes completed
scene renders so the hold can be verified without interpreting stale draw counts.

## Reproduction and evidence

- `npm test`: includes projection geometry/precision and controller neutral gating.
- `npm run test:browser`: includes `tests/browser/system-map.spec.js`, continuous
  return travel, controller navigation and the physical boarding journey.
- `node scripts/map-review.mjs http://127.0.0.1:5181 /tmp/star-agent-map-review`:
  production-preview screenshots and renderer/console evidence, including
  1440×900 desktop, 390×844 touch layout and a held active drive. The drive capture
  samples a reproducible point in the actual analytic travel plan through the
  explicit debug navigation hook; it does not claim that interaction as gameplay.

See [QA evidence](qa/navigation-map/README.md) for actual results and limitations.
