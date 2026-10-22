# Hangar hardware and asset budget review

**Current measured sample at `1eeb302`: PASS for the affected hangar views.**
At 1440×900 on AMD Radeon 860M / ANGLE GL, all four affected views meet the
600-draw / 900,000-triangle limits, with GPU p95 at most 9.339 ms and CPU callback
p95 at most 6.800 ms. Modal rendering and individual ship/prop asset budgets pass.
Orbit still fails the inherited draw budget at 477 versus 300 draws. Earlier
much slower samples remain recorded with their cause unconfirmed; this is not a
claim of stable performance across sessions. Independent visual acceptance is
blocked by reviewer quota, with no new rubric or waiver.

The initial audit below is preserved as historical evidence; the later
[measurements and disposition](#later-measurements-and-current-disposition) follow it.

Measured **2026-09-06, 12:37 UTC**, against the production preview at
`http://127.0.0.1:5249` (bundle `index-DF35WM1t.js`). This is the run **before the
pending modal render-skip fix**. Later changes require their own measurement.

## Reproduction and method

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 5249 --strictPort
node scripts/hangar-hardware-check.mjs --url http://127.0.0.1:5249 --out /tmp/star-agent-hangar-hardware
```

Chromium **151.0.7922.173**, headless, **1440×900**, device pixel ratio **1**,
render scale **1**, seed **7291**. Reported hardware backend:
`ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)`.
Launch uses `--enable-gpu --ignore-gpu-blocklist --use-gl=angle --use-angle=gl`.

The harness waits for drained terrain jobs and stable patch counts, then performs
30 warmup frames and collects at least 60 actual rendered frames per view.
`EXT_disjoint_timer_query_webgl2` supplies 64-bit elapsed GPU queries around the
rendering requestAnimationFrame callback. Queries are polled only after
`QUERY_RESULT_AVAILABLE`; invalid, disjoint and stale queries are discarded.
There is no `gl.finish`, blocking readback, or substitution of RAF pacing for GPU
cost. The method follows the [Khronos extension specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).

CPU measurements cover the same callback's scene update and command submission,
excluding timer begin/end/poll operations. Draw-call wrappers add some overhead.
CPU and GPU work can overlap: the two numbers must not be summed. Browser
composition and input-to-display latency are outside these measurements.

Raw evidence and screenshots remain in `/tmp/star-agent-hangar-hardware/`.
`evidence.json` retains every sample, renderer state and diagnostic. The initial
sandbox launch failed at Chromium's crashpad socket with `EPERM`, before any
measurement; `sandbox-launch-failure.json` records that attempt. The approved
retry outside the sandbox completed with **zero console errors, warnings,
crash/disconnect events, or rejected/disjoint timer queries**.

## Measured rendering costs

Times are milliseconds. Draws include all WebGL draw submissions in the actual
render callback; triangles are the renderer's reported count. All samples use the
same resolution and scale.

| View | Valid GPU samples | GPU median / p95 | CPU median / p95 | Draws | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial orbit | 60 | 3.005 / 3.988 | 6.700 / 7.500 | 477 | 304,642 |
| Hangar, authored opening t=10 | 61 | 8.110 / 9.021 | 6.800 / 10.100 | 469 | 711,417 |
| Seated cockpit | 60 | 8.606 / 9.054 | 5.600 / 6.400 | 488 | 703,516 |
| Cargo/elevator corner | 60 | 6.471 / 7.187 | 5.900 / 7.800 | 412 | 590,388 |
| Operations gallery | 60 | 6.421 / 6.675 | 5.300 / 5.800 | 400 | 582,072 |
| H help menu over gallery | 60 | 6.381 / 6.687 | 5.650 / 7.800 | 400 | 582,072 |

Observed median RAF cadence was **16.7 ms** for every view. That is presented
separately; presentation pacing is not a 10 ms render-budget measurement.

The four affected scene views meet the 600-draw/900k-triangle budgets, and their
measured GPU p95 is below 10 ms. Opening CPU p95 reaches **10.1 ms**, so this is
not an unqualified claim that every total frame meets 10 ms.

Two failures remain in this recorded build:

- **Orbit draw budget fails:** 477 exceeds 300, a known inherited budget issue.
- **Modal budget fails:** the actual H help dialog renders 100% of the gallery's
  draw calls and triangles, exceeding the 25% allowance. The root agent's modal
  render-skip fix was pending when these results were recorded; no post-fix pass
  is claimed here.

Opening is the authored `intro=1` camera evaluated and frozen at exactly ten
seconds. Cockpit and service views are reproducible camera fixtures; these
measurements do not replace physical boarding or collision tests.

## Station prop allocation

The GLB has nine material batches. Each triangle was assigned to its manifest
assembly using all three transformed vertex positions; every triangle matched
exactly one assembly. Each assembly's referenced vertex records and indices were
counted once per primitive, including all exported attributes. The allocation
sums exactly to the binary payload, without charging the shared buffer repeatedly.

| Assembly | Triangles | Allocated vertex/index bytes |
| --- | ---: | ---: |
| Cargo dolly and cases | 5,692 | 392,040 |
| Strapped pallet | 3,392 | 238,976 |
| Workbench dressing | 7,680 | 520,448 |
| Fire cabinet | 1,592 | 108,368 |
| Terminal trim | 2,592 | 191,424 |
| Elevator jamb | 752 | 52,896 |
| Left storage stack | 4,512 | 328,128 |
| Right storage stack | 4,512 | 328,128 |
| Operations gallery | 5,508 | 394,008 |
| **Total payload** | **36,232** | **2,554,416** |

Shared GLB/JSON overhead is **9,776 bytes**, giving **2,564,192 bytes** for the
whole kit. Every assembly is below **10k triangles and 1 MB**, even if the entire
shared overhead were conservatively charged to each individual assembly. The
whole-kit size is not an individual-prop failure.

## Historical ship budgets: failing before the rebuild

| Asset | Current triangles | Current GLB bytes | Unused UV bytes | Estimated bytes after UV removal |
| --- | ---: | ---: | ---: | ---: |
| Nomad | 70,624 | 4,710,588 | 1,053,768 | 3,656,820 |
| Atlas | 84,580 | 5,652,816 | 1,278,624 | 4,374,192 |

**Both current ships fail the 60k-triangle and 4 MB limits. No ship asset was
changed in this audit.** Both GLBs contain no animations, no image textures, no
unused accessors, and already use 16-bit indices. Runtime ship weather samples
object-local positions rather than model UVs, so removing `TEXCOORD_0` would
preserve the current rendered materials while reducing the file sizes above
(before the small JSON rewrite). It would remove UV information useful for future
texturing, so source `.blend` files should retain it.

Nomad can meet the byte limit through that unused-stream removal alone. Atlas
also has **27,648 bytes** of exactly duplicate position/normal accessors; merging
those still leaves about **4,346,544 bytes**. Exact vertex welding offers only
about another 9 KB. No obvious lossless removal of redundant streams gets Atlas
under 4 MB, and none of these byte changes reduces triangle counts. Compression
of HTTP responses would reduce transfer size but would not make the GLB itself
meet the stated asset-byte limit.

## Historical triangle-reduction candidates (evaluated before export)

A separate background Blender process evaluated the authoring scripts only up to
geometry construction, stopping **before modifier application, batching, save or
export**. No builder or asset file was edited. Evaluated-mesh triangle counts
matched both existing GLBs exactly at their current settings, providing a useful
baseline for the following in-memory modifier comparisons.

| In-memory bevel setting | Nomad triangles | Atlas triangles |
| --- | ---: | ---: |
| Current: default 3 segments | 70,624 | 84,580 |
| Only widths ≤0.04 m: 3 → 2 segments | **57,784** | 62,940 |
| All default bevels: 3 → 2 segments | **54,896** | **58,460** |
| Default 2; widths ≤0.025 m use 1 segment | 45,744 | 47,196 |

Nomad's explicit **six-segment pilot-chair bevels were preserved** in every
candidate. All geometry, bevel widths, moving-assembly parents, labels, rings,
lifts and interactive structure remained present. The raw evaluation log is
`/tmp/star-agent-ship-triangle-audit.log`; its temporary inspection script is
`/tmp/star-agent-ship-triangle-audit.py`.

The smallest measured change meeting the triangle limits is therefore:

- **Nomad:** reduce three-segment bevels only where width ≤0.04 m to two segments;
  keep large bevels and the six-segment chair.
- **Atlas:** reduce default three-segment bevels to two segments.

These are bounded quality tradeoffs, **not lossless optimization**. They change
rounded-edge tessellation and possibly highlight smoothness. The counts alone do
not establish visual acceptability or final export sizes. Before adoption, rebuild
isolated candidates, compare the same exterior/cockpit views, rerun physical
boarding/lift checks, and measure their final bytes. A blanket one-segment pass is
unnecessary to meet 60k and offers a larger visual compromise. If even the smaller
change harms the desired appearance, an explicit budget waiver is preferable to
silently degrading the ships.


## Later measurements and current disposition

The `7ddef61` and `0d75c3f` runs below are historical. The subsequent
[completed coffer measurement](#completed-coffer-measurement-1eeb302) records the
current sample; earlier failures and unexplained timing variance remain evidence.


The two later runs use the same recorded Chromium 151.0.7922.173, AMD Radeon 860M
ANGLE GL backend, 1440×900 viewport and render scale 1 described above. Both used
`http://127.0.0.1:5249`, 30 warmup callbacks and a target of at least 60 rendered
samples per scene. Candidate attribution is the integration lead's served-build
record; the raw JSON records the URL and environment, not a Git SHA.

