# Kestrel candidate record — 2026-09-07

**Ready for Cees's PR gate; independent visual review passed at 4.25/5.**
The Meshy pass succeeded after Cees
uploaded the cleaned shell. Meshy 7 generated 2K PBR maps at a displayed cost of
10 credits. Cees supplied the completed export. Generated
maps have been verified against the authored UVs and applied to the original
animated rig. Round 5 rejected the direct import's finish. Round 6 passes the
material mix that restores authored regions and filters generated wear; no
criterion is below 4. No merge, gameplay integration or public intake is implied.

Current GLB: `ef42a970295f0db8535fdd08aa6f8b2385243545891f512816392befdbaed374`.
36,226 triangles, 2,330,924 bytes, 45 meshes, six materials, three 1024² WebP maps.
UV layout: `91899f96b0de0221e206455e5c46659f0768a3d9a9e71c78bc674d6e80389b6d`.
The asset remains under `assets/kestrel/`, pending intake approval.

## Independent visual gates

| Round | Result | Evidence |
|---|---|---|
| 1: silhouette | 3.8/5, failed | [Review](reviewer/round-1/review.md); original EEVEE angles in `round-1/` |
| 2: rebuilt silhouette | 4.5/5, passed before detail | [Review](reviewer/round-2/review.md); original EEVEE angles in `round-2/` |
| 3: first detailed candidate | 3.42/5, failed | [Review](reviewer/round-3/review.md), including 29 independent captures |
| 4: corrected procedural candidate | 4.17/5, material score 3.5 | [Review](reviewer/round-4/review.md), including 33 independent captures |
| 5: direct Meshy import | 4.00/5, material score 3.0, cohesion 3.5 | [Review](reviewer/round-5/review.md), including 38 independent captures and an albedo diagnostic |
| 6: refined Meshy/Blender finish | 4.25/5, every criterion ≥4, passed | [Review](reviewer/round-6/review.md), including 34 independent captures and a binary/source comparison |

Round 3 found real defects despite passing control tests: reversed side-screen
faces, a ladder through the shoulder, solid afterburners, occluded engine light,
surface artifacts and cropped mechanisms. Round 4 confirms the four live MFDs,
outboard ladder sequence, cleanly separated exhaust petals, visible engine
liners, transparent plumes and clear desktop/phone mechanism framing. Materials
were still below the required 4/5 minimum in rounds 4 and 5. Round 6 clears that
minimum and the overall fighter target of 4.2/5.

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
  phone touch and keyboard reach. Refined material candidate hardware suite:
  41.7 s. This includes the material mix and revised engine glow/plume range.
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

Final textured candidate `ef42a970…`, tested after independent capture release.
1440×900, pixel ratio 1, Chromium 151, AMD Radeon 860M / ANGLE OpenGL ES 3.2.
120 asynchronous `EXT_disjoint_timer_query_webgl2` samples per viewpoint after
warmup; no disjoint events. CPU timing covers `renderer.render` only, excluding
other animation-loop work. No page/console warnings/errors occurred; the test
passed in 12.3 s, 13.4 s including runner startup.

| View | Draws | Triangles | GPU median / p95 | CPU render median / p95 |
|---|---:|---:|---:|---:|
| Exterior | 46 | 36,480 | 3.31 / 3.98 ms | 1.50 / 4.20 ms |
| Cockpit | 22 | 26,364 | 5.97 / 7.68 ms | 1.20 / 3.40 ms |

GPU rendering costs are below 10 ms in the sampled run. Instrumented RAF pacing
was variable: exterior median 17.0 ms, p95 43.5 ms, maximum 56.6 ms; cockpit
median 17.1 ms, p95 56.3 ms, maximum 83.9 ms. These measurements do not establish
stable FPS or a complete frame-budget pass. They do not predict costs after
hangar, flight, terrain or combat integration. The reproducible performance
script is retained in `scripts/kestrel-performance.spec.js`.

## Manual upload failure and conservative retry

Cees reported a generic "Texturing failed" response after manual upload with
Keep Original Texture and UV enabled. No Meshy error code or specific cause was
available. The original upload GLB is 2,560,732 bytes, one mesh/primitive, one
material, one 1024² 8-bit RGB PNG and one UV set, without animations or extensions.
Its SHA-256 is `6211ea3111e122f8ac0d3457635607305e84408df62eb0abfc88d2f724b714ea`.
Khronos glTF Validator 2.0.0-dev.3.10 reports zero errors, warnings, information
messages or hints. A valid glTF file can still fail Meshy's processing; this
result does not identify the remote cause.

