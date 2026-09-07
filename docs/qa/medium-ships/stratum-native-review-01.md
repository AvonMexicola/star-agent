# Independent Stratum native-image review — changes required

Reviewer: `/root/nomad_cutter/nomad_reviewer`, independent of Stratum's author. I authored Gannet; I did not author Stratum. Review date: 2026-09-08. This is a read-only critique of the supplied native captures, after freezing Gannet Geometry09. I launched no browser, renderer or GPU job and changed no production files.

The candidate does **not** meet the 4.5 silhouette brief or the material minimum in QUALITY. The clear pilot view and readable displays are meaningful improvements. Further shape, surface and cabin work is required before visual acceptance.

## Candidate and evidence

- Captured GLB SHA256: `78e9ffe41bb225a342e5765a504c15ff3ec00a94a9f2ddd0040f5500e137d827`.
- Input directory: `/tmp/star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/`.
- I inspected all twelve PNGs, `capture.json`, and the retained browser failure context. The accompanying video was not reviewed.
- Capture interval: 2026-09-07 22:47:06.876–22:47:20.541 UTC. Chromium `151.0.7922.173`; ANGLE, AMD Radeon 860M, radeonsi/krackan1/ACO, OpenGL ES 3.2, as recorded by the capture.
- Desktop page: 1440×900, touch false. Actual rendered canvas and drawing buffer: 1440×657, with studio controls occupying the remaining height. The scene includes a 1.8 m human reference and 1 m grid. No gameplay world seed is recorded.
- Every captured view reports the asset ready with no asset-load error. The studio labels the asset 28,652 triangles, 3.57 MB and 1024 WebP. I did not independently remeasure that export in this image-only review. Recorded exterior scene count is 59,480 triangles and 140 draws, including inspection content; this is not a frame-time or gameplay-budget result.
- The capture does not bind a source commit. The current Stratum worktree HEAD observed during review, `e6c69cac513746eff815b99aad335642421e5adc`, contains a later missing-resource fix and must not be presented as the captured source identity. The asset hash above binds this critique.

The supplied captures were produced by root, not by this reviewer. These independent observations support revision decisions; they do not replace the review process's independently exercised native/gameplay acceptance route.

## Actual result and limits

The desktop test reached all twelve capture steps, including the authored ramp and gear endpoints. Its **final result remains FAIL** because its console receipt contains one `404 (Not Found)` resource error; warnings are empty. Root owns that correction. A later source fix does not retroactively change this result. Phone was not run.

This review covers shape, visible materials, the authored pilot/cabin composition and the supplied mechanism poses. It does not establish continuous motion stability, collision clearance, real mining, physical player traversal, controller operation, native touch, persistence, online authority or performance. Existing CPU findings remain separate evidence.

## Rubric

These are provisional visual scores for this exact captured asset. QUALITY requires average ≥4.0 with no applicable item below 3; the medium-ship brief additionally requires silhouette ≥4.5.

| Criterion | Score / 5 | Evidence and reason |
| --- | ---: | --- |
| Silhouette and scale | **3.4** | The measured human and twin forward tools establish medium scale and role. Exterior, side and top views still read as one long plain pressure body flanked by very large plain shoulder housings. The skinny tool rails and rounded heads provide little industrial shape hierarchy relative to that bulk. |
| Materials and detail | **2.6** | Large white roof and shoulder surfaces have weak panel, access and roughness hierarchy at the captured use distance. Tool heads and rear nozzles read as polished silver capsules; their bright inner surfaces lose a convincing throat/tool-cavity read. Cabin boxes and berths are recognizable but visually elementary. |
| Lighting and integration | **3.0** | Studio shadows ground the exterior and glazing is legible. Broad interior surfaces have weak local contact and depth, while metal highlights dominate the hardware. This score concerns this studio lighting only. |
| Cohesion | **3.5** | Ivory, graphite, petrol, mint and amber are consistent with Meridian. The restrained interface is coherent. Large decorative color areas and uniformly shiny hardware need a more purposeful relationship to the manufactured parts. |
| Information or physical function | **3.8** | The current central pilot view is clear and all four inspection displays, including their footer text, are readable. The cabin aisle, storage, berths and connected rear ramp have a useful physical read. The screens explicitly identify inspection state; they are not live-gameplay proof. |
| Motion | **Unscored — applicable, evidence incomplete** | The stills show actual intermediate/end poses, but cannot demonstrate continuous stability, flicker, transitions or full aim travel. This is not an N/A exemption. |

