# Hangar hardware and asset budget review

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

## Ship budgets: still failing

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

## Bounded triangle-reduction candidates (evaluated, not exported)

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