An additional triangle-area check found 24 zero-area geometric fragments and
78 triangles with negligible/collapsed UV area. `blender/clean_meshy_upload.py`
excludes the union (78) from the temporary painting shell, reducing it from
34,886 to 34,808 triangles. The excluded surface totals 0.0118814 m² out of
358.608 m²; almost all of that is one collapsed-UV cockpit face. This is a
conservative ingestion experiment, not a claim that the authored rig's UV
defects or Meshy's failure are repaired. No UV island is moved or repacked.

Retry file: `assets/kestrel/kestrel-meshy-clean.glb`, 2,560,264 bytes, SHA-256
`8ae571172e149a8c0a831abc743c35aea24f0f6b4352c4a2f639e3407d8b8282`.
An independent Node byte comparison confirms unchanged position, normal, UV and
image buffers. Khronos validation again reports zero issues. Cleaning the result
a second time excludes zero triangles and produces identical bytes. Detailed
local diagnostics are under `/tmp/kestrel-upload-validator-*.json` and
`/tmp/kestrel-meshy-clean*.json`; generated diagnostic reports are not committed.
Runtime GLB hash, reviewed images, budget and visual score remain unchanged.
That was the state before the successful retry described below.

## Successful Meshy import and first textured candidate

Cees confirmed the cleaned upload was accepted; the Meshy viewer identified
`kestrel-meshy-clean`. Meshy 7 Text Input, PBR maps enabled and 2K resolution were
used with the exact 730-character prompt retained in the texture directory.
The completed export is `Meshy_AI_kestrel_meshy_clean_0906215631_texture.glb`,
9,428,476 bytes, SHA-256
`41684db25a765f3dcabfa6b8a7af09e56309bd65bfee64eff1a21ea02436343b`.
This static third-party export is an intermediate texture source, not the
runtime fighter. The original animated geometry is retained.

`blender/import_fighter_textures.py` compares each returned position/UV pair with
the uploaded shell after restoring Meshy's center and normalization scale. All
47,024 returned vertices match, maximum UV error 1.2517e-6 (about 0.0013 pixels at
1024²). No V flip is needed. The generated export contains 34,768 triangles;
Meshy's additional import cleanup is not carried into the 36,226-triangle rig.

The original 2048² base-colour, metallic/roughness and normal JPEGs are retained
under `assets/kestrel/textures/meshy-source/`, with hashes and metadata in
`source.json`. Import downsamples to 1024², renormalizes normals and separates
glTF G roughness / B metallic channels. Packing retains Blender's contact AO.
No signed download token or authentication data is retained in the repository.

On the first textured GLB (`584ec536…`), all 17 unit test files, the production
build and all five hardware Chromium cases pass (37.7 s), with zero recorded
browser errors/warnings. Builder desktop1600×900 and phone390×844 captures were
inspected. Independent round 5 scored 4.00/5 and rejected the finish: disabling
normal, roughness/metalness and AO did not remove broad cowl streaks; removing
albedo did. Authored mint, amber and graphite regions had also been weakened.
The original captures and diagnostic remain in its review directory.
The final material candidate was profiled separately after review captures;
its results appear in the hardware rendering section above.

## Refined material regions and engine range

The refined packer derives eight semantic regions from the original Blender
material assignments, checks the unchanged UV-layout hash, and rasterizes
439,328 covered texels plus two-texel margins. It restores the intended base
colours and exact authored markings. A local high-frequency Meshy colour filter
retains bounded service detail while removing broad cloudy shading. Ceramic and
polymer remain predominantly dielectric; rubber stays matte; titanium retains
stronger metalness and directional roughness. All receive restrained generated
roughness/metalness variation. Authored bevel normals are combined with weaker
generated tangent detail. Raw generated source maps are preserved unchanged.
The complete numeric recipe and source hashes are in texture provenance.

Engine liners now use a darker diffuse baseline and retain mint at low thrust,
reserving a stronger white mix for high thrust. Transparent AB roots are a little
stronger, retaining the axial/rim fade, log depth and disabled shadows. This is
inspection-only emission; no thrust or flight behaviour is connected.

On `ef42a970…`, all 17 test files pass, the production build passes (2.12 s) and
all five hardware Chromium cases pass (41.7 s), with zero recorded browser
errors/warnings. Independent round 6 passes at 4.25/5, with scores 4.5 / 4 / 4 /
4 / 4.5 / 4.5. All 34 reviewer captures were inspected. Its independent binary
comparison confirms all 45 mesh payloads, 81 node records and three animation
payloads are identical to the approved procedural rig; all 12 recorded map-source
hash/size comparisons also match. The reviewer assesses the studio asset only;
performance, physical traversal and gameplay integration are separate concerns.
