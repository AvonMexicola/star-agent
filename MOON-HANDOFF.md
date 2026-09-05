# Selene landing and exploration

Review: [PR #7](https://github.com/AvonMexicola/star-agent/pull/7), branch `feat/moon`,
isolated checkout `/tmp/star-agent-moon`. Rebased onto `feat/visual-fidelity`
(`0e9e921`) per Claude's merge queue. The branch includes controller support from
PR #3; keep that dependency when integrating. This supersedes the initial flyby-only
handoff and removes the former 4 km perimeter.

Click Selene for a 180 m descent approach; Shift-click sets a continuous-flight
course. L lands, F stands, walk aft and F opens the hatch. Walk down the ramp,
explore/jump in 1.62 m/s² lunar gravity, return physically to the chair, F sits and
L launches. Standard controller movement, interaction and jump also work.

Terrain rendering, swept contact and walking use the same crater heightfield.
Selene has detailed cubed-sphere patches, stable local precision at its 24,000 km
planet-centred distance, airless lighting/flight/audio and body-relative telemetry.
Fixed position; no lunar orbital simulation, resource gameplay or scattered props.

Files owned by this contribution: `src/moon-world.js`, `src/moon-terrain.js`,
`src/moon.js`, `src/celestial.js`, lunar tests/browser journey, lunar docs and
`PLANET-PIPELINE-MEMORY.md`. Shared integration also edits main, navigation, world,
lighting, audio, index and README. Do not replace the shared files wholesale with
isolated copies: the shared checkout also contains independent crash/ship work.

## Crash integration in the shared checkout

The review branch currently precedes crash PR #2 in code history. The shared
checkout already composes it with lunar landing. In the `lunar.hit` branch, before
`touchDown` or zeroing velocity, it calls:

```js
const normal = bodySurfaceNormal(this.position, SELENE);
const impact = assessImpact(this.velocity, normal, 'lunar regolith');
if (impact.crashed) { this.crashAt(impact, normal); break; }
```

Keep the crash input guards, SHIP DESTROYED HUD, effects and reset. Generic ground
contact uses body-relative altitude/surface point and a lunar normal when applicable.
The shared high-speed lunar regression expects a crash at 3.2 m terrain clearance;
the standalone branch expects a touchdown. Preserve these semantic differences
when merging #2 and #7, then run the combined regression suite again.

Validation: 70 unit cases and production build pass in the rebased review branch;
76 cases (including the independent crash suite) and build pass in the shared
checkout. Production browser missions pass in both (40.5 s isolated, 39.8 s shared),
without console/page errors. Screenshot evidence: `docs/selene-landing.png`,
`docs/selene-aeon.png`; full run evidence under `/tmp/star-agent-moon-evidence`.
Chromium 151.0.7922.173, ANGLE/Vulkan SwiftShader, 1280×800, render scale .55.
The final airless-audio addition has a focused regression and passing full unit/build
checks. No hardware FPS target, merge or deployment is claimed.

Fable's reusable environment memory is filed in
[PLANET-PIPELINE-MEMORY.md](PLANET-PIPELINE-MEMORY.md), with a completion notification
in `HANDOFF.md`. The manager retains review/merge/deployment coordination.
