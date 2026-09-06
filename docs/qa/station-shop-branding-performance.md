# Retail graphics cost investigation — 2026-09-06

The first slow run is retained at `/tmp/star-agent-shop-branding-performance/evidence.json`. It measured hangar GPU/CPU medians 10.717/10.1 ms and hub 12.119/8.1 ms. The preceding pre-branding release measured 8.198/6.8 and 4.205/5.3 ms. These are separate runs, not a controlled material comparison.

Reproduction:

```sh
node scripts/station-performance-check.mjs --url http://127.0.0.1:5260 --out /tmp/star-agent-shop-retail-ab --retail-comparison
```

Chromium 151.0.7922.173; ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO; OpenGL ES 3.2 backend. Viewport and drawing buffer 1440×900, DPR1, render scale1. Thirty warm rendered frames and at least60 valid asynchronous GPU elapsed queries per block. CPU callback wall time and RAF cadence are reported separately, not added to GPU time. No active CPU profiler during A/B blocks. Zero console errors/warnings, zero disjoint/invalid/unavailable/busy queries.

| Block | GPU median / p95 ms | CPU median / p95 ms | RAF median / p95 ms | Draws | Triangles |
|---|---:|---:|---:|---:|---:|
| 01-hangar | 10.687 / 11.474 | 11.700 / 14.900 | 16.700 / 16.800 | 505 | 684953 |
| 02-hub | 4.578 / 11.570 | 6.000 / 12.400 | 16.700 / 16.800 | 270 | 451606 |
| retail-01-on | 4.066 / 4.949 | 5.500 / 6.600 | 16.700 / 16.800 | 270 | 451606 |
| retail-02-off | 4.114 / 4.920 | 5.300 / 6.100 | 16.700 / 16.700 | 267 | 451002 |
| retail-03-on | 4.528 / 5.080 | 5.100 / 5.900 | 16.700 / 16.800 | 270 | 451606 |
| retail-04-off | 4.125 / 4.871 | 5.400 / 6.000 | 16.700 / 16.800 | 267 | 451002 |
| retail-05-on | 4.711 / 5.150 | 5.400 / 6.200 | 16.700 / 16.800 | 270 | 451606 |
| retail-06-off | 4.137 / 5.008 | 5.400 / 7.600 | 16.700 / 16.700 | 267 | 451002 |
| retail-07-on | 4.142 / 5.145 | 5.200 / 6.000 | 16.700 / 16.800 | 270 | 451606 |
| retail-08-off | 4.682 / 5.114 | 5.200 / 5.800 | 16.700 / 16.700 | 267 | 451002 |

The eight A/B blocks ran in one page at the unchanged central-hub fixture, alternating retail group visibility ON/OFF four times. Camera coordinates, terrain patch count and LOD were asserted stable. The toggle removes exactly3 draws and604 triangles; physical frames, furniture, shop lighting and every other station feature remain present. The first ON/OFF screenshots were actually viewed and confirm prints disappear from their still-visible frames.

Paired ON minus OFF GPU median differences: -0.047630 ms, +0.402585 ms, +0.574271 ms, -0.540426 ms. The median paired difference is +0.177478 ms. The changing sign and spread do not justify treating this small estimate as an exact material cost. This comparison does not reproduce the earlier roughly8 ms hub slowdown when the three retail batches are shown.

The canonical rerun hub median is4.578 ms GPU /6.0 ms CPU, but GPU p95 is11.570 ms and CPU p95 is12.4 ms; those slower samples remain in the record. The unchanged hangar still measures10.687 ms GPU median /11.7 ms CPU median, with the same505 draws and684,953 triangles and no retail draw. This does not establish a universal10 ms budget pass.

The first slow CPU profile attributed0.079 ms/frame of instrumented command-submission wall time to the three retail draws combined. StationComplex.update was0.565 ms/frame in the hub, with zero LOD uploads; 18 extra scene objects and3 extra compiled programs were present relative to the pre-branding release. These CPU submission numbers are not per-material GPU timings.

Limitations: another Chromium workload was observed during the initial integration investigation; its contribution is not measured or proven. No user process was stopped. GPU clocks, competing applications and station/world animation were not frozen. The A/B control addresses the new retail render group in this one view, not added Blender frames, every shop close-up or the whole game. Canonical rerun and every alternating block are retained, including slower samples. No visual/runtime code was changed in response to this investigation.

Evidence SHA-256:

- `885a9321d205e5b507d1daa5f07dc806b7ed562d5c936bfefdf55f066d502c45` — `/tmp/star-agent-shop-branding-performance/evidence.json`
- `8694c257a4ae4e23bac2e8a3fd19339c2a013ed1166ce54c4f4da294b2f84c2c` — `/tmp/star-agent-shop-retail-ab/evidence.json`
- `6aa3c69d1d536a7c311648c941f3ad35a02776ad0716d4aaea2d0bfed56a1039` — `/tmp/star-agent-shop-retail-ab/retail-comparison.json`

Only the profiling script changed: `--retail-comparison` adds the reproducible eight-block visibility experiment and writes the paired summary beside its raw evidence. The existing default profiling path is preserved. Script syntax and `git diff --check` passed; the hardware run completed successfully.
