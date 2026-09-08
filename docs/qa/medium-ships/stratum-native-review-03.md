# Independent native review — Stratum Art03

**Disposition: changes requested.** The six-criterion mean is **3.97/5** (23.8/6, unrounded 3.9667), below QUALITY's 4.0 requirement. The lowest item is 3.6, so the no-item-below-3 condition is met. **Silhouette is 4.2/5, below the brief's stricter 4.5 requirement.** This is an improved development candidate, not final native art acceptance.

Reviewer: `/root/kestrel_reviewer`, separate from the Stratum hull, material and studio author. I independently inspected the supplied original native renders and ordinary frames decoded from their original recordings. Root ran the browser fixture; I did not make a new browser capture. I authored the separate main-game medium lamp helper and exclude that implementation from this review. No production files, source assets, prior reviews, browser sessions or services were changed.

## Exact candidate and scope

- Captured source: `2638857de0a7d4da8b99e4dda7159275df6ed411`.
- GLB SHA256: `22bbf0296e349e24f1a9bd636745511bf31b9291f1a305814f13d4a45cac4d08`.
- I independently read the exported GLB: **51,346 triangles; 3,932,512 bytes; 66 meshes/primitives; 12 materials; 110 nodes; three embedded 1024×1024 WebP images**. The individual asset meets 60k triangles / 4,000,000 bytes / 1024². Only 67,488 bytes remain under the file cap. These counts do not establish a gameplay scene or performance pass.
- Frozen review copy: `/tmp/star-agent-stratum-art03-review-evidence/stratum-art03.glb`.
- Standard: `QUALITY.md` and `docs/briefs/meridian-medium-ships.md` at the captured commit. Their exact source hashes, capture-source hashes and every reviewed image/video hash are in `/tmp/star-agent-stratum-art03-review-evidence/evidence-manifest.json` (SHA256 `4c6fec525aaf732620346abe0139b16a840308f9a16ae379524d9e3b84a2564d`).

The review covers native exterior and interior appearance, human-reference scale, real studio MFD faces and nominal gear/ramp/boom motion. It does **not** accept actual flight, physical player boarding, ore persistence, mining effects, hardware controller support, main-game lighting/camera, station fit, LOD behavior or FPS. Root's reported 59 asset/functional CPU checks and nine lamp checks/19 paths remain separate evidence; I did not rerun them or turn them into visual approval.

## Evidence inspected

All **50 original PNGs** were inspected at their original dimensions: 25 desktop and 25 phone. In the references below, `D` and `P` mean:

- D: `/tmp/star-agent-stratum-native-art03/stratum-studio-Stratum-nat-271d7-and-real-mechanism-controls/`
- P: `/tmp/star-agent-stratum-native-art03/stratum-studio-Stratum-nat-a578c-and-real-mechanism-controls/`

Each includes exterior, side, top, pilot, all four individual MFD looks, cabin, bores, ramp opening/deployed/closing, gear down/retracting/stowed/extending/down, neutral booms, all four yaw/pitch limit combinations, a complete-pair view and neutral return. Whole-ship overviews retain the reference figure and sufficient margin. The bores and underside views intentionally crop unrelated hull regions to expose the mechanisms; I did not misclassify these as failed whole-ship framing.

I also inspected **48 ordinary video frames**: desktop PTS 0–22 seconds at one-second intervals, and phone PTS 0–24 seconds at one-second intervals. They are preserved under `review-evidence/desktop/second-00.png` through `second-22.png`, and `review-evidence/phone/second-00.png` through `second-24.png`. CPU-only `ffmpeg -hwaccel none`, selecting original frame indices divisible by 25, was used without cropping, resizing, recoloring or interpolation. Exact source PTS are in the manifest. This is sampled motion inspection, not a claim to have scrutinized every decoded frame.

Original recordings:

- D `video/page@857826727a33c712f6938f50015b56e3.webm`: 23.00 seconds, VP8, 1440×900, 25 fps recording format.
- P `video/page@9d5edbe9d6ac0b1c4088fa7eb2af2df5.webm`: 24.48 seconds, VP8, 390×844, 25 fps recording format.

Loading at PTS 0 and the desktop recording's initial smaller page/gray padding precede the settled captures; they are not scored as hull defects. Recording rate is not measured render FPS.

Both capture receipts identify Chromium **151.0.7922.173**, ANGLE/OpenGL ES 3.2 on **AMD Radeon 860M, radeonsi krackan1 ACO**, the exact GLB above, `complete: true`, and no recorded page/console errors or warnings. Root reports 2/2 native cases passed. Desktop page size is 1440×900, with a 1440×629 exterior canvas and 1440×576 cockpit canvas; phone is 390×844, with 390×445 and 390×392 respectively. Drawing buffers match the recorded canvas sizes. The captured renderer counters range from 82,572–104,868 triangles / 50–148 calls on desktop and 79,324–104,868 / 34–148 on phone. These are native scene counters, including its rendering passes and other scene content, not the asset-only triangle count or a hardware benchmark. Recorded input events are trusted and neither receipt reports horizontal overflow; this remains studio input coverage.

## Scores

