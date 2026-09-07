# Kestrel: direct Meshy material import, round 5

**4.00 / 5 average — FAIL. Mergeable: no.**

Reviewed frozen GLB SHA-256:
`584ec536bd5b369dfca08337728220bc5f3dbdbc9884e4a3a9da6c3bfb91e2df`.

The Meshy maps are present on the original animated rig. The import preserves
the successful shape and repaired mechanisms, but the direct material result
needs refinement. Broad cloudy colour streaks make smooth armour look rippled;
several mint and amber cues have disappeared, and cockpit/material boundaries
have become less deliberate. Completing the Meshy step does not make this
appearance pass the fighter's quality bar.

This report preserves the direct import before the builder's later material
mixing work. It does not assess a subsequently repacked or rebuilt candidate.

| Criterion | Score | Assessment of this captured candidate |
|---|---:|---|
| 1. Silhouette and scale | 4.5 | The approved long nose, blended shoulders, swept wings, canted fins and twin drives remain intact. The original mesh and rig data are unchanged. |
| 2. Materials and detail | 3.0 | There is more surface information, but broad cloudy albedo strokes, streaked rims and soft markings weaken the manufactured finish. Ceramic, polymer and metal regions have lost some of their earlier distinction. |
| 3. Lighting and integration | 4.0 | The ACES studio, contact shadows, visible engine throats and transparent AB still work. The previously noted subtle low-throttle range and faint plume remain polish items. The imported surface streaking is charged to materials. |
| 4. Cohesion | 3.5 | The overall white/dark ship and studio still belong together, but the authored mint wing bands, amber rung/gear/control markings and some graphite regions have been washed out or repainted. |
| 5. Function | 4.5 | Four live MFDs, keyboard/touch controls, interlocks and reversible mechanisms work. Boarding still provides a clear outboard ladder route. |
| 6. Motion | 4.5 | The bridge and three ladder sections move through their staged outboard sequence and reverse coherently. Canopy and gear complete their cycles without a newly observed motion defect. |

The brief requires >= 4.2 overall and no item below 4. Materials and cohesion
miss that requirement. The prior functional repairs remain closed. The next
material candidate needs its own visual review; this failure does not require
reopening the approved geometry or restarting the Meshy upload.

## Ranked fixes

1. **Remove the broad colour-map streaks while retaining useful local wear.**
   `blender/pack_fighter_textures.py`, `assets/kestrel/textures/`.
   See [front material detail](diagnostic-front-material.png) and
   [rear detail](diagnostic-rear-detail.png), especially the long cowl sides,
   wing leading strips and dorsal spine. Smooth panels look cloudy or rippled
   because large grey strokes are embedded in the imported colour map. Use
   the authored ceramic base and selectively mix Meshy wear around actual
   service edges, recesses and fasteners. Suppress the broad shading-like
   patches and stretched edge streaks; keep large armour areas clean. The
   diagnostic below identifies albedo as the main source of this problem.

2. **Restore the intended material placement and faction accents.**
   `blender/fighter_detail.py`, material/part masks used during texture packing.
   Compare [this planform](desktop-top.png) with
   [the procedural planform](../round-4/desktop-top.png). The mint sweep bands
   have become almost white/grey. In [the deployed view](ladder-deployed.png),
   the amber rung cues and gear warning flashes have also faded to grey.
   Preserve the authored ivory, graphite, brushed metal, mint and amber regions
   as explicit masks, then add texture within those regions. This applies to
   the cockpit controls and dark drive/underside structure as well as livery.

3. **Make cockpit and nozzle finishes read as their actual materials.**
   `blender/pack_fighter_textures.py`, cockpit and nozzle atlas regions.
   [The cockpit](desktop-cockpit.png) has cloudy side-wall/footwell patches,
   pale structural rails and weak separation between pedals, console panels,
   grips and seat. [The exhaust close view](diagnostic-rear-detail.png) shows
   a mottled pale outlet rim that reads less clearly as machined metal than
   the previous finish. Retain an authored roughness/metalness baseline for
   each material class; add restrained wear and fine directional texture.
   Restrict cockpit grime to contact/recess areas and keep the four MFD faces
   intact. The broad streak diagnosis does not implicate normal maps, so avoid
   treating a global normal-strength adjustment as the complete fix.

4. **Keep identifiers and service markings deliberate and legible.**
   `blender/fighter_detail.py`, final decal/stencil layer and atlas packing.
   In [planform](desktop-top.png), small generated symbols and patchy hatch
   colouring provide less clear information than the earlier authored
   Kestrel/service graphics. Restore exact identifiers, serials and service
   labels over the refined finish, with consistent scale and orientation.
   Check their actual 1024-map appearance at the inspection view; soft graphic
   noise should not substitute for a readable marking. Keep enough clear space
   around vents, fasteners and panel boundaries to preserve their shape.

5. **Retain the engine-state polish item from round 4.** `src/kestrel.js`.
   [Zero](engine-0.png), [35%](engine-35.png), [68%](engine-68.png) and
   [full throttle](engine-100.png) still have a narrow pale-mint/white range
   before the faint AB appears. Preserve more mint at low thrust and make the
   plume root a little easier to read while retaining its fade, transparency,
   logarithmic depth and disabled shadows. This is secondary to the material
   and cohesion failures; the old solid-cone defect remains fixed.

## Material diagnostic

I captured five views from the same closer front-quarter camera, changing only
the review browser's material settings:

