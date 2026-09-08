# Independent actual-game review — Gannet Art13 / e727d8e

Reviewer: `/root/nomad_cutter`, independent of Gannet art, the main renderer, the medium cabin-light helper and the root gameplay adapter. Root captured the production game; I independently inspected the original images and decoded video frames. No browser, GPU, source edit or gameplay action was performed by this review.

**Changes requested for the frozen main-game candidate.** The clear pilot view and sampled physical mechanisms are corroborated. The cargo MFD omits real stored ore. The applicable game-view mean is **3.86/5**, below QUALITY's 4.0 threshold; lowest item **3.2**. This does not change the separate Art13 studio disposition or award the brief's 4.5 silhouette gate.

## Candidate and scope

- Runtime `e727d8e`, main build15 `main-B5-qTCnz`.
- Gannet GLB `8da0bc2e3da7c8c2a2db7b29957b226fab0ba30eb0155f98d82a3f82c3995e6f`, 3,169,484 bytes.
- Burrow GLB `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`, 2,175,556 bytes.
- Chromium 151.0.7922.173; ANGLE / AMD Radeon 860M Graphics / radeonsi krackan1 ACO / OpenGL ES 3.2. Images and video 1440×900; actual WebGL buffer 1152×720. Seed 7291, Selene. Injected W3C standard Gamepad with a native focus interruption; no physical-controller claim.

All 11 original final13 PNGs were viewed at full size. I also viewed 38 unedited PNG extractions representing **37 distinct source-video frames**: 29 route samples plus nine closer hatch/gear samples, with 203.0s present in both sets. The finalized VP8 video is 212.12s at 25fps; its SHA is `dc2eb8d39f1d3e34c61d71137e1dce74189b8ba717f8d1a5ff8e2853878bb752`. These are ordinary decoded frames, without crop, resize, grading, interpolation or added annotations. Video PTS are not app `pageTime`.

Originals: `/home/cees/projects/.medium-ships-qa/gannet-controller-final13`. Exact evidence, timestamps, dimensions and hashes are in [evidence-manifest.json](evidence-manifest.json), [frames.json](frames.json) and [motion-detail.json](motion-detail.json). The auxiliary 1.32s focus-tab video is inventoried, not graded as game footage. Three original controller03 images were read as historical context; that earlier Gannet hash was `51f5578c…ef1`. No automated pixel comparison or lighting improvement against that baseline is claimed.

Source context read: main camera/HDR pipeline, lighting, medium lamps, MFDs, Gannet adapter, rover muzzle/effect transforms and the unchanged controller fixture. Their capture-time hashes are retained in [source-context.json](source-context.json). Main's 60° Gannet pilot view and atmospheric HDR postprocessing differ from the studio. Six non-shadow local lamps illuminate the actual Gannet diffuser hierarchy; this review assesses their game result, not their CPU tests.

## Results and findings

The supplied original journey records PASS, stable before/after source hashes, and empty error, warning and failed-request arrays. Root reports runner exit0 and a 3.6-minute case. Those are fixture results, not a substitute for this visual assessment. This reviewer ran only CPU metadata/frame extraction, which completed successfully; no new unit or browser test is claimed.

**G13-GAME-01 — required, cargo MFD information is incomplete.** After the real transfer, `05-controller-ore-transfer.png` shows Backpack **1.5kg**, including **0.54kg basalt**. On returning to the Gannet chair, `07-settled-gannet-pilot-return.png` still shows **BACKPACK 1.0 / 20kg**. Final saved containers retain exactly **0.5431160913443113kg basalt** alongside two rations; final MFD state still says 1.0kg. Frozen `src/ship-mfd.js:84,179` reads legacy `inventory.mass`, omitting mining-store contents; ship construction goods are omitted too. This is a shared offline display integration defect exposed by the new route, not evidence of an Art13 geometry regression or lost ore. [mfd-finding.json](mfd-finding.json) retains the exact state. Use the canonical composed contents for offline mass and label separate capacity rules honestly; preserve server authority online. Root confirmed the finding and assigned a narrow correction. That later source and its native closure are **not** accepted by this frozen report.

