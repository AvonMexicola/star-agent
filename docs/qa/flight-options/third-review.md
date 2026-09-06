# Independent flight-options review — third visual pass

**Decision: CHANGES REQUIRED. Bounded visual score remains 3.83 / 5.00.**

Candidate **32782e5**, branch `feat/flight-options`, production preview 5290. I inspected the actual middle-layer diff against 89ce649, then made independent captures. The builder committed identical runtime source during this review. Separate Codex reviewer under HANDOFF TOKEN POLICY v2; no source edits. Reports from the first and second passes remain preserved.

## Finding

**P2 — the grass representation transition remains conspicuous.** The new middle layer substantially improves the original 6–10 m gap: individual middle blades fill the bare area and their color is much closer to the fine foreground. The remaining bright dense-field-to-sparse-card boundary is now farther away, around the 20–28 m overlap. Broad muted olive clusters still reveal substantially more pale ground than the fine/middle blades. Forward movement makes the extent of the bright field around the player apparent.

This is the unresolved portion of the original material/coverage finding, not a new acceptance requirement. See `src/distant-meadow.js:7` and `:17` for the far blade mask/cards, `:26` for the middle blades, `:53` for the two overlap intervals, and `:98` for instance scale. Matching root-to-tip RGB constants is useful, but the rendered silhouette, coverage and apparent color still differ.

Concrete independent evidence: `meadow-80-walking-3.png`, `meadow-160-walking-3.png`, and `meadow-160-stopped.png` in the directory below. The stopped 160 m frame has terrain settled and both grass jobs complete; the discrepancy is therefore not explained by a pending replacement. All frames use render scale 1.

Required correction remains a visually continuous transition in blade silhouette and projected coverage into the far cards. Calibrate the far mask, cluster structure and coverage against the middle field at the actual overlap distance; inspect its apparent color after lighting and alpha filtering. Merely moving the transition farther away or adding more instances does not establish acceptance. No whole-terrain or sky appearance change is requested by this finding.

## Rubric

| QUALITY criterion | Score | Assessment |
|---|---:|---|
| Silhouette and scale | 4 | Existing reviewed gear, held tools and UI retain their accepted bounded presentation. Middle grass has a more suitable blade silhouette. |
| Materials and detail | 3 | Grass is improved, but dense bright blades still change to broad sparse olive clusters at the outer overlap. |
| Lighting and integration | 4 | Previous dark near-grass band is removed; ship/suit lighting observations remain accepted. |
| Cohesion | 4 | Existing interface, MFD and equipment visual language remains consistent. |
| Information design / function | 4 | Previously corrected B/Y MFD hints and graphics controls remain accepted. |
| Motion | 4 | No additional discrete grass disappearance identified in sampled walking frames. Source now derives phase from canonical positions, avoiding the former origin-dependent wind phase. Material transition is counted above. |

Average **23/6 = 3.83**; no criterion below 3, but required average 4.0 is not met. This is not approval of PR34 or a waiver of inherited scene budgets. No polish waiver was supplied to this reviewer.

## Independent method and evidence

Evidence: `/tmp/star-agent-flight-options-third-independent/`.

- `meadow-80-stationary.png`, five `meadow-80-walking-N.png` frames and `meadow-80-stopped.png`.
- `meadow-160-stationary.png`, five `meadow-160-walking-N.png` frames and `meadow-160-stopped.png`.
- `metadata.json`: renderer/browser, position, actual speed, render scale, terrain settling and both meadow layers' publication statistics.
- `page@cc0da82c9dc6a2abd1b949cfe983c328.webm`: recording of the capture run, retained for follow-up inspection.
- Capture script: `/tmp/star-flight-third-capture.mjs`.

Chromium **151.0.7922.173**, hardware **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**; **1600×900**, DPR 1, render scale explicitly pinned to **1** throughout both ranges. Seed 7291, canonical meadow latitude 15.74 / longitude 22.44, walking eye height 1.75 m. Debug navigation placed the initial controlled fixture, followed by actual W walking at approximately 4.5 m/s. The initial and final stationary frames wait for settled terrain and completed middle/far publication. Normal terrain streaming occurs during the walks. A first-person item occupies the right side; the centre and left provide clear unobscured grass evidence.

Middle layer had approximately 43,200–43,500 instances, and far layer approximately 19,500 at 80 m or 63,000 at 160 m. The middle field published successfully after movement. **Zero browser errors or warnings** were recorded. No GPU/frame-time claim is made from this run, which also recorded video; previous whole-scene budget limitations remain open.

Independent CPU checks: `node --test tests/meadow.test.js` **6/6 passed**; `git diff --check` passed. These tests cover existing meadow invariants, not every new middle-layer behavior. Actual shader compile/render and settled publication were established by the browser captures. Source review found no new concrete functional failure path in the new layer, split generation budget, phase attribute publication or disposal.

Unchanged graphics UI phone/desktop, Nomad/Atlas gear, free drive, equipment, lights and B/Y MFD results remain documented in the earlier reports. They were not all rerun during this narrowly scoped grass pass. The builder separately reports the affected feature browser case passing 1/1.

GPU lane released after capture. No merge, deployment or repository mutation performed.