| Run | Candidate | Evidence timestamp (UTC) | Raw evidence |
| --- | --- | --- | --- |
| Post-modal correction | `7ddef61` | 2026-09-06 12:53:15.200 | `/tmp/star-agent-hangar-hardware-final/evidence.json` |
| Ship-budget revision | `0d75c3f` | 2026-09-06 13:02:38.996 | `/tmp/star-agent-hangar-hardware-budget/evidence.json` |

Both completed with empty error, warning and diagnostic lists and `failure: null`.
All recorded discarded-query counters are zero, with no timer errors. These
successful captures do not imply a successful frame-budget result.

### Post-modal correction: 7ddef61

Times are milliseconds; figures below are the recorded summaries rounded to three
decimal places. CPU and GPU costs overlap and must not be added.

| View | Valid GPU samples | GPU median / p95 | CPU median / p95 | Draws | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial orbit | 60 | 3.621 / 4.390 | 8.400 / 9.900 | 477 | 304,642 |
| Hangar, opening t=10 | 61 | 9.493 / 10.905 | 9.400 / 12.000 | 469 | 711,417 |
| Seated cockpit | 61 | 9.691 / 10.918 | 9.000 / 10.600 | 488 | 703,516 |
| Cargo/elevator corner | 61 | 7.013 / 7.777 | 8.700 / 10.300 | 412 | 590,388 |
| Operations gallery | 61 | 6.441 / 7.092 | 8.700 / 11.600 | 400 | 582,072 |

