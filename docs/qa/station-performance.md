# Station performance: hangar and central hub

The measured old hub is primarily constrained by CPU work and excessive separate draws, rather than triangle count alone. At 1440 × 900 on the AMD Radeon 860M, its GPU median is **3.039 ms**, while the main JavaScript frame callback median is **12.600 ms** and observed presentation cadence is commonly **33.3 ms**. These timings overlap and must not be added. The hub submits **625 draws for 226,278 triangles**, including **283 hub shadow draws**. It also updates all twenty hidden hero pods and writes 520 unchanged distant-berth matrices every frame.

The **final stable integration** reduces hub draws **625→259 (58.56%)**, CPU callback median **12.600→5.300 ms**, and observed rAF median **33.3→16.7 ms**. Final hub GPU median is **4.205 ms**, higher than the old room’s 3.039 ms with additional geometry/shadow passes. Baseline, initial and final records are preserved below. No graphics-quality or resolution reduction was used.

## Actual baseline capture

Root supplied the previous production preview at `http://127.0.0.1:5249`; implementation work is isolated in `/tmp/star-agent-concourse-work`, branch `feat/station-concourse` from 056d. Captured **2026-09-06T14:43:39.719Z**, Chromium **151.0.7922.173**, **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**, WebGL 2.0 (OpenGL ES 3.0 Chromium). Loaded bundle observed in the Chrome CPU profile: `/assets/index-KPBqsfW0.js`. Device scale factor 1, render scale 1, **1440 × 900** drawing buffer, seed 7291. No resolution reduction or graphics-quality change was used.

The hangar fixture is the authored opening camera at t=10. The hub fixture sets station location to hub, standing at local [0, -6.25, 12], looking toward [0, -3, -16]. These are camera fixtures, not a physical elevator-journey pass. Both actual images were viewed. The old hub visibly contains sparse block furniture and many separate floor panels; the camera looks across the central aisle toward the station directory.

- [Actual old hangar screenshot](/tmp/star-agent-station-performance-before/01-hangar.png)
- [Actual old hub screenshot](/tmp/star-agent-station-performance-before/02-hub.png)

Zero console errors, warnings, unexpected browser lifecycle events or run failure. Raw evidence, screenshots and two Chrome CPU profiles remain under `/tmp/star-agent-station-performance-before`; they are not committed as raw test reports.

## GPU, CPU and cadence are separate measurements

Each view warms 30 frames, then collects at least 60 valid asynchronous `EXT_disjoint_timer_query_webgl2` elapsed GPU queries (actual run: 62 each). Disjoint, invalid and unavailable results are excluded; no `gl.finish`, busy waiting or synchronous pixel readback is used. CPU callback duration measures scene updates plus command submission. rAF intervals describe cadence, including presentation pacing; they are not GPU timings or input latency measurements.

| View | GPU median / p95 ms | CPU callback median / p95 ms | rAF median / p95 ms | Actual draws | Triangles |
|---|---:|---:|---:|---:|---:|
| 01-hangar | 7.950 / 8.651 | 9.700 / 17.800 | 16.700 / 33.300 | 469 | 675,505 |
| 02-hub | 3.039 / 3.505 | 12.600 / 17.200 | 33.300 / 50.000 | 625 | 226,278 |

The reciprocal of the mean rAF interval is approximately **55.455 observed frames/s** for the hangar and **29.517** for the hub during these samples. This is a measured run, not a general minimum FPS guarantee. The GPU budget alone does not guarantee smooth presentation.

## Draw and update attribution

After baseline timing, each view runs a separate three-second CDP CPU sampling profile (1,000 µs interval), with instrumented object/material draw and station-method counters. Instrumentation adds CPU overhead, so these diagnostic method times are not interchangeable with the preceding baseline callback durations. Nested method timings are inclusive and not additive. Per-object renderBufferDirect CPU time is command-submission cost, not per-object GPU time. Raw records identify each object path, material identity, scene/shadow pass and camera ID; light records identify the corresponding shadow camera.

