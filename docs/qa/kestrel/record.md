# Kestrel candidate record — 2026-09-06

**Draft; material gate pending.** The required Meshy texture pass has not run.
Current maps are Blender procedural bakes and are labelled that way in the
provenance. The upload-ready mesh and planned prompt exist; browser file upload
is blocked by the extension's file-URL permission. No Meshy generation or credit
spend is claimed. Final appearance must be reviewed again after texturing.

Current GLB: `2fa436d32c089b6d7ed705925ad013a1306e8e30ce56568c07604405610503b0`.
36,226 triangles, 2,305,008 bytes, 45 meshes, six materials, three 1024² WebP maps.
UV layout: `91899f96b0de0221e206455e5c46659f0768a3d9a9e71c78bc674d6e80389b6d`.
The asset remains under `assets/kestrel/`, pending intake approval.

## Independent visual gates

| Round | Result | Evidence |
|---|---|---|
| 1: silhouette | 3.8/5, failed | [Review](reviewer/round-1/review.md); original EEVEE angles in `round-1/` |
| 2: rebuilt silhouette | 4.5/5, passed before detail | [Review](reviewer/round-2/review.md); original EEVEE angles in `round-2/` |
| 3: first detailed candidate | 3.42/5, failed | [Review](reviewer/round-3/review.md), including 29 independent captures |
| 4: corrected procedural candidate | 4.17/5, material score 3.5 | [Review](reviewer/round-4/review.md), including 33 independent captures |

Round 3 found real defects despite passing control tests: reversed side-screen
faces, a ladder through the shoulder, solid afterburners, occluded engine light,
surface artifacts and cropped mechanisms. Round 4 confirms the four live MFDs,
outboard ladder sequence, cleanly separated exhaust petals, visible engine
liners, transparent plumes and clear desktop/phone mechanism framing. Materials
remain below the required 4/5 minimum. The overall fighter target is 4.2/5.

The final small underside-camera adjustment adds the same safe-rectangle fit
used by planform/boarding. A focused hardware browser tour after that adjustment
passed and verified actual GLB vertices above the controls. An independent
follow-up also passed: the highest fin has 84.4 px of top margin, and all visible
vertices clear the controls at 1440×900. Its capture and scoped closure are in
the round-4 review. Original captures and scores remain preserved.

## Functional and rendering checks

- Node v26.7.0: all 17 files in `npm test` passed. The new GLTFLoader checks use
  actual binary data, named transforms, scale/ground datum, animation endpoints,
  gear clearance, emitted-light line of sight, screen winding and ladder bounds.
- Production Vite build passed. Its existing large-chunk advisory remains; this
  is distinct from browser console warnings. No new dependency was added.
- All five Chromium interaction cases passed on the final GLB: six views,
  reversible mechanisms/interlocks, injected controller neutral/focus guards,
  phone touch and keyboard reach. Final hardware suite: 38.6 s. The later focused
  view tour passed in 4.8 s after the underside framing adjustment.
- Browser: Chromium 151.0.7922.173; AMD Radeon 860M, ANGLE OpenGL ES 3.2/radeonsi.
  Builder tours: 1600×900 and 390×844. Independent tours: 1440×900 and 390×844.
  Recorded browser page errors, console errors and console warnings: zero.
- The earlier procedural iteration also passed all five cases on ANGLE Vulkan
  SwiftShader. Hardware-controller testing has not been performed; the test
  controller is injected. The reviewer independently exercised keyboard/touch.
- Blender 5.2.0 LTS authored, baked and exported the mesh. The host's optional
  remote-asset add-on reports a missing `cattrs` module on startup; local geometry,
  baking and export completed. No machine configuration was changed to address it.

The asset-only page does not change the game's orbit/surface/hangar scenes. This
PR does not claim a full integration-world tour or working fighter navigation.

## Ladder and atlas diagnostics

`blender/check_fighter_clearance.py` evaluates action slots at all 55 exported
frames. The corrected candidate performs 69,960 moving-edge queries against
static triangles with no crossings. A separate guard verifies that joint angles
actually change. The earlier version of this checker accidentally stayed in the
resting pose; its result was invalidated. Rechecking the prior failed asset with
the corrected evaluator reports intersections in every sampled frame.

This is finite edge sampling with a 2 mm endpoint tolerance. The intended sill
contact and open canopy are excluded; it is not continuous or self-collision
certification. Independent live captures also inspect the staged deployment.

UV raster sampling found no overlapping islands, but the original scaled margin
left only 67,203 covered texels (6.4% of a 1024² map). A precise final-atlas margin
of .002 increased coverage to 439,325 texels (41.9%). Two-pixel bake padding and
neutral unused normal/AO pixels replace the earlier sparse atlas. Exhaust petals
also moved outward to clear their underlying envelope. Bake operations now use
one temporary joined copy, preserving source objects and their UVs afterward.

## Hardware rendering cost

1440×900, pixel ratio 1, Chromium 151, AMD Radeon 860M / ANGLE OpenGL ES 3.2.
120 asynchronous `EXT_disjoint_timer_query_webgl2` samples per viewpoint after
warmup; no disjoint events. CPU timing covers `renderer.render` only, excluding
other animation-loop work. The observed RAF pacing is about 16.7 ms.

| View | Draws | Triangles | GPU median / p95 | CPU render median / p95 |
|---|---:|---:|---:|---:|
| Exterior | 46 | 36,480 | 1.84 / 2.21 ms | 0.80 / 1.50 ms |
| Cockpit | 22 | 26,364 | 3.19 / 3.96 ms | 0.70 / 1.20 ms |

These measured render costs fit the isolated studio budget. They do not predict
FPS after hangar, flight, terrain or combat integration. The performance script
is retained in `scripts/kestrel-performance.spec.js` for the later textured asset.
