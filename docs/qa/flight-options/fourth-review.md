# Independent flight-options review — fourth visual pass

**Decision: CHANGES REQUIRED. Scoped score: 3.83 / 5.00.** The earlier grass material/coverage finding is resolved in this candidate. A reproducible middle-field streaming gap remains during forward walking.

Candidate **2da9636**, `feat/flight-options`, production preview 5290. Separate Codex reviewer under HANDOFF TOKEN POLICY v2; read-only source review and independent browser captures. Previous three reports remain preserved.

## Required correction

**P2 — walking can outrun the retained middle grass before replacement publication, exposing a bare band.** `src/distant-meadow.js:50` defines only 10 m extra generation margin for the middle field; `update` triggers a replacement after 8 m displacement, generates the whole field within its 0.8 ms budget, and retains the old mesh until completion. The combined trigger distance and publication latency exceed that margin in the actual full-resolution walk.

At the start of the 160 m sequence, both jobs and terrain are settled. In `meadow-160-walking-3.png`, the player has moved **19.88 m** from that position while middle rebuild count remains **3**, unchanged from the start. A clear bare transverse strip separates foreground/middle blades from the far field. It remains conspicuous in `meadow-160-walking-4.png`; the first replacement has then published, but is already behind the moving player. By `meadow-160-stopped.png`, middle rebuild count is 6, pending is 0, terrain is settled, and the strip is filled.

This is a field publication problem rather than the previous olive-card material mismatch. Source and telemetry support the cause: the original generated middle radius is 28+10 m, the visible radius is 28 m, and the player moves farther than the spare margin before the complete replacement arrives. The far field begins fading in at 20 m, so missing middle coverage becomes visible ahead of the player.

Required behavior: retain complete middle coverage throughout ordinary forward walking while preserving the bounded CPU generation work. Account for trigger distance plus worst observed publication delay when sizing or scheduling the retained coverage; consider incremental spatial publication or earlier/predictive preparation. Verify a continuous full-resolution walk long enough to cross multiple middle publications, with no exposed band or later fill-in. Simply enlarging the generated region may also enlarge publication latency, so validate the resulting behavior.

## Resolved findings and rubric

The filtered-alpha treatment, RGB padding, individual blade gradients and independently seeded cluster coverage now produce continuous apparent grass color and useful far coverage at 80 m and 160 m. The former broad sparse olive outer field no longer dominates the transition. Fine screen-door grain remains visible; it is a bounded quality limitation, not a second material blocker in this pass.

| QUALITY criterion | Score | Assessment |
|---|---:|---|
| Silhouette and scale | 4 | Previously reviewed gear/tool/UI observations remain accepted; layered grass silhouettes now transition acceptably. |
| Materials and detail | 4 | Previous near/far color and sparse-card discrepancy is resolved in the new full-resolution captures. |
| Lighting and integration | 4 | Continuous grass color response; prior bounded lamp observations remain accepted. |
| Cohesion | 4 | Existing UI, MFD and equipment visual language remains consistent. |
| Information design / function | 4 | Previously corrected B/Y hints and graphics controls remain accepted. |
| Motion | 3 | Middle-field publication falls behind ordinary walking and exposes a temporary bare strip. |

Average **23/6 = 3.83**. No criterion below 3; average remains below 4.0. This is not whole-PR34 approval, a waiver of inherited scene budgets, or permission to merge/deploy.

## Evidence and validation

Directory: `/tmp/star-agent-flight-options-fourth-independent/`.

- For each 80 m and 160 m range: `meadow-RANGE-stationary.png`, five `meadow-RANGE-walking-N.png` frames, and `meadow-RANGE-stopped.png`.
- `metadata.json` records renderer, browser, actual position/speed, render scale, terrain settlement and middle/far pending/publication statistics.
- `page@e31ad2b72e5abd95a4321758f4fcec31.webm` retains the capture run for follow-up inspection.
- Script: `/tmp/star-flight-fourth-capture.mjs`.

Chromium **151.0.7922.173**, **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**; **1600×900**, DPR 1, render scale pinned to **1** throughout. Seed 7291, canonical meadow latitude 15.74 / longitude 22.44, eye height 1.75 m. Debug placement establishes the fixture, then actual W walking advances at approximately 4.5 m/s. The tool is holstered, so these grass views are unobscured. Initial/final views wait for settled terrain and completed grass work. Normal terrain streaming during movement is recorded.

**Zero browser errors/warnings**. Independent `node --test tests/meadow.test.js`: **6/6 passed**; working tree was clean at 2da9636. These tests cover existing meadow invariants and do not establish the newly failed streaming behavior. Source inspection found no color-space, double-tint, alpha-order or unstable phase mistake in the coverage correction itself.

No FPS or portable performance claim is made from this video-recorded run. Unchanged phone/desktop graphics UI, gear, lamps, equipment, free-drive and MFD observations remain attributed to the earlier independent passes; this pass did not repeat all those journeys. Builder separately reports production build and affected feature browser 1/1 passing.

GPU lane released after captures. No source edits, merge or deployment performed.
