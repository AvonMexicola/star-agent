# Kestrel: independent follow-up, round 4

**4.17 / 5 average — final gate pending. Not mergeable yet.**

Reviewed GLB SHA-256:
`2fa436d32c089b6d7ed705925ad013a1306e8e30ce56568c07604405610503b0`.
This is the final procedural candidate supplied for round 4, after the outlet
liner and view-fitting refinements. Earlier intermediate round-4 hashes were
not used for these screenshots.

The previous blank MFDs, ladder/hull intersection, opaque afterburners, hidden
engine light and obstructed inspection framing are resolved in the captured
views. The surfaces are substantially cleaner. The remaining major quality gap
is the manufactured finish, particularly the broad armour and cockpit. The
required Meshy texturing step is also still pending; procedural maps remain the
accurate provenance. This score judges the existing appearance independently of
that separate recipe requirement.

| Criterion | Score | Captured result |
|---|---:|---|
| 1. Silhouette and scale | 4.5 | The long nose, blended shoulders, canted fins and paired drives retain the approved silhouette. The new ladder is a visible stowed accessory, but does not overwhelm the primary shape. |
| 2. Materials and detail | 3.5 | Petals and panel surfaces are much cleaner, with readable metal, dark structure and mint livery. Broad armour, fin faces and cockpit surfaces still have weak variation at inspection distance; the small markings and finish do not yet carry the intended hero-asset quality. |
| 3. Lighting and integration | 4.0 | The asset sits convincingly in the ACES studio. Engine light is visible and the AB no longer casts a solid shadow. Low-throttle mint-to-white progression is subtle, and the full-throttle plume is faint. Studio integration only is assessed. |
| 4. Cohesion | 4.0 | White armour, graphite, metal, mint lights, amber mechanism markings and the studio typography remain consistent with the faction. |
| 5. Function | 4.5 | All four MFDs display the appropriate inspection information. Keyboard and touch controls, interlocks, named mechanisms and reversible endpoints work. The deployed ladder provides a clear route outside the shoulder. |
| 6. Motion | 4.5 | The bridge swings out before the three sections unfold; each descending sweep stays visibly outboard. The reverse sequence is coherent. Canopy and gear complete their cycles without observed popping in this short inspection. |

The fighter-specific target is >= 4.2 overall with nothing below 4. The current
material score misses that gate. A later material candidate needs a fresh review;
completing a tool step alone does not automatically raise the score. Live flight,
weapons and playable navigation integration remain outside this asset-only PR.

## Follow-up on the five previous blockers

| Round-3 finding | Round-4 disposition and evidence |
|---|---|
| Ladder passes through the shoulder | **Closed for the observed sweep.** [Bridge swing](ladder-bridge-swing.png), [upper section](ladder-upper-fold.png), [middle section](ladder-middle-fold.png), [lower section](ladder-lower-fold.png) and [deployed](ladder-deployed.png) show an outboard route. The [reverse pose](ladder-return.png) is coherent. |
| MFD_3/4 are blank | **Closed.** All four screens show content in the [desktop cockpit](desktop-cockpit.png) and [phone cockpit](phone-cockpit.png). The independent [binary audit](asset-audit.json) confirms +Z normals and consistent winding/UVs for all four. |
| Solid AB cones and hidden engine emitters | **Closed as defects; further polish below.** [Full throttle](engine-100.png) has faint transparent plumes with no pointed solid shadows. The [rear close view](diagnostic-rear-detail.png) shows the luminous outlet liner and visible deep core where the viewing angle allows it. [Straight rear at zero](diagnostic-straight-rear-0.png), [35%](diagnostic-straight-rear-35.png), [68%](diagnostic-straight-rear-68.png) and [100%](diagnostic-straight-rear-100.png) show the actual progression. |
| Stippling/overlapping petals and unfinished surface treatment | **Artifacts substantially resolved; finish remains open.** The [rear close view](diagnostic-rear-detail.png) has clean, separated petal faces instead of the prior striped overlap. [Exterior](desktop-exterior.png), [planform](desktop-top.png) and [cockpit](desktop-cockpit.png) preserve the current finish for the material follow-up. The earlier diagnostics did not uniquely isolate albedo from geometry; this review does not retroactively claim that they did. |
| Planform and open mechanism are hidden by controls/canvas edges | **The named problems are closed.** [Desktop planform](desktop-top.png), [open canopy](canopy-open.png), [deployed ladder](ladder-deployed.png), [phone planform](phone-top.png) and [phone deployment](phone-deployed.png) keep the inspected shape above the controls. Phone boarding intentionally crops unrelated nose/wing extremities while fitting the mechanism. |

## Ranked remaining work

1. **Finish the exterior material pass.** `assets/kestrel/textures/`,
   `blender/materials.py`, `blender/pack_fighter_textures.py`.
   Preserve the clean white faction palette and use restrained, localized
   roughness variation, access-panel edge wear, nozzle heat/service marks and
   readable maintenance/squadron markings. The broad shoulder, dorsal cowl and
   fin faces currently depend mostly on shape and uniform light response.
   Keep clean resting areas between details. Use the required Meshy texture pass
   on the recorded UV layout, then inspect the packed 1024 maps in WebGL. This
   is the main remaining gate item, not a request to cover every white surface
   with grime.

2. **Give the engine states more visual range.** `src/kestrel.js`,
   `afterburnerMaterial` and the core's emissive interpolation.
   [Zero](engine-0.png), [35%](engine-35.png) and [68%](engine-68.png) are now
   distinguishable, but remain close to pale mint/white. Keep more mint at the
   low end and reserve the brightest white for high thrust. A modestly stronger
   plume root with the existing axial fade would make full thrust easier to
   read. Preserve transparency, logarithmic depth and disabled AB shadows.
   This is polish; the former opaque-cone defect is closed.