| Diagnostic quantity | Hangar | Hub |
|---|---:|---:|
| Diagnostic frame callbacks | 121 | 67 |
| Hidden hero pod models | 19 | 20 |
| Pod update calls/frame | 20 | 20 |
| All pod update CPU ms/frame, instrumented | 4.232 | 4.509 |
| StationComplex.update inclusive CPU ms/frame, instrumented | 4.465 | 4.736 |
| LOD instance matrices written/frame | 520 | 520 |
| LOD batches | 26 | 26 |

The Chrome profile's major non-idle self-time entries include `updateMatrixWorld`, `multiplyMatrices` and `computeBoundingBox`. Source inspection connects these to `Station.updateDoorColliders`, which previously traversed each pod's entire hero hierarchy and recomputed door geometry bounds every frame, including unchanged/hidden pods. The instance write count independently confirms the 26 × 20 unconditional updates in `StationComplex.update`.

The hub's measured 625 draws decompose as **160 hub scene + 283 hub shadow + 56 exterior + 26 distant-berth + 100 other scene draws**. Within the hub, floor/aisle `HubMarkings` account for **64 scene + 105 shadow draws**, generic `Structure` pieces for **68 scene + 128 shadow**, and `HubDetail` pieces for **10 scene + 30 shadow**. The remaining hub draws include signs, floor/ceiling, glass, lamps and elevator leaves. The sun uses a 2048² shadow map; hub point lights have shadows disabled. In the hangar, the sun and one 1024² service-corner spotlight cast shadows. The general surface-material preparation enables shadows on solid meshes, explaining why small hub markings/signs participate unless explicitly excluded.

These measurements justify batching the new static hub architecture and excluding inappropriate decorative shadow casters while retaining visible detail. They do not justify hiding furniture, reducing render scale or removing the station's visible complexity.

## Initial integrated AFTER: 5260 production preview

Captured **2026-09-06T14:58:05.153Z** from the new production artifact at `http://127.0.0.1:5260`, using the same AMD Radeon 860M, Chromium 151.0.7922.173, 1440 × 900 drawing buffer, render scale 1 and camera fixtures. Both captures report 20 pods and finished assets ready; errors, warnings, lifecycle diagnostics and run failure are empty. Actual images were viewed, including the hub's two shop frames and central aisle.

| View | GPU median / p95 ms | CPU callback median / p95 ms | rAF median / p95 ms | Actual draws | Triangles |
|---|---:|---:|---:|---:|---:|
| 01-hangar | 8.396 / 8.710 | 5.900 / 7.300 | 16.700 / 16.700 | 505 | 684,953 |
| 02-hub | 4.320 / 4.723 | 5.100 / 5.600 | 16.700 / 16.800 | 253 | 308,010 |

Hub draws fell **625→253 (59.52%)** while submitted triangles increased 226,278→308,010 with the new room. Hub CPU callback median fell **12.600→5.100 ms**, and median rAF interval changed **33.3→16.7 ms**. GPU median increased **3.039→4.320 ms**, so this is a CPU/draw reduction with added visible detail, not a claim that every rendering cost decreased. Hangar CPU median fell 9.700→5.900 ms while its draw count increased 469→505 and GPU median 7.950→8.396 ms with the integrated additions.

Separate instrumented diagnostics measure StationComplex.update at **0.410 ms/frame in hangar** and **0.369 ms/frame in hub**, compared with 4.465/4.736 ms previously. The hub writes **zero LOD matrices over 182 diagnostic frames**, instead of 520 every frame. The hangar writes 240 matrices over 183 frames while other automatic bay doors can still move; it is not claimed as a zero-write static test. The old/new scene-wide frame times also include the root agent's architecture batching, so the entire measured improvement cannot be assigned to the CPU cache alone.

[Initial AFTER hangar screenshot](/tmp/star-agent-station-performance-after/01-hangar.png) / [initial AFTER hub screenshot](/tmp/star-agent-station-performance-after/02-hub.png). No black scene, shader failure or obviously malformed geometry was apparent. The initial hub has a strong tan weathered floor/wall treatment. The integration owner identified an unconditional `weatherShip(station.hub.group, ...)` call overriding the finished materials and shadow flags, plus stretched primitive UVs. Those corrections are included in the final artifact below; these initial screenshots and measurements retain their earlier state.

