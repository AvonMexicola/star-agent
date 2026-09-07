# Burrow M-04 — independent native PBR review, candidate 07

**Improved, but visual acceptance remains open.** Five assessed static criteria average **3.68/5**, up from candidate 04's 3.42, below QUALITY.md's 4.0 threshold. Motion and actual game integration are not established by these stills.

Reviewer `/root/kestrel_reviewer`; exact asset **`67b5c6947b06bb020096696d6ece5116c746d4bf6a7ac53f9acd1e9a92ec89f3`**, **21,206 triangles / 2,181,360 bytes**. I inspected all seven PNGs and `capture.json` in `/home/cees/projects/.mining-rover-qa/reviewer/candidate-07/`, plus the source manufacturer texture for orientation. The parent executed the reviewer-authored fixture; I did not launch a browser or change production files.

## Scores and visible result

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Silhouette and scale | 3.8 | The enclosed cab, two heads, four substantial wheels and rear mineral cassettes read immediately. The chamfered roof cap and supported fenders are more deliberate. Correctly posed 1.8 m standing/seated figures support the scale judgment. The cab/cassette combination still relies heavily on large rectangular masses and thin shelves; it is coherent utility equipment but not yet at the requested Kestrel finish. |
| Materials and detail | 3.5 | Rubber is now consistently dark and the orange tyre-edge artefacts are gone. Layered covers, seams, latches and gasket reveals improve separation. Tool sleeves retain conspicuous flat-sided highlights in 01/02/04; metallic circular parts have broad soft highlights rather than controlled machined edges. Fine detail is still uneven between the well-described step assembly and broad plain body/underbody regions. |
| Lighting and integration | 3.7, native fixture only | White panels retain detail, the cabin is legible, neutral wheels have floor contact and the underside is inspectable. Regular diagonal bands remain on the roof and cockpit shelf. Their cause has not been isolated between asset shading and fixture shadows; this score does not assign them conclusively to the texture maps. Actual Atlas/Selene exposure and terrain integration remain separate. |
| Cohesion | 4.0 | Ivory, graphite, petrol, mint and restrained amber form a recognizable Meridian vehicle. The front name is now upright. Service panels, cap profiles and the approved manufacturer mark improve identity. The front emblem's image orientation is rotated relative to the inspected source texture and still needs correction. |
| Information or physical function | 3.4, construction scope | The steps visibly connect to the chassis and retain usable top surfaces; the open door and suited seat are readable. The CPU checks confirm the specific new support/fender/cover closures. However, the header-seal interference and fixed-side cabin gaps remain, and the work lamps still lack clear supports in these images. The fixture intentionally omits live MFD content, so the blank display is not evidence of a broken runtime screen. |
| Motion | Unassessed | Static steering, droop and aiming extremes cannot certify motion continuity, LOD/flicker, door transitions, mining effects, driver animation or input behaviour. |

## Ranked follow-up

1. **Close the measured cabin side/header gaps and remove deep rubber/header interference.** The proposed fixed divider, rear-strip and header additions should preserve the existing door opening, human route and envelope. `review-candidate-07.md` and `header-07.json` distinguish these remaining issues from the added structure that already passed.
2. **Give the bright work-lamp plates a visible attachment.** Stalks tied to the windshield gasket/frame should make their purpose and mounting legible; recheck proximity to aiming heads.
3. **Control circular highlights without softening profile breaks.** Smooth the cylindrical tool-sleeve sides while retaining sharp bore, collar and receiver transitions. Separate ceramic, polymer and steel roughness deliberately; this does not require changing the measured cutter package.
4. **Isolate the remaining regular bands before repainting.** Compare the unchanged cockpit/rear camera once with shadows disabled as a separately labelled diagnostic. Preserve the native shadowed views. The seven current stills do not establish that another albedo/normal edit is the correct remedy.
5. **Correct emblem UV orientation from actual corner positions.** The source texture has its main point vertical; the visible front plate presents the emblem rotated. Keep the correctly oriented text and existing manufacturer artwork.

The parent has proposed these refinements. They are not credited to candidate 07 before a new export/capture. No fresh whole-vehicle redesign is requested by this review.

## Evidence quality and limits

Chromium **151.0.7922.173**, **ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2**, DPR 1. Six desktop captures are **1440×900** and one phone asset overview is **390×844**. The completed metadata records **zero page errors, console warnings or console errors**. Native Three PBR, ACES exposure 0.95, room environment, directional key/fill and a one-metre studio grid are the same declared lighting setup as 04.

The corrected skin-sync helper ran successfully. Standing height is **1.799499 m**; standing placed bounds now centre at the actual X −2.45 root rather than the erroneous doubled offset in 04. Seated bounds are X ±0.429429, Y [0.578451,1.959629], Z [−1.336493,−0.399395], matching the independent CPU skinning audit. The pictured figure is the original rig in its authored sit-idle pose. This is not a certified driving/hand-IK animation.

Recorded scene costs are 42 calls / 25,742 triangles for each human exterior, 22 / 14,994 for cockpit, 38 / 21,430 for cutter detail, 37 / 21,472 for underside, and 39 / 21,474 for rear/phone. Counts include fixture geometry and the human where visible, and vary with culling. They are not asset-only costs or an FPS result. The phone frame contains the whole open-door rover but uses about one quarter of image height; it is not a touch-control or close material-inspection test.

The underside removes the floor and evaluates full droop. The cutter close-up fixes the body while compressing the suspension. Neither frame establishes settled terrain contact. No actual game capture, live telemetry, beam/mining transaction, controller/touch journey, full-body boarding, transport return or performance acceptance is added here. The original 04 and intermediate 05 evidence remains preserved.
