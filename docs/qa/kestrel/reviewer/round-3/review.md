# Kestrel: preliminary full asset review, round 3

**3.42 / 5 average — FAIL. Not ready for merge or recipe completion.**

Reviewed GLB SHA-256:
`e24f17b4479fbd5640a90d4bb92e8e64c570aa8cce45ae9429e9b58f08ee5c76`.
The silhouette remains successful, and the studio loads and operates without
browser errors. The captured asset nevertheless has two blank MFDs, a ladder
that intersects the hull, opaque afterburner solids, hidden engine emitters and
unfinished surface presentation. Fixes being prepared after these captures do
not change this candidate's score.

Meshy texturing is explicitly pending. The texture provenance correctly says
Blender procedural only. This review assesses the appearance that exists; it
does not approve the required Meshy step or waive the later full review.

| Criterion | Score | Assessment of the captured candidate |
|---|---:|---|
| 1. Silhouette and scale | 4.5 | The approved long nose, low canopy, swept wings, canted fins and twin drives survive the detail pass. |
| 2. Materials and detail | 3.0 | Useful gear, cockpit, vents and nozzle hardware exist, but large surfaces still read as plain white panels. Black stippling, harsh edge marks and inconsistent small details weaken the manufactured finish. |
| 3. Lighting and integration | 3.0 | The ACES studio grounds the ship with shadows, but the afterburners look like solid white objects and cast solid shadows. The intended inner engine light is not visible. This score covers studio integration only. |
| 4. Cohesion | 4.0 | White armour, graphite structure, mint accents, amber mechanisms and typography fit the faction and existing product. |
| 5. Function | 3.0 | Named assemblies, interlocks, dimensions and live canvases are present. Half the canvases face away from the eye, and the deployed ladder has no clear route around the shoulder. |
| 6. Motion | 3.0 | Canopy, gear and ladder complete reversible cycles. The ladder's sweep/deployed position penetrates the hull, so that mechanism is not physically credible yet. |

The target is >= 4.2 overall with every item >= 4. This candidate misses both
conditions. Live flight, weapons and playable boarding integration are outside
this asset-only review and have not reduced its score.

## Ranked fixes

1. **Route the ladder outside the shoulder before it descends.**
   `blender/fighter_detail.py`, `Ladder`, `Ladder_Middle`, `Ladder_Lower`.
   [Deployed desktop view](ladder-deployed.png) and
   [phone view](phone-deployed.png) show the upper ladder disappearing into the
   white shoulder and emerging from the underside. The end-pose root
   (-0.67, 2.02, -1.75) to first hinge (-0.89, 1.38, -1.75) descends through the
   rolled shoulder. Add an outboard deployment bridge or offset before the
   descending sections; the run needs to clear the shoulder near |x| ~ 1.3 at
   z = -1.75. Check the complete swept envelope, not only the y = 0 foot datum.
   [25%](ladder-25.png) and [60%](ladder-60.png) captures preserve the current
   motion. This is an asset clearance defect, independent of future navigation.

2. **Correct MFD_3 and MFD_4 face winding at the source.**
   `blender/fighter_detail.py`, screen mesh creation. In
   [the cockpit](desktop-cockpit.png), both side displays are blank dark faces.
   Binary inspection confirms their normals are -Z, while MFD_1/2 are +Z. The
   original double-sided glTF material hides this from a basic ray test; the
   runtime canvas material is one-sided. Preserve the explicit screen winding
   and UV order through Blender normal recalculation/export, and validate each
   screen's normal against PilotEye. Do not treat a double-sided material alone
   as proof that the authored front face is correct. The builder independently
   confirmed this and is preparing a regression and source correction.

3. **Make both engine states read as emitted light.**
   `src/kestrel.js`, `AB_L/R`, and `blender/fighter_detail.py`, deep throats.
   [Full throttle](engine-full.png) shows opaque cones with hard pointed
   silhouettes and corresponding solid floor shadows. Give the AB meshes a
   separate transparent/additive material with axial/radial falloff and disable
   their shadow casting. Preserve the named cone nodes and controlled scaling.
   The [straight rear idle diagnostic](diagnostic-straight-rear-idle.png) also
   shows dark end discs rather than luminous throats. Source geometry places
   the emitter at z = 5.81-5.83 behind the nacelle's closed end cap at z = 5.92;
   this is the likely occluder. Open that cap or move the emitter into the
   visible cavity, then verify the continuous 0-0.7 glow range before the
   afterburner activates. A bright cone cannot stand in for the inner throat.

