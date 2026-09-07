# Burrow M-04 — independent candidate 10 native static review

**Scoped static PASS: 4.04/5**, with no assessed criterion below 3. This clears QUALITY.md's threshold for the **isolated native static asset views**. It does not complete motion, actual-game lighting/camera integration, input, mining/save, performance or product acceptance. Cees retains acceptance ownership.

Reviewer `/root/kestrel_reviewer`. I inspected all seven PNGs and `capture.json` in `/home/cees/projects/.mining-rover-qa/reviewer/candidate-10/`. The parent executed the portable reviewer-authored fixture; I did not launch a browser or edit production.

Exact GLB SHA256: `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`, **21,570 triangles / 2,177,260 bytes**. Captured source commit: `84860a6a0a76b07d8d8ffafa0d0c65750b7dbd45`, recorded clean. Layout SHA256: `2d3912564b0cd16d212ae47fa528d475cc93a2941dcbdce10cbbad3b1e231a38`.

## Exact static scores

| Criterion | Score | Observed result and limit |
| --- | ---: | --- |
| Silhouette and scale | 3.8 | The cab, two heads, four substantial wheels and rear mineral cassettes read immediately at useful distance. The correctly posed human, opening and stairs establish believable scale. The tall rectangular cab and shelf-like rear fenders remain the least refined part of the design; the shape is coherent utility equipment rather than a high point of the fleet's massing. Geometry is unchanged from 09, so no increase is credited here. |
| Materials and detail | 4.0 | The cockpit control bases, hinges, wheel hubs and rear supports now have flat machined ends instead of soft chrome domes. The rougher steel has a controlled light response, while ivory panels, petrol covers and dark tyres remain distinct. Cutter collars retain their intentional profile breaks. Panel layers, seams, fasteners, gaskets, lamp stalks and step stringers read as deliberate construction. Broad body/underbody areas are still plain, limiting the score. |
| Lighting and integration | 4.1, native fixture only | The roof and dashboard are free of the former diagonal shadow bands. Cast shadows remain on the floor, and the display, buttons, frame and steps still cast readable shadows onto adjacent surfaces. Wheel contact is visually retained without an obvious detached-shadow gap at these resolutions. Whites retain detail and the cabin/underside are legible. This updates the native-lighting judgment only; the newer actual-game exposure and settled pilot framing are still awaiting their own evidence. |
| Cohesion | 4.2 | Ivory, graphite, petrol, steel, restrained amber and mint maintain the Meridian language. The upright front name and approved vertical emblem are readable; fender, cap and service-panel treatment are consistent. The still-simple massing is a silhouette limitation rather than a mismatched palette or manufacturer identity. |
| Information or physical function | 4.1, asset construction/readability | The fixed steps visibly connect to the body and preserve usable tops; the port opening, sealed glazing, suited seat, supported lamps and articulated cutter roots are credible. The corrected flat-ended supports improve the visual reading of attachment points. The prior finite CPU closure and exact 09-to-10 geometry identity support the measured clearances. This score covers the represented asset construction, not live UI or a complete human driving animation. The native MFD is intentionally blank. |
| Motion | Unassessed | Static droop, steering and aim extremes are not evidence of transition quality, beam stability, wheel motion, LOD/flicker or a complete journey. The new keyboard/touch videos and actual-game captures have not yet been inspected in this report. Motion remains applicable to final acceptance. |

Sum of five assessed static scores: **20.2**, mean **4.04**. This is a narrow pass, not a six-criterion overall score. Previous 07/09 reports and failed controls remain unchanged. The original 09 lighting score described its original flawed fixture; the corrected diagnostic and this new shadow-on capture provide the explicit reason for revising that limited part of the judgment.

## Closures and remaining findings

The two concrete finish issues are closed in these images. First, the roof/dashboard banding disappears while real shadows remain; no asset-map repaint was needed for the fixture acne. Second, radial side normals, flat cap normals and the rougher steel produce credible cylindrical supports and hubs. In `03-cockpit.png`, the two control bases now read as flat ends with distinct sidewalls; in `02-port-seated.png` and `06-rear.png`, the door hinges, hub faces and rear pins also lose the former rounded chrome appearance.

I found **no new geometric or attachment blocker** in the seven views. The independent strict 09-to-10 probe already confirmed that all 21,570 world triangles, all per-node local triangles, non-normal corner attributes, node hierarchy/TRS/extras, primitive assignments and canonical layout remain identical. Only normal records on 3,616 triangles and the ORM payload changed. The finite clearance scope is inherited accurately; no additional exhaustive sweep is claimed.

Remaining notes are proportionate refinements and evidence limits:

1. **Massing remains the weakest static dimension.** Large rectangular cab/bin volumes and thin rear fender shelves limit the silhouette score. The current result passes the scoped average; this note does not request reopening the measured cabin, door or wheel package.
2. **The underside is visually sparse.** The broad protective plate and exposed link ends communicate the basic structure but offer little localized service detail. Additional detail would need a functional reason and must respect the existing link travel; it is not a current collision blocker.
3. **The phone image proves containment rather than fine quality or controls.** The open-door vehicle remains fully in frame, but occupies about one quarter of image height. Touch behaviour and legibility of live controls belong to the forthcoming actual-game evidence.
4. **Actual-game camera/light/motion review remains open.** The native cockpit origin is the canonical [0,1.78,−0.82], but its fixed inspection look-at target is [0,1.37,−1.67]; it does not certify the runtime's default camera orientation or settling transition. The static asset pass must not be used to silently close the prior wall-facing/mid-boarding game-frame limitations.

## Capture validity and metrics

Chromium **151.0.7922.173**, **ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2**. Six desktop **1440×900** views, one phone **390×844** view, DPR 1. Metadata records completion and **zero page/console errors or warnings**. The source is recorded clean, and the fixture checks the local and HTTP-served GLB identities.

Unmodified imported native PBR materials are rendered with ACES exposure 0.95, RoomEnvironment intensity 0.75, key 2.6, fill 1.0, hemisphere 0.35 and a one-metre grid. The light directions and inspection cameras remain those of the earlier fixture. The 2048² directional shadow frustum now fits the actual posed model/human vertices plus their floor-shadow projection; bias is −0.0001 and normal bias is 0.010 m. Every record confirms renderer shadows enabled, key casting enabled, floor reception enabled and 38 receiving meshes. The floor is deliberately hidden in the underside view, despite retaining its receiving flag. The visible floor/contact shadows in the other views corroborate the enabled state; this is not the invalid cached-shadow toggle from 09.

Recorded scene costs: human exterior/port **42 calls / 26,150 triangles**; cockpit **22 / 15,402**; cutter detail **38 / 21,838**; underside **37 / 21,880**; rear/phone **39 / 21,882**. These include fixture/human geometry and culling. They do not establish asset-only draw cost, texture residency, frame-time/FPS, LOD or whole-game budgets.

The original mannequin SHA is `8a46b5b09f0659661a0e4373db159f9b87d43136144e118e908265f45ba6a52d`. Correct attached-skin synchronization and the placed-versus-local translation assertion pass: standing height **1.799499 m**; seated bounds X ±0.429429, Y [0.578451,1.959629], Z [−1.336493,−0.399395], seated eye [0,1.78,−0.82]. The generic sit-idle hands/harness remain a scale pose, not certified driving IK. The underbody removes the floor and evaluates full droop; the compressed cutter frame holds body height fixed. Neither is a settled terrain-contact test.
