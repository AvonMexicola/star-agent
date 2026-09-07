# Kestrel: refined material candidate, round 6

**4.25 / 5 average — PASS. Mergeable: yes, for the reviewed asset/studio scope.**

Reviewed frozen GLB SHA-256:
`ef42a970295f0db8535fdd08aa6f8b2385243545891f512816392befdbaed374`.

The broad cloudy streaking from round 5 is removed. Armour now reads as clean
ceramic over dark structure, with distinct metal mechanisms, restrained surface
variation and deliberate markings. Mint livery and amber mechanism cues are
restored. The low-throttle engine remains visibly mint before reaching white,
and the full-throttle plume is easier to see. The approved silhouette and the
repaired mechanisms remain intact.

This candidate meets the fighter brief's minimum of >= 4.2 overall with nothing
below 4. It still has room for close-up finish improvements. This is an independent
visual recommendation for the captured asset and studio, not a merge action or
an assessment of playable flight integration. Cees retains the PR gate.

| Criterion | Score | Captured result |
|---|---:|---|
| 1. Silhouette and scale | 4.5 | Long nose, blended shoulders, thin swept wings, canted fins and twin drives retain the approved shape. Mesh and rig payloads match the earlier approved candidate exactly. |
| 2. Materials and detail | 4.0 | Ceramic, graphite, metal, glass and warning/livery regions read deliberately. Seams, hatches, vents, fasteners, markings and restrained wear support a manufactured object. Cockpit contact details and fine metal texture remain the weakest close-up areas. |
| 3. Lighting and integration | 4.0 | Bevels and contact shadows work in the ACES studio. Low-throttle mint is more distinct, outlet light is visible and AB is transparent without solid cone shadows. The straight-axis cores still look like simple luminous discs. |
| 4. Cohesion | 4.0 | White armour, dark structure, mint accents, amber mechanism cues and studio/MFD typography form a consistent faction palette. The material import no longer overwrites the intended regional identity. |
| 5. Function | 4.5 | Four live MFDs, keyboard and touch controls, mechanism interlocks and reversible endpoints work. The outboard ladder provides a visible route from the sill to the ground. |
| 6. Motion | 4.5 | The bridge swings out before the three sections unfold, and the reverse sequence is coherent. Canopy and gear complete their cycles. No new popping or visible shoulder crossing was observed in this inspection. |

The scores total 25.5 / 30, or **4.25 / 5**. The material score is based on the
rendered finish, independently of the completed Meshy process step.

## Material findings closed from round 5