3. **Give cockpit contact surfaces a more specific finish.**
   `blender/fighter_detail.py`, cockpit material assignments and texture pass.
   In [the pilot view](desktop-cockpit.png), the pale footwell, side trays,
   pedals and control blocks remain simple and similar in response. Separate
   grip rubber, coated console panels and worn metal contact faces; add a few
   legible control legends where they help the pilot read the equipment.
   Keep the four functional canvases intact. On the phone, an optional focused
   MFD view would help inspect small text without changing the seated eye.

4. **Finish the ladder mounting hardware without changing the successful sweep.**
   `blender/fighter_detail.py`, fixed sill step and `Ladder` bridge root near
   (-0.90, 2.25, -1.75). The deployed arrangement now reads as a credible
   bridge and folding ladder. A visible pivot housing, latch/stop and a compact
   stow cradle would make the attachment look more deliberately manufactured
   in [the closed view](desktop-boarding.png). This is a detail recommendation,
   not a renewed hull-clearance failure.

5. **Give the underside fin tip some framing margin.**
   `src/kestrel-studio.js`, underside pose. In
   [desktop Underside](desktop-belly.png), the highest fin vertex is only
   0.12 px below the top canvas edge. It is technically inside, but looks cut
   against the border. The independent [CPU vertex projection](underside-projection.json)
   confirms this distinction. Add about 20 px of breathing room, following the
   safe-rectangle approach already used for planform and boarding.

## Ladder clearance evidence and limits

The browser evidence records actual poses before and after every screenshot.
The four deployment-phase captures span progress 0.185-0.269, 0.444-0.491,
0.676-0.732 and 0.907-0.963 respectively; the joints demonstrably change rather
than remaining in the resting pose. The bridge root is at x = -0.90, the upper
ladder hinge is at x = -1.74, and the lower sections unfold farther outboard
before settling vertically. The feet appear on the ground in the endpoint
captures. This sequence looks physically credible at the inspected angles.

For corroboration, I read the corrected builder clearance report, copied here
as [builder clearance evidence](builder-clearance-evidence.json). It records
55 export frames, changing sampled joint rotations and 69,960 moving-mesh edge
queries against static ship triangles with zero reported intersections. Its
documented 2 mm endpoint tolerance and intended sill/open-canopy exclusions
apply. I did not independently rerun that Blender collision calculation. This
is finite edge sampling, not continuous or moving-against-moving collision
certification. The earlier resting-pose checker result was invalidated and is
not used as evidence in this review.

## Independent verification

- Production studio: `http://127.0.0.1:5292/dev/kestrel.html`.
- Chromium 151.0.7922.173; AMD Radeon 860M through ANGLE OpenGL ES 3.2/radeonsi.
  Desktop 1440 x 900; phone viewport 390 x 844, with an approximately 390 x 523
  scene canvas and a scrolling control area. No performance/FPS gate is claimed.
- Took and inspected 33 fresh PNGs: all six presets at both sizes, canopy
  intermediate/end poses, all ladder deployment stages and a reverse pose,
  gear movement/endpoints, and rear-quarter/straight-rear engine states.
  [Browser evidence](browser-evidence.json) includes real mechanism progress,
  local/world poses, MFD corner projections, backend, draw counts and errors.
- The independent keyboard/touch sequence passed in 40.7 s, 43.7 s including
  runner startup. Zero browser page errors or console warnings/errors. The
  asset hash was unchanged across the sequence. Node's runner emitted its
  unrelated NO_COLOR/FORCE_COLOR environment warning outside the browser.
- Independently parsed the frozen GLB: 36,226 triangles, 2,305,008 bytes,
  45 meshes, six materials and three 1024 x 1024 WebP images. Named animation
  channels and all four screen normals/UVs are recorded in the
  [binary audit](asset-audit.json).
- Builder reports all 17 numerical test files, production build and five
  browser cases passing. Those complete suites were not independently rerun
  here. Physical-controller and performance evidence remain builder-owned;
  this reviewer independently exercised keyboard and touch.
- Reviewer changed only `docs/qa/kestrel/reviewer/round-4/` and
  `/tmp/kestrel-review*`. Runtime camera overrides affected only the review
  browser. No builder source or asset bytes were changed. The prior failed
  review remains preserved in round 3.

## Scoped follow-up: underside framing closed

After the builder applied safe-rectangle fitting to the underside preset, I
independently captured and inspected [the updated desktop view](desktop-belly-followup.png)
at 1440 x 900. The highest fin vertex now has **84.4 px of top margin**, compared
with 0.12 px in the original capture. Projection of all 53,193 vertices under
visible mesh nodes gives bounds x = 391.0-894.4, y = 84.4-434.1 px; the controls
begin at y = 696 px. The complete inspected model clears the canvas edges and
controls. Ranked item 5's desktop underside framing request is closed.

The focused independent check passed in 4.5 s, 5.4 s including startup, on the
same Chromium 151 / AMD Radeon 860M ANGLE backend. There were zero browser page
errors or console warnings/errors. [Follow-up evidence](underside-followup-evidence.json)
records the live camera, actual vertex projection and unchanged GLB SHA-256
`2fa436d32c089b6d7ed705925ad013a1306e8e30ce56568c07604405610503b0`.

This closure covers desktop underside framing only. The original screenshot,
original evidence and rubric scores remain preserved: **4.17 / 5 overall,
materials 3.5 / 5, final material/Meshy gate still pending.** No additional
asset, motion, phone or performance approval is implied.