4. **Resolve the surface marks and strengthen material definition.**
   `blender/materials.py`, the UV/bake/export pipeline, and exhaust petal fit.
   See [rear close view](diagnostic-rear-detail.png). Stippling/striping remains
   with [shadows off](diagnostic-shadows-off.png) and with
   [normal/AO maps off](diagnostic-normal-ao-off.png), then disappears when
   [base colour is removed](diagnostic-basecolor-off.png). This rules out shadow
   bias as the primary explanation. It implicates the albedo treatment and/or
   contrasting overlapping surfaces; the test alone does not distinguish UV
   bleed from coincident geometry. Inspect atlas padding/mip edges and maintain
   real clearance between the petal shells and the underlying nozzle envelope.
   The latter's faceted surface can protrude through the inscribed petal chord
   near the aft end. Broad shoulder/fin faces and the cockpit liner also need
   purposeful material variation and service wear that remains readable in the
   actual WebGL render. Apply the pending Meshy step after geometry/UV cleanup,
   preserving a verifiable UV layout; do not use it to conceal intersections.

5. **Frame the inspected mechanism and keep controls clear of it.**
   `src/kestrel-studio.js`, view poses and viewport fitting. In
   [desktop Planform](desktop-top.png), the aft wing and engines run underneath
   the control bars. In [desktop open canopy](canopy-open.png) and
   [phone deployed boarding](phone-deployed.png), the opened canopy exits the
   top of the image. Desktop controls cover ladder rungs in the very view meant
   to inspect them. Fit each view to a safe scene rectangle above the controls
   and include the maximum animated bounds. Preserve the closer cockpit view.
   The MFD geometry is within the viewport on both devices, but the phone's
   primary displays occupy only about 80 x 56 px, so small labels are hard to
   read; an optional focused display view would help review their contents.

## Independent verification and limits

- Production studio: `http://127.0.0.1:5292/dev/kestrel.html`.
- Chromium 151.0.7922.173; AMD Radeon 860M, ANGLE OpenGL ES 3.2/radeonsi.
  Desktop 1440 x 900; phone viewport 390 x 844, actual canvas approximately
  390 x 523. All claims here refer to those captures; no FPS/performance gate is
  claimed.
- Took and inspected 29 independent PNGs: all six views at both sizes,
  intermediate and endpoint mechanism poses, engine states, and six diagnostic
  views. [Browser evidence](browser-evidence.json) records actual progress,
  canvas-relative screen corners, backend, draw counts and errors.
  [Diagnostic evidence](diagnostic-evidence.json) records the temporary
  appearance overrides. These overrides affected only the reviewer browser.
- The independent keyboard/touch sequence passed in 33.2 s including startup;
  the diagnostic sequence passed in 7.5 s. Zero page errors or browser console
  warnings/errors. The GLB hash was unchanged across the main capture sequence.
  A passing sequence means the controls completed, not that the visual gate
  passed.
- Independently parsed the binary: 35,114 triangles, 2,268,944 bytes, 44 meshes,
  six materials and three 1024 x 1024 WebP images, all within the asset budget.
  [Binary audit](asset-audit.json) includes animation channels and material data.
- The earlier inherited Nomad MFD labels were fixed before these captures; the
  photographed primary displays use Kestrel inspection labels. That source
  finding is closed and is not counted against the score.
- Builder reports all 17 numerical test files, build and five browser cases
  passing; those complete suites were not independently rerun here. Controller
  input was source-reviewed and builder-tested; this reviewer independently
  exercised keyboard and touch, not a physical controller.
- Motion judgment uses the live mechanism sequence and captured intermediate
  poses. It is not a long-duration flicker or flight-integration audit.
- Reviewer owned only `docs/qa/kestrel/reviewer/` and `/tmp/kestrel-review*`.
  No source assets were edited and no merge/export recipe completion was
  authorized by this review. Preserve this failure alongside later evidence.