- The matching [front close view](diagnostic-front-material.png) shows smooth
  cowl sides, wing edges and dorsal surfaces instead of the
  [direct import's broad grey strokes](../round-5/diagnostic-front-material.png).
  This capture uses the exported maps without overrides. Its intentional close
  crop is for surface inspection, not a preset-framing regression.
- [Planform](desktop-top.png) restores the mint sweep bands, exact KESTREL
  identifiers and authored service graphics. [Deployment](ladder-deployed.png)
  and [cockpit](desktop-cockpit.png) restore amber cues and dark material regions.
- [Rear detail](diagnostic-rear-detail.png) reads as metal rings, dark petal faces
  and an emissive inner liner. The large pale/mottled treatment from the direct
  import no longer dominates these parts. Some coarse highlight variation
  remains a polish item.
- [Zero throttle](diagnostic-straight-rear-0.png),
  [35%](diagnostic-straight-rear-35.png), [68%](diagnostic-straight-rear-68.png)
  and [100%](diagnostic-straight-rear-100.png) show the improved mint-to-white
  progression. [Full thrust from the rear quarter](engine-100.png) shows the
  stronger transparent plume root and fading tip, without a pointed solid shadow.

## Ranked remaining polish

These are nonblocking improvements for this captured candidate, rather than
five unresolved gate failures.

1. **Make cockpit contact areas more specific.** `blender/fighter_detail.py`
   and cockpit regions in `blender/pack_fighter_textures.py`.
   [The pilot view](desktop-cockpit.png) now has coherent material separation,
   but broad footwell areas, smooth pedal faces and plain control blocks remain
   simple. Add restrained tread/contact wear and a few readable control legends;
   keep grip rubber matte and metal contact faces distinct. Preserve the four
   functional screen canvases.

2. **Refine the nozzle metal at close range.**
   `blender/pack_fighter_textures.py`, `Mechanism |` atlas regions.
   In [rear detail](diagnostic-rear-detail.png), circumferential ring highlights
   and some petal faces still vary in broad patches. Reduce that coarse variation
   in favour of fine, consistent brushing and subtle service/heat marks. Keep the
   corrected petal clearance and the readable metal/dark-part separation.

3. **Improve the smallest service markings within the existing texture budget.**
   `blender/fighter_detail.py` and final atlas allocation.
   Main identifiers are deliberate again, but thin seams and small stencils
   become soft or broken at the [close front](diagnostic-front-material.png) and
   [planform](desktop-top.png) inspection distances. Give priority markings more
   texel area or slightly larger strokes; avoid adding dense unreadable text.

4. **Give the engine cores some radial structure.** `src/kestrel.js` and the
   authored engine-core material. The colour progression now works, but
   [straight rear at low thrust](diagnostic-straight-rear-0.png) still presents
   two simple circular luminous faces. A restrained radial intensity profile or
   visible inner construction would add depth. Preserve the current low-throttle
   mint, high-throttle white, transparency, log depth and disabled AB shadows.

5. **Use more of the available underside inspection area.**
   `src/kestrel-studio.js`, underside preset and safe-rectangle fitting.
   [Desktop](desktop-belly.png) and [phone underside](phone-belly.png) have safe
   margins but leave substantial unused space. A tighter fit to projected model
   vertices would expose more belly detail while retaining full-model bounds
   and keeping the controls clear. The former near-zero top margin remains fixed.

## Mechanisms and framing remain closed

- All four screens render content in the [desktop cockpit](desktop-cockpit.png)
  and [phone cockpit](phone-cockpit.png). The screen winding/UV repair is retained.
- [Bridge swing](ladder-bridge-swing.png), [upper fold](ladder-upper-fold.png),
  [middle fold](ladder-middle-fold.png), [lower fold](ladder-lower-fold.png),
  [deployment](ladder-deployed.png) and [return](ladder-return.png) retain the
  outboard sequence. Actual progress and joint poses are recorded around each
  screenshot. No new hull crossing was visible.
- [Canopy intermediate](canopy-60.png), [open canopy](canopy-open.png),
  [gear retracting](gear-retracting.png) and [gear stowed](gear-stowed.png)
  preserve the reviewed behaviour. Closed-canopy ladder deployment is rejected;
  canopy closing is rejected while the ladder is out.
- [Desktop planform](desktop-top.png), [phone planform](phone-top.png), both
  underside views and [phone deployment](phone-deployed.png) retain usable
  margins above controls. Phone boarding intentionally crops unrelated nose/wing
  extremities to show the complete canopy/ladder mechanism.
- The prior round-4 clearance evidence remains a finite sampled edge check of
  evaluated animation poses, not continuous collision certification. It was not
  independently rerun here; the rig data comparison below establishes identity.

## Independent verification and scope

- Took and inspected **34 fresh PNGs** in the frozen production studio at
  `http://127.0.0.1:5292/dev/kestrel.html`: the 33-view desktop/phone/mechanism
  tour and one matching close-front capture. Desktop viewport 1440 x 900;
  phone 390 x 844, with a roughly 390 x 523 scene and scrolling controls.
- Chromium **151.0.7922.173**, AMD Radeon **860M** through ANGLE OpenGL ES 3.2 /
  radeonsi. The independent keyboard/touch tour passed; its runner status records
  no failed tests. The extra close-view case passed in 4.7 s, 5.8 s including
  startup. Both recorded zero browser page errors and console warnings/errors.
  Node's NO_COLOR/FORCE_COLOR warning was outside the browser. No FPS gate is claimed.
- [Browser evidence](browser-evidence.json) records poses, progress, MFD corner
  projections, backend and draw counts; [close-view evidence](diagnostic-evidence.json)
  records the unmodified surface capture. The GLB hash stayed unchanged across
  the main tour. A matching frozen review copy was retained before GPU release.
- The [binary audit](asset-audit.json) independently confirms **36,226 triangles,
  2,330,924 bytes, 45 meshes, six materials and three 1024 x 1024 WebP maps**.
  These fit the fighter's asset budgets.
- The [independent rig comparison](rig-comparison.json) against procedural commit
  `5c0cffd` / round-4 GLB `2fa436d3...10503b0` finds all 45 mesh accessor payloads
  identical, including positions, normals, UVs and indices. All 81 node records,
  transforms, hierarchy and extras match; all three animation payloads match.
- [Source-map verification](source-map-verification.json) records the current
  pack provenance and independently verifies hashes/sizes for all 12 recorded
  raw/imported/procedural source maps. All match. The inspected packing code
  masks by authored Blender material regions, filters broad generated colour
  variation, restores material-specific PBR response and blends attenuated Meshy
  normals with authored normals. The source-region UV hash check is in the
  builder's pack procedure; that rasterization was not independently rerun here.
- The Meshy source record retains the generated-mesh correspondence of
  47,024 / 47,024 vertices, maximum error 1.2517e-6. That generated-mesh comparison
  was not independently rerun. Runtime UV identity was independently verified.
- Builder reports 17 numerical test files, production build and five hardware
  browser cases passing. Those complete suites and physical-controller input
  were not independently rerun here. Live flight, weapons and playable boarding
  integration remain outside this asset-only review.
- Reviewer wrote only `docs/qa/kestrel/reviewer/round-6/` and
  `/tmp/kestrel-review*`. Prior evidence is preserved; no builder source or asset
  was changed. The GPU was released before scoring/report work.