| Temporary setting | Result |
|---|---|
| [Original maps](diagnostic-front-material.png) | Broad cloudy cowl and wing-edge streaks are visible. |
| [Normal map disabled](diagnostic-front-normal-off.png) | The broad streaks remain essentially unchanged. |
| [Roughness/metalness flattened](diagnostic-front-orm-flat.png) | Original albedo, normal and AO remain; the broad streaks persist. |
| [Albedo with normal/AO disabled and flat roughness/metalness](diagnostic-front-albedo-only.png) | The broad streak pattern persists. |
| [Albedo also removed](diagnostic-front-neutral.png) | The streaks disappear and the underlying smooth shape is visible. |

The comparison identifies the imported albedo appearance as the primary source
of this candidate's broad streaking. It does not prove that every small mark is
an albedo defect, or that every other PBR channel is ideal. The closer diagnostic
intentionally crops extremities to inspect surfaces; it is not a studio framing
regression. [Diagnostic evidence](diagnostic-evidence.json) records each override.
No exported material, source map or builder scene was edited by the reviewer.

## Previously fixed mechanisms and framing

- All four MFDs render in the [desktop](desktop-cockpit.png) and
  [phone cockpit](phone-cockpit.png). Screen winding and UV data remain correct.
- [Bridge swing](ladder-bridge-swing.png), [upper fold](ladder-upper-fold.png),
  [middle fold](ladder-middle-fold.png), [lower fold](ladder-lower-fold.png),
  [deployment](ladder-deployed.png) and [return](ladder-return.png) preserve
  the credible outboard sequence. Actual progress and joint poses are recorded
  around each screenshot. No new shoulder crossing is visible.
- [Canopy intermediate](canopy-60.png), [canopy open](canopy-open.png),
  [gear retracting](gear-retracting.png) and [gear stowed](gear-stowed.png)
  preserve the reviewed mechanism behaviour. Interlocks reject a closed-canopy
  ladder deployment and canopy closing while the ladder is out.
- Engine emitters are visible at a rear angle and in the
  [straight rear zero-throttle view](diagnostic-straight-rear-0.png).
  The [full-throttle straight rear view](diagnostic-straight-rear-100.png) and
  rear-quarter capture retain transparent AB without solid cone shadows.
  Petal geometry still has its corrected clearance; the new mottling is a
  material issue.
- Planform, boarding and the previously corrected underside framing remain
  clear of controls. See [desktop underside](desktop-belly.png),
  [phone underside](phone-belly.png), [phone planform](phone-top.png) and
  [phone boarding deployment](phone-deployed.png). Phone boarding deliberately
  crops unrelated nose/wing extremities to show the mechanism.

## Independent verification and provenance

- Production studio at `http://127.0.0.1:5292/dev/kestrel.html` was frozen during
  captures. Chromium 151.0.7922.173; AMD Radeon 860M via ANGLE OpenGL ES 3.2 /
  radeonsi. Desktop 1440 x 900; phone viewport 390 x 844, scene canvas about
  390 x 523 with a scrolling control area. No FPS/performance gate is claimed.
- Took and inspected **38 fresh PNGs**: the 33-view appearance/mechanism tour and
  five additional material diagnostics. The keyboard/touch tour passed in
  33.7 s, 36.9 s including runner startup; diagnostics passed in 5.6 s,
  6.2 s including startup. Zero browser page errors or console warnings/errors.
  Node's NO_COLOR/FORCE_COLOR warning was outside the browser.
- [Browser evidence](browser-evidence.json) records mechanism progress,
  local/world poses, MFD corner projections, backend and draw counts. The GLB
  hash remained unchanged across the tour. A frozen local review copy was also
  retained before the builder resumed material work.
- The [binary audit](asset-audit.json) independently confirms 36,226 triangles,
  2,456,352 bytes, 45 meshes, six materials and three 1024 x 1024 WebP images,
  all within the ship budget.
- The independent [rig comparison](rig-comparison.json) compares this GLB to
  procedural commit `5c0cffd`, whose GLB hash is the round-4 candidate
  `2fa436d32c089b6d7ed705925ad013a1306e8e30ce56568c07604405610503b0`.
  All 45 mesh accessor payloads, including positions, normals, UVs and indices,
  match exactly. All 81 node names, transforms, hierarchy and extras match;
  all three animation payloads match. The approved rig was preserved.
- [Source-map verification](source-map-verification.json) preserves the Meshy
  source record and independently checks the hashes and sizes of its three
  original JPEG maps. Those checks match. The builder's recorded generated-mesh
  UV correspondence covers 47,024 / 47,024 vertices with maximum error
  1.2517e-6; that generated-mesh correspondence was not independently rerun.
  Runtime UV identity was independently verified as described above.
- The inspected packing provenance uses Meshy colour, normal, roughness and
  metalness with Blender contact AO. The previous missing-Meshy step has been
  addressed. The final visual gate remains open because of the captured result.
- Builder reports all 17 numerical test files, production build and five
  hardware browser cases passing. Those complete suites and physical-controller
  input were not independently rerun here. Live flight, weapons and playable
  navigation integration remain outside this asset-only review.
- Reviewer wrote only `docs/qa/kestrel/reviewer/round-5/` and
  `/tmp/kestrel-review*`. Prior review evidence is preserved. No builder source
  or asset was changed, and no merge or final quality approval is given.