Opening and cockpit GPU p95 exceed 10 ms in this post-modal run, unlike the
initial audit. Several CPU p95 measurements also exceed 10 ms. The earlier lower
measurements remain evidence, but cannot establish an unconditional budget pass.

### Ship-budget revision: 0d75c3f

| View | Valid GPU samples | GPU median / p95 | CPU median / p95 | Draws | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial orbit | 62 | 9.957 / 13.373 | 15.800 / 24.800 | 477 | 304,642 |
| Hangar, opening t=10 | 62 | 19.040 / 26.564 | 13.850 / 19.500 | 469 | 676,945 |
| Seated cockpit | 62 | 18.997 / 25.014 | 14.200 / 21.900 | 488 | 668,564 |
| Cargo/elevator corner | 62 | 14.698 / 18.011 | 14.250 / 21.700 | 412 | 567,476 |
| Operations gallery | 63 | 18.347 / 23.055 | 12.000 / 17.800 | 400 | 559,160 |

The latest four affected views remain below 600 draws and 900,000 triangles, but
**all four GPU medians and p95 values exceed 10 ms**. Their CPU callback medians
and p95 values also exceed 10 ms. Frame-budget acceptance is therefore **not
established; the measured latest run fails**. CPU and GPU are separate overlapping
measurements, not a sum or a presentation-latency claim.

Even orbit, still exactly 477 draws and 304,642 triangles, changed from an initial
GPU median of 3.005 ms to 3.621 ms and then 9.957 ms. The ship-budget revision
reduces affected scene triangles while timings rise. This discrepancy does not
identify a cause: user activity, temperature, power state, competing work and a
specific runtime regression have not been established by these measurements.
Keep all runs; controlled diagnosis or an explicit performance exception is still
required. Do not select only the fastest run as acceptance.

### Modal rendering: PASS after correction

In **both** later runs the actual H help dialog recorded **60 render-loop
callbacks, all 60 with zero WebGL draws**. `modalDrawRatio` and
`modalTriangleRatio` are zero and `modalQuarterDrawBudget` is true. This supersedes
the initial modal failure. GPU/CPU rendered-frame summaries are `null` because
there are no rendered samples; they must not be presented as measured 0 ms GPU or
CPU cost. The callbacks continue for input/close handling and presentation cadence.

### Ship and prop budgets after the bounded rebuild