| QUALITY criterion | Score | Observed evidence and limit |
| --- | ---: | --- |
| Silhouette and scale | **4.2** | D/P `01-exterior`, `02-side`, `03-top`: the fitted shoulder roots, stepped service waist and raised roof body make a more intentional 18 m extraction craft. The 1.8 m reference makes the scale legible. The broad faceted pressure body still dominates, while the straight shallow boom sections and three repeated top blocks feel slight beside the large shoulders. The outer form is improved but does not reach the required 4.5. |
| Materials and detail | **3.7** | D/P `06-mining-heads`, `05-cabin`, exterior and top: dark bores, restrained metal rims, petrol housings and fitted panel returns are readable. Broad ivory faces remain nearly uniform; thick black boundaries give many panels an outlined, flat appearance. Large bin sides/lids, cabin walls and the plain underside still lack convincing finish variation at use distance. |
| Lighting and integration | **3.6** | Ground shadows anchor the hull, and the bores retain depth. The revised cabin aisle and contact definition improve the previous result. Near storage faces, supports, walls and lids remain evenly lit with weak local contact/depth. Subtle mottling/diagonal traces remain in the dark upper cabin surfaces, although the previous strong regular banding is reduced. The images do not isolate whether those remaining traces come from maps, normals or shadows. This score applies to the native studio only. |
| Cohesion | **4.1** | Ivory/graphite/petrol, mint fixtures, amber hazards and the studio type/control language consistently identify Meridian. The cleaner mechanical metal and dark working throats retain the previous successful corrections. The heavily outlined armor and plain broad interior faces keep the finish from feeling equally resolved throughout. |
| Information or physical function | **4.2** | D/P `04-pilot` and `04a`–`04d`: clear central forward glazing and accessible real display faces. Ramp and gear states agree with the illustrated studio controls; the MFDs explicitly label this as inspection rather than live gameplay. Native views show the aisle, bins and rear access coherently. This is not a capsule-clearance, boarding or real mining/persistence certification. |
| Motion | **4.0** | Both original videos show the ramp fold/extend and reverse, all four gear legs retract and extend, mirrored yaw across ±0.20 rad with pitch −0.12 through +0.14, and both booms returning to neutral. Moving parts remain visibly attached; no gross popping or intersection appears in the inspected samples. The mechanisms are simple, and the stowed gear stays externally exposed. No LOD traversal, rapid input reversal, flight animation, or exhaustive frame-level clearance claim is made. |

The comparable first-five-item static mean is **3.96**, versus the earlier Art02 review's 3.84. The added motion score reflects newly sufficient evidence; Art02's missing motion evidence was never a zero or a free pass.

## Closure against the failed Art02 review

I read `docs/qa/medium-ships/stratum-native-review-02.md` and directly compared its original desktop exterior, side and cabin PNGs with Art03. Prior reports and failures remain unchanged.

1. **Primary shape: partly closed.** Art03 replaces much of the earlier separated slab appearance with fitted pressure skins, a substantial root shoulder, service recess and drive housing. Those are visible improvements. The slight tool arms and dominant capsule mass remain the principal silhouette limitation.
2. **Materials/contact: partly closed.** New panel returns and cabin floor definition help, and the old chrome/nozzle problem stays closed. Large faces still rely on pale fill and very dark boundaries; the cabin lacks sufficient finish/contact depth. Strong Art02 ceiling bands are reduced, not used here as an unchanged blocker.
3. **Gear evidence: closed for the nominal native cycle.** D/P `09a`, `09`, `10`, `10b`, `11` and video about 11–15 seconds expose all four legs through both directions. This supersedes the earlier distant rear-only evidence limitation.
4. **Boom evidence: closed for the nominal native range.** D/P `12`–`17` and video about 16 seconds through the end show both yaw signs, both pitch limits, the whole pair and neutral return. Capture receipts record mirrored yaw values for the two booms, not a claim that both use the same yaw sign. This supersedes Art02's roughly ±0.01 yaw-only test.
5. **Portrait MFD access: closed in the native studio.** All four individual looks keep eye `[0,2.9,-5.8]` and a 72° vertical lens. Selected-screen corners stay inside the canvas (maximum absolute NDC X below 0.30, Y below 0.25). The initial phone forward frame still cuts off the outer displays, but the real look controls reach each complete face. Desktop forward shows all four. No central opaque strut crosses the main forward opening. A settled main-game cockpit remains separate evidence.

## Ranked remaining corrections

1. **Acceptance blocker — primary silhouette and tool load path.** In D/P `01`, `02`, `03` and `06`, resolve the relationship between the large root shoulder and the shallow constant-section arm. Reshape existing proximal boom casing into a more legible tapered structural section and expose a deliberate connection/brace into the root, while preserving the actual pivots, bore lines and full sweep. Refine the shoulder/waist/drive outline as connected masses rather than adding more small ribs. Judge the whole ship again at the same exterior/side/top views and human scale. Any changed geometry needs its actual clearance and budget checks; the current material detail does not substitute for the 4.5 silhouette gate.
2. **Acceptance blocker — armor and broad surface finish.** D/P `06`, `01`, `03`, and the close aim views show broad white faces dominated by similarly dark borders. Establish a hierarchy: strong joins at major assemblies, narrower/recessed joints within an assembly, visible bevel/return response and restrained material-specific roughness. Give the large cabin bin/lid/wall surfaces an equally manufactured finish. Preserve the good dark bores and restrained metal rims. Do not add arbitrary dirt or painted directional lighting to compensate.
3. **Remaining lighting/depth weakness — native cabin.** D/P `05-cabin` still has little local depth under/along the bin bases, supports and wall contacts; the dark aisle improves legibility but does not alone resolve that. Isolate the residual upper-wall/ceiling pattern before changing maps or shadow settings. Improve real contact and plausible response from the existing fixture arrangement without changing exposure merely to hide the issue. This finding does not approve or prescribe a change to the separate main-game lamp helper I authored.

The native evidence gaps requested after Art02 are now adequately filled. The required follow-up is a deliberate shape/finish improvement and review of the changed candidate, not another identical evidence tour of this unchanged export. No deployment, merge, gameplay or later-export approval is issued.
