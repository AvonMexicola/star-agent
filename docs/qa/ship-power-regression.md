# Ship power navigation regression QA

Date: 2026-09-06 (Europe/Amsterdam)

This is an independent browser regression pass for the navigation refactor in
`e82c3e5`. The final candidate adds `b891272`, a one-line cabin guidance wording
change that does not alter the paths exercised here. This report does not reuse
the feature author's pass as the regression result.

## Scope and environment

The focused config is `scripts/ship-power-regression.config.js`. It serves a
production build on `127.0.0.1:5243` and selects existing repository specs only;
no runtime or test source was changed. Before the run, a direct HTTP probe was
refused and `lsof` found no listener on 5243. The sandbox did not permit the
netlink-based `ss` check.

- Chromium: 151.0.7922.173 (`/usr/bin/chromium`)
- Launch backend requested by the config: ANGLE/Vulkan SwiftShader
- Exact renderer string recorded by the same candidate's feature evidence:
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`
- Desktop viewport: 1440 × 900
- Narrow travel-map check: 390 × 844
- Boarding retry render scale: 0.4
- Workers: 1

The regression specs do not independently query the renderer string. The string
above comes from `/tmp/star-agent-power-browser/environment.json`, produced on
the same machine with the same Chromium executable and SwiftShader launch flags.

## Results

The first command ran five selected cases. At that point the config selected
`inspect.spec.js` alongside opening and travel. The final config replaces that
short-timeout inspection with the verified `flight.spec.js` boarding case; the
original inspection source and its recorded failure are unchanged:

```text
npm run test:browser -- -c scripts/ship-power-regression.config.js
```

Result: **4 passed, 1 timed out in 2.6 minutes**.

| Existing case | Result | Regression surface |
|---|---|---|
| `scripts/hangar-merge.spec.js` — saved Atlas opening | PASS, 28.6 s | Saved Atlas selection, cinematic gate, keyboard handoff, Fleet and map availability |
| `scripts/hangar-merge.spec.js` — elevator fade | PASS, 22.2 s | Conflicting Help/orbit input during transfer, preserved parked ship, later quick transit |
| `tests/browser/travel.spec.js` — bidirectional drive | PASS, 23.9 s | Target selection without teleport, spool/tunnel, pause, Selene arrival, Aeon return, post-arrival W thrust and X brake |
| `tests/browser/travel.spec.js` — exclusion/mobile map | PASS, 8.9 s | Surface exclusion, disabled engage action, 390 × 844 layout, navigation re-enable |
| `scripts/inspect.spec.js` — physical boarding | TIMEOUT, 1.1 min | Its fixed 45 s wait expired while landing assist was still descending |

The timed-out page was not stuck and main power was on. Its captured state was
`mode=flight`, `autoland=true`, altitude 11.1 m and speed 5 m/s, with the live
notice “Landing assist engaged. Descending vertically.” SwiftShader reported
0–3 FPS during this run. The failure is preserved as a real result: the older
inspection fixture's 45-second wall-clock allowance is insufficient on this
backend for the current production scene.

The physical path was then checked once with the existing production boarding
case, which has the repository's explicit slow-renderer allowance:

```text
npm run test:browser -- -c scripts/ship-power-regression.config.js tests/browser/flight.spec.js
```

Result: **1 passed in 2.8 minutes** (`orbital view, terrain streaming, landing,
walking, boarding and launch`). At 1440 × 900 and render scale 0.4 it completed:

1. keyboard L touchdown at the seeded forest;
2. F leave-seat transition into the cabin;
3. W movement to the hatch, F opening, and physical ramp traversal;
4. exterior walking without distance boarding;
5. physical return to the pilot chair and F reboarding;
6. keyboard L launch and Space climb; and
7. a subsequent polar quick-transit arrival.

The selected Atlas opening, drive arrivals, and complete Nomad boarding/launch
journey therefore show no navigation regression from the power/cabin refactor.
The short-timeout inspection case should not be presented as passing.

## Renderer observations

These values were printed by the existing production state diagnostics. They
include shadow and scene passes. FPS is a SwiftShader observation, not laptop-GPU
performance evidence.

| View | Render scale | Draw calls | Triangles | Reported FPS | Streaming state |
|---|---:|---:|---:|---:|---|
| Orbit | 0.4 | 477 | 304,642 | 3 | 202 patches, LOD 3, pending 0 |
| Forest, 95 m | 0.4 | 354 | 1,249,795 | 1 | 842 patches, LOD 12, pending 106 |
| Polar, 90 m | 0.4 | 243 | 154,882 | 6 | 447 patches, LOD 14, pending 11 |

The orbit draw count remains above the `QUALITY.md` budget of 300. Forest and
polar geometry counts are within the surface limits, but the snapshots were not
terrain-settled performance samples. No hardware frame-time gate was run.

## Visual evidence and limitations

The successful boarding run produced current-candidate orbit, forest-flight,
forest-walk and polar screenshots under `test-results/`. The earlier inspection
run produced `/tmp/star-agent-orbit.png`; it stopped before cockpit/coast/highlands
captures because of the landing timeout. Travel screenshots were produced under
`/tmp/star-agent-{system-map,travel-*}`.

The optional fixed 1600 × 900 tour was not completed. Starting a standalone
preview on 5243 was rejected by the sandbox (`listen EPERM`), and the escalation
attempt was aborted. No preview or browser process remained afterward. Current
coast, highlands, fixed t=10 hangar and seated-cockpit captures are therefore
missing from this independent pass, and no pixel-diff or full `QUALITY.md`
acceptance is claimed.

The change does not modify graphics shaders, but existing visual-quality findings
still apply. This pass does not supersede the recorded coast composition, forest
LOD colour, highland faceting, hangar lighting, cockpit finish, system-map, or
orbit draw-call limitations. It includes no Opus visual-rubric review and no
hardware performance approval.

Build/tool output included the existing large-chunk warning, the warning that the
temporary build directory is outside the project root, and Node's `NO_COLOR` /
`FORCE_COLOR` warning. Passing cases found no page or relevant browser-console
errors according to their existing collectors.