```sh
node scripts/station-performance-check.mjs --url http://127.0.0.1:5260 --out /tmp/star-agent-station-performance-after
```

## Final stable integration: before / initial / final

Final capture completed **2026-09-06T15:47:02.436Z** on `http://127.0.0.1:5260`. Chrome CPU profiles confirm both views loaded **`/assets/index-CZiHAmcD.js`**. The integration owner identifies that released bundle by SHA-256 **`b573bb26f62707ed1e2708f2c93f5e9a37be7906245b998d8f387bbca08ca68b`**; this records the supplied production artifact identity rather than inferring it from a changing worktree.

All three runs match browser/backend, fixture parameters, camera FOV and 1440 × 900 drawing buffer. Hub camera positions match exactly. The recorded baseline hangar camera differs from the initial/final camera by **0.830 mm** despite the same t=10 fixture; that small discrepancy is disclosed rather than calling the world positions identical. Final measurements contain **60 valid GPU queries per view**, with zero disjoint, invalid, unavailable or busy-query discards. Both views report 20 pods and finished station assets ready. Errors, warnings, unexpected lifecycle diagnostics and run failure are empty.

| Run | View | GPU median / p95 ms | CPU callback median / p95 ms | rAF median / p95 ms | Draws | Submitted triangles |
|---|---|---:|---:|---:|---:|---:|
| Before | 01-hangar | 7.950 / 8.651 | 9.700 / 17.800 | 16.700 / 33.300 | 469 | 675,505 |
| Before | 02-hub | 3.039 / 3.505 | 12.600 / 17.200 | 33.300 / 50.000 | 625 | 226,278 |
| Initial | 01-hangar | 8.396 / 8.710 | 5.900 / 7.300 | 16.700 / 16.700 | 505 | 684,953 |
| Initial | 02-hub | 4.320 / 4.723 | 5.100 / 5.600 | 16.700 / 16.800 | 253 | 308,010 |
| Final | 01-hangar | 8.198 / 8.596 | 6.800 / 7.600 | 16.700 / 16.700 | 505 | 684,953 |
| Final | 02-hub | 4.205 / 4.940 | 5.300 / 6.100 | 16.700 / 16.700 | 259 | 420,058 |

Final hub GPU p95 **4.940 ms** and CPU callback p95 **6.100 ms** are separate measurements; they must not be summed into a frame time. Final hangar GPU p95 is **8.596 ms**, CPU callback p95 **7.600 ms**. The final observed rAF mean corresponds to approximately 60 frames/s in both short samples, with 16.7 ms median/p95. This does not establish sustained worst-case FPS across travel, all 20 bays, interaction, shader compilation, thermal throttling or other hardware.

Final hub submitted triangles increase to **420,058**, compared with 308,010 initially and 226,278 before; totals include added shadow passes as well as visible content. Its draw attribution is **30 hub scene + 51 hub shadow + 56 exterior + 26 distant-berth + 96 other scene = 259**. The hub shadow work spans the sun's 2048² map and **two 512² shop spotlight maps**. The old hub had 160 scene + 283 shadow draws of its own. Final racks, directories, furniture and shop lighting remain part of the integrated room: this is lower CPU/submission overhead with more content, not a decrease in every GPU metric.

Instrumented StationComplex.update averages **0.408 ms/frame in the final hangar** and **0.366 ms/frame in the final hub**, versus 4.465/4.736 before. Final hub diagnostics record **zero LOD matrix writes over 182 frames**; final hangar records 240 writes over 184 frames while remote automatic doors may move. Architecture batching and the CPU caches contribute together, so the full scene improvement is not assigned to a single change.

Both final screenshots were viewed. [Final hangar](/tmp/star-agent-station-performance-final/01-hangar.png) / [final hub](/tmp/star-agent-station-performance-final/02-hub.png). The hub shows clean metal floor panels, coherent shop headers, two freestanding directories and the central aisle; the initial tan/weather override is absent. Hangar composition and readable ring faces remain intact. No black render, shader failure or obviously malformed geometry was apparent. This forward hub fixture does not fully show the side racks, furniture or rear elevator; their complete appearance and physical interaction are covered by separate integration journeys, not claimed from these two images.