The five scored static criteria average **3.26**; the lowest is **2.6**. This is a partial static average, not a complete six-item acceptance score. The silhouette gate fails independently.

## Ranked corrections

1. **High — distinguish the main manufactured volumes.** In [exterior](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/01-exterior.png), [side](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/02-side.png) and [top](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/03-top.png), the shoulder and roof masses remain unusually uninterrupted. Give the outboard drives a readable root/collar, a deliberate transition into their aft housings, and a small number of fitted service or heat-management recesses. Make the extraction-boom roots read as load-bearing machinery integrated into the shoulder. Shape refinements are required alongside the material pass. Keep the agreed outer envelope, cabin void, ramp portal and rig ranges; first refine these existing regions rather than expanding the ship.

2. **High — make the mining heads and nozzles readable hardware.** [Mining heads](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/06-mining-heads.png) and [rear](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/08-ramp-deployed.png) show smooth silver outer shells and similarly bright inner surfaces. Separate a matte protective outer collar, restrained brushed mechanism bands, and a darker recessed working throat. Add a legible emitter/inner assembly and mounted service connection where appropriate to the real tool. Preserve muzzle origins and usable aim ranges. Check this at the pilot eye too: the current bright heads draw attention at both windshield edges.

3. **Medium — finish the cabin as fitted equipment.** [Cabin](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/05-cabin.png) has a clear route and identifiable components, but broad petrol bins, simple dark mattresses, plain posts and largely uniform walls/ceiling still look early. Refine the existing equipment with fitted plinths, lid/gasket separation, restrained labels and deliberate mounts. Add readable local contact and material variation around floor, berths and storage. Preserve the full aisle and access clearances. Inspect the fine diagonal ceiling seam read in a closer moving view before deciding whether it needs a geometry or texture correction; no flicker is established by these stills.

4. **Medium — improve mechanism review coverage.** [Gear stowed](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/10-gear-stowed.png) shows the complete ship small in a large empty canvas. The folding gear is visible, but its roots, stow locations and near-body clearances are too small for final inspection. Capture one closer underside sequence through a full cycle, showing the actual attachment/stow arrangement. The visible external folded parts are not, by themselves, evidence of a collision defect. The aimed view records only ±0.01 rad yaw and zero elevation; demonstrate both yaw and elevation extremes, then return to neutral, before claiming full aim-range visual acceptance.

## Specific improvements to retain

[Pilot](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/04-pilot.png) shows no central opaque mullion, preserves surrounding glass/frame, and gives all four MFD faces a readable first-person composition. Do not add a central support or surface decoration across that view during refinement. This is the captured authored studio eye, not yet the integrated game camera or phone composition.

[Ramp intermediate](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/07-ramp-moving.png) at progress 0.2135 and [ramp deployed](../star-agent-stratum-native-clear-01/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/08-ramp-deployed.png) at progress 1 show a believable connected boarding route, segmented anti-slip surface and restrained amber warnings. These are useful physical details to retain. The three gear captures likewise show real pose changes at progress 0.7129, 0 and 1; the captured endpoints are not substitutes for continuous motion review.

## Disposition

**Changes required for visual acceptance; usable as an explicitly unfinished development checkpoint.** First resolve the shoulder/body/tool shape hierarchy, then finish material separation and cabin fittings. Preserve the central clear view, existing measured interiors and actual mechanisms. Re-review the changed export in desktop and phone native views with clean diagnostics, closer mechanism motion and the actual gameplay route. Cees retains final product/release authority. No acceptance or performance result is granted here.