| Asset | Final triangles | Final GLB bytes | 60k / 4 MB ship gate |
| --- | ---: | ---: | --- |
| Nomad | 57,784 | 3,783,616 | PASS |
| Atlas | 58,460 | 3,770,128 | PASS |

The candidates evaluated earlier were implemented with UVs retained. Nomad reduces
only bevels up to 0.04 m to two segments, retaining wider three-segment edges and
the explicit six-segment chair. Atlas uses two segments for default bevels.
Functional parts, moving-node hierarchy and transforms remain present; these are
bounded tessellation changes, not lossless geometry optimization. Both builders
regenerate editable `.blend` files and runtime GLBs. The ship-specific records
contain exact bounds and focused physical checks:
[Nomad](../nomad-ship.md#mesh-budget-refinement--2026-09-06) and
[Atlas](../atlas-freighter.md#mesh-budget-refinement--2026-09-06).

The nine station prop assemblies retain the passing allocation measured above;
each remains below 10k triangles and 1 MB including a conservative share of
overhead. Individual asset-budget passes do not certify visual quality or the
scene frame budget. Orbit still fails its inherited 300-draw limit at 477 draws.
No new Opus acceptance or merge/deployment outcome is claimed here.


## Ceiling correction: initial verification checkpoint at 1eeb302

The current runtime `1eeb302` corrects decorative ceiling panels occluding the
recessed diffusers; its hero contains 89,944 triangles. The visibility regression
failed before the correction, then passed all three focused tests afterward;
the integration lead reports all 21 unit files and the production build pass.
Root's full eighteen-case browser pass in 4.9m belongs to preceding `0d75c3f`.

At this initial checkpoint, the run under
`/tmp/star-agent-hangar-hardware-coffers` was still in progress. No partial files
were accepted as final measurement evidence. Its later completion follows below;
the timings are measured, not inferred from the changed triangle count.

The independent review attempt ended without a completed rubric after reporting
a session limit resetting at 19:00 Europe/Amsterdam. The
[attempt record](hangar-opus-rereview-attempt.md) preserves its exact status.
Visual acceptance is blocked by quota; no pass, waiver or merge is claimed.


## Completed coffer measurement: 1eeb302

The run completed with exit 0. Raw evidence is
`/tmp/star-agent-hangar-hardware-coffers/evidence.json`, generated
**2026-09-06 13:55:13.762 UTC**, attributed by the integration lead to served runtime
`1eeb302`. Chromium 151.0.7922.173 reports AMD Radeon 860M through ANGLE GL,
1440×900, render scale 1. The warmup/query method is unchanged. There are zero
errors, warnings or diagnostics, `failure: null`, zero discarded queries and no
timer errors. Every rendered view has 60 valid GPU samples.

Times are milliseconds, rounded to three decimals. CPU callback and GPU elapsed
costs overlap; they must not be added.

| View | Valid GPU samples | GPU median / p95 | CPU median / p95 | Draws | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial orbit | 60 | 3.601 / 3.981 | 6.100 / 7.500 | 477 | 304,642 |
| Hangar, opening t=10 | 60 | 8.374 / 8.643 | 5.800 / 6.100 | 469 | 675,505 |
| Seated cockpit | 60 | 8.405 / 9.339 | 5.700 / 6.500 | 488 | 667,124 |
| Cargo/elevator corner | 60 | 6.707 / 7.106 | 5.600 / 6.800 | 412 | 566,036 |
| Operations gallery | 60 | 6.017 / 6.385 | 5.400 / 6.100 | 400 | 557,720 |

**The current affected-view sample passes the hangar count and measured timing
budgets:** GPU p95 is at most 9.339 ms and CPU callback p95 at most 6.800 ms.
This is a bounded sample result, not end-to-end latency or a guarantee of stable
performance in every session. The much slower `0d75c3f` measurements and their
unconfirmed cause remain in this ledger; the ceiling geometry change alone does
not establish why orbit timings also returned to approximately 3.6 ms.

The help dialog again records **60/60 callbacks with zero actual WebGL draws**,
zero modal draw/triangle ratios and a passing quarter-draw budget. Its rendered
CPU/GPU summaries remain null; no 0 ms execution claim is inferred. Orbit remains
477 draws / 304,642 triangles and still fails the inherited 300-draw requirement.
Ship and prop asset budgets remain passing as measured above.

The complete root coffer screenshot tour is still running and two focused browser
cases will follow. Neither is recorded as passed here. Independent visual
acceptance remains quota-blocked, with no new score, waiver, PR merge or deployment.