```sh
node scripts/station-performance-check.mjs --url http://127.0.0.1:5260 --out /tmp/star-agent-station-performance-final
```

## Bounded CPU changes in the measured integration

- `Station.updateDoorColliders` now derives door bounds entirely in station-local doubles. Shared geometry bounds are cached by geometry/position-attribute identity and version, including morph-position metadata. Each leaf checks its local hierarchy transforms and membership, recomputing bounds only when the pose or shape changes. World rebasing/rotation no longer forces a traversal through the full hidden hero model.
- `StationComplex.update` lazily caches each pod's LOD visibility, offset/yaw and door pose. Only changed instances are written and marked for GPU upload. Camera-origin changes inside the same LOD interval require no local instance writes; independent doors and entry/exit across the hero/600 km cutoffs remain responsive.
- Meaningful regressions compare cached door bounds against a freshly computed transformed-geometry oracle across cinematic/mixer motion, vertex-version changes, added/removed child meshes and asset reload. They verify exact local bounds under large rebases and rotation, plus independent LOD door updates, pose changes and restored visibility.

`node --test tests/station.test.js tests/station-complex.test.js tests/station-opening-complex.test.js tests/station-floor.test.js` passed all four files after these edits. The CPU cache tests complement the final integrated hardware comparison above. The root agent owns the separate concourse architecture batching and interior redesign.

## Reproduce

```sh
node scripts/station-performance-check.mjs --url http://127.0.0.1:5249 --out /tmp/star-agent-station-performance-before
```

Use a fresh output directory for the integrated AFTER build. Do not run GPU browser suites simultaneously. The script rejects software rendering, unavailable elapsed queries or a changed 1440 × 900 drawing buffer. Diagnostic profiles can be opened in Chrome DevTools; `evidence.json` records the browser/backend, per-object/material/light attribution, timing samples and limitations.

## Baseline artifact SHA-256

```text
3422846e63d8a3ab8a34b64f8c257266e8874ccd5a8ce88f102619c57a9b14fe  01-hangar.png
d271b5b329fc0a34b8600f59ab4222027c5620a9d750358bbdc10f71dd4a2788  02-hub.png
8f9f6334fa1410e66588a82203e7bd901ceb703fd95db9b8362e4be1dbbdbff8  01-hangar.cpuprofile
41392ae7925ae78c9dc964686bf91444bc5f6aeebe2d43498ca3a027777c1092  02-hub.cpuprofile
3f74baf261f42c723df957856ee5c26751d261be6499e49036f7d68cdb2d2e1b  evidence.json
```

## Initial AFTER artifact SHA-256

Sources remain under `/tmp/star-agent-station-performance-after`; these are the initial 5260 build, before the material/UV correction recorded in the final section.

```text
384103872111378088b74e87b699771446660080f41f0757c848084627d699df  01-hangar.png
c370513e1850b90a06fe80a185cb58520551b594a34d8e8b523a742b3342d47a  02-hub.png
ce21a74503357fb32e8d3474f60262b9d1e57080196cdcc5c2a44908233754d7  01-hangar.cpuprofile
1ecaedc176b4f189438d5045eef5ffa6d7990b9c768ee1170ef64bafc8d3cf45  02-hub.cpuprofile
82d800f681a07cd69c90ef930992c9cb51fe9ff750ae9661fff54635fe9854c0  evidence.json
```

## Final stable artifact SHA-256

Sources remain under `/tmp/star-agent-station-performance-final`. Earlier source directories and manifests are unchanged.

```text
e12d59f00f60d74d81553fac9bcc9460fdaebe60c6f9f4f905532fffa47462d1  01-hangar.png
1097f3561c022608a2a8a9b51bd436970adb74d545304d4880f56e12c13ea04d  02-hub.png
489c13cc2977b6e4ee695fbb421847b6523c681a8faf609e0152623e1afdb8de  01-hangar.cpuprofile
5b8609a820c5c4534244666b58bd93575c97ef7c141fdb8daef20a1eac7c4691  02-hub.cpuprofile
63a04038230bf093a98143fb416041b803764c53d33f6e197e619f10a8d766ef  evidence.json
```