**G13-GAME-02 — nonblocking presentation limitations.** In originals00/07 and video194–210s, the resource card covers the middle of temporary onboarding/landing toasts. World destination labels also remain drawn over opaque cabin walls. Relevant persistent controls and all four MFDs remain visible, but overlapping temporary guidance reduces clarity. The same broad HUD pattern is present in the older controller03 reference. A shared toast/card layout correction is appropriate; no asset redesign is requested.

**Observed physical and visual result.** Originals00/07 show an unobstructed central forward view, with all four physical MFD titles, rows and footers inside the frame. Original02 confirms the Burrow also retains its clear windshield. Frame60s shows the rover beside the side aisle; frame186s includes a human against the cabin/portal, supporting local scale. The final13 still named `01-physical-port-door` primarily faces the closed aft hatch; it does not independently show the complete port-door mechanism.

Video70–75.52s shows the hatch moving up and the view lowering toward the ground, followed by actual drive-out at77–85s. The lift floor itself is mostly hidden from the seated eye. Reverse entry at159–164s and the loaded lift/hatch poses at167–172s visibly retain the rover in the central lane, with separate side cargo banks. The closure does not visibly pass through the rover in these frames. Cabin exit and pilot return are represented by174–198s frames and original07.

Original04 and frames117/118s show two distinct mint cutter beams leaving the front-tool region toward the outcrop. Their first millimetres are partly hidden by the cab from this rear camera; this evidence does not certify all bore clearances or aim arcs. Source independently places each beam at its actual muzzle transform and subtracts the camera origin. Collection motes near the cab are separate feedback and do not visually establish a cargo destination; root has reported a separate destination-feedback correction, which needs fresh evidence.

Frames200–203s show actual gear retraction poses, followed by deployment during descent and touchdown by210s. The rear craft is only about335px wide: motion of the visible feet is discernible, fine joint detail and hidden legs are not. The hatch stays visibly closed during flight. The enclosed Burrow is not visible then; same-rover identity and its retained local pose are established by the separate fixture receipt, not inferred through the hull.

## Scoped visual rubric

| QUALITY criterion | Score | Evidence and limit |
| --- | ---: | --- |
| Silhouette and scale | N/A | Cabin/rover scale is supported, but the small rear flight view and cropped mining background cannot establish the whole Gannet silhouette. The strict studio gate remains separate. |
| Materials and detail | 4.0 | Visible cabin ribs, divided hatch, dark recesses, glass, rover panels and physical screen bezels read as fitted utility parts. Broad interior faces remain simple; this is not a complete exterior finish inspection. |
| Lighting and integration | 3.8 | Mint fixtures make the enclosed bay and loaded rover readable, with clear white/dark separation. Frames169/186s show strong bright ceiling/upper-wall pools; lower recesses are dark and exterior shadows coarse. These limit polish without making the route unreadable. |
| Cohesion | 4.2 | Meridian white, dark petrol, mint displays/lights and amber details agree across Gannet, Burrow and inventory chrome. The HUD is dense but consistent. |
| Information or physical function | 3.2 | Clear eye/MFD layout and visible loading mechanism support use; the proven cargo-mass omission prevents truthful resource feedback, and overlapping toasts reduce guidance clarity. |
| Motion | 4.1 | The sampled opening, loaded raise/closure, reverse entry, gear poses and landing preserve visual attachment without observed gross clipping. This score is limited to these views and poses; sparse frames cannot certify full-time flicker, every joint or LOD transitions. |

Mean of five applicable scores: **3.86**. No free score was assigned for an unexamined dimension.

## Disposition and limits

Freeze this candidate as **changes requested**, retaining G13-GAME-01 and all original evidence. Recheck the corrected live MFD against the same authoritative post-transfer contents in a fresh game capture before closing the information finding. Existing clear sightlines and sampled physical mechanisms need no new asset change from this review.

No FPS/frame-time, GPU budget, texture residency, physical-device, keyboard/touch completeness, save reload, multiplayer, all lighting conditions or full exterior art claim is made. The HUD's instantaneous FPS is not performance evidence. This review neither changes the independent studio grade nor grants deployment or user acceptance.
