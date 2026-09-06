# Independent flight-options review — first visual pass

Decision: **CHANGES REQUIRED — 3.67 / 5.00** for the bounded flight-options visual scope. This is not whole-PR or whole-game approval. Reviewer is a separate Codex session under shared HANDOFF TOKEN POLICY v2; no source files were edited.

## Scope and evidence

Reviewed the uncommitted candidate in `/tmp/star-agent-flight-options`, based on `6f80fc0`, served as a production build at `http://127.0.0.1:5290/`. Scope: N free-heading drive, G gear, L ship/suit lighting, B landing binding, third-person Equipment attachment/aim correction, distant meadow, graphics settings. Existing planet/cloud/terrain appearance and inherited total-scene budget excesses are not approved by this review.

Own captures: `/tmp/star-agent-flight-options-independent/`. Chromium **151.0.7922.173**, hardware **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**; desktop **1600×900**, phone UI **390×844**, DPR **1**, desktop render scale **1**. Both capture runs recorded zero browser errors/warnings. Metadata: `metadata.json` and `settled-metadata.json`.

These are controlled visual fixtures using debug navigation for positioning, with real runtime rendering and real keyboard gear/drive/tool actions. Atlas uses a saved-unlocked-fleet fixture. They are not evidence of a physical boarding journey or physical controller testing. The builder's separate controller journey was not relabelled as my own work.

An initial capture attempt reached stale terrain-settled state immediately after debug repositioning. Its early character/night frames contain transient LOD artifacts. They were explicitly rejected and recaptured after LOD >=16, settled terrain, completed meadow work and additional stable frames. Use `character-*-final.png`, `suit-light-*-final.png`, `ship-light-*-final.png`, and `nomad-gear-down-final.png` for final inspection. The first Atlas-down screenshot also catches the inherited loading fade; it establishes gear state, not a clean presentation baseline. Atlas-up is clear.

## Rubric

| QUALITY criterion | Score | Assessment |
|---|---:|---|
| Silhouette and scale | 4 | Gear endpoints read; character holds a correctly scaled item; settings fit both viewports. |
| Materials and detail | 3 | Far grass reads as pale, broad repeated cards against the much finer dark nearby blades. |
| Lighting and integration | 3 | Ship/suit illumination is useful and bounded, but the grass lighting mismatch produces an obvious circular transition. |
| Cohesion | 4 | Graphics dialog uses existing tokens/chrome and strong visible focus. Gear/weapon additions retain the existing asset language. |
| Information design / function | 4 | Controls, graphics values and drive state are useful. Correct the stale MFD landing key before acceptance. |
| Motion | 4 | Gear reaches both endpoints; held weapon follows animation and firing. Streamed grass replacement retains the prior field. No new motion blocker identified in the bounded checks. |

Average: **22 / 6 = 3.67**. No item is below 3, but the required average of 4.0 is not met.

## Ranked required corrections

1. **P2 — grass transition remains conspicuous.** `src/distant-meadow.js`, `clusterGeometry`, `onBeforeCompile` lighting treatment and per-instance colors; compare with `src/meadow.js`. In `meadow-160m.png` and `character-rifle-final.png`, dark finely divided foreground blades end in a visible arc at approximately 10 m, replaced by pale, broad repeated clusters. The range fade does not conceal the change in lighting and blade scale. Match near/far response, silhouette density and color through the overlap, then inspect a forward walking sequence across the boundary at 80 m and 160 m settings.
2. **P2 — cockpit advertises the previous landing binding.** `src/ship-mfd.js:103` still paints `L LAND / LAUNCH`. The text is clearly visible in `ship-light-on-final.png`. The new L action changes lights, so this directs a landing pilot to the wrong action. Change it to B and verify the rendered footer.

## Passed bounded observations

- Graphics dialog is readable, unclipped and usable at 1600×900 and 390×844; the first option has a strong visible focus indicator. Modal scene draw counts settle to zero. See `graphics-desktop.png` and `graphics-phone.png`.
- Nomad and Atlas each expose four authored gear assemblies and reach progress 0 and 1. Landing shoes retract; the unchanged thin Atlas guide structures are present in both states. This does not claim retracted collision dimensions: the implementation deliberately retains deployed collision bounds.
- N starts free-heading travel and controlled cancellation returns to zero speed. See `free-heading-drive.png`.
- Rifle, pistol and cutter are parented to the visible third-person character. Rifle firing was captured. The new `aimHeld` correction updates the right wrist and support-arm joints after animation; no new functional issue was found in its source or these neutral-aim views. This is not an exhaustive pose-angle or animation review.
- The suit lamp illuminates nearby grass while the surrounding night stays dark; the ship lamp lights a wider area ahead of the cockpit. Off/on pairs use identical settled positions. No new illumination blocker remains after rejecting the early transient terrain frames.

## Functional corrections retained from source review

The builder corrected the reproduced low-altitude lunar free-drive terrain penetration, synchronous meadow enumeration spike, holstered aiming pose, stale help bindings and INERTIAB typo. Independent targeted tests initially passed63/63; the lunar reproduction now rejects its unsafe ray. Read-only CPU harness measurements after budgeting candidate enumeration were 1.65–2.36 ms first-frame work and a maximum observed 4.54 ms, compared with23–50 ms previously. These are CPU timings, not FPS or GPU-budget claims.

The changed scene still needs honest total budget accounting. One 1600×900/160m-meadow capture recorded496 draws and1,801,364 triangles. The settings modal recorded zero draws. Existing full-scene budgets are not waived, and this review does not assert a universal performance improvement.

Next gate: focused independent recapture after grass cohesion and MFD binding corrections, plus the builder's final physical controller/boarding regression evidence.
