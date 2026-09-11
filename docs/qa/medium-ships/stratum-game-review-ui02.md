# Stratum UI02 — independent actual-game follow-up

**Scoped PASS with advisories: 4.02/5 across the five visible dimensions.** The corrected recording closes the two presentation findings from final04: the deployed ramp now reads `APPROACH SLOWLY`, and ship-mining collection feedback stays near the cut instead of crossing the seated MFDs. The cargo MFD also truthfully shows `SHIP STORAGE: 136.0 kg`. Geometry, camera and cabin-light scores are unchanged. This is a separate follow-up, not a relabelling of the failed 3.82 final04 review or a complete asset/release acceptance.

Reviewer: `/root/nomad_cutter/nomad_reviewer`, independent of Stratum geometry and the main lamp helper. I authored Gannet assets, not the hull reviewed here. I inspected existing originals and CPU-decoded video frames; I did not launch a browser, repeat the gameplay test, or change production files.

## Exact candidate and completion semantics

- Captured source: `3cf80ada9ef43f3fba3dfc801667d3ee57548b01`; producer identifies the served bundle as `build18 / main-4jz7U8ns`.
- Unchanged Stratum Art04 GLB: `1f5cae2a4901a2618d7cff36f1713a19777b45d586022614b9bc5449560cb75b`, 3,867,188 bytes / 59,224 indexed triangles. Current asset bytes independently match the captured hash.
- Evidence root: `/home/cees/projects/.medium-ships-qa/stratum-primary-final-ui02`. All **nine original 1440 × 900 PNGs** were inspected. I also inspected **34 ordinary original-size frames** from the finalized 112.280-second VP8 main video, spanning the route and sampling the active-mining/return window closely. A separately decoded first frame from the 1.000-second auxiliary video is blank and earns no visual credit.
- The completed `keyboard/journey.json` reports `PASS`, phase `actual-pilot-control-return`, no failed phase, empty errors/warnings/failed-request arrays, and matching before/after identities for **33 source/asset paths and four fixture paths**. All 33 current source/asset bytes also match that receipt. The captured worktree includes documentation/task changes; a clean worktree is not claimed.
- `test-output/.last-run.json` says passed with no failed tests. The producer reports **Playwright 1 passed, 1.9 minutes / 2.0 minutes total**. The **outer exec wrapper returned 143 afterward, cause unknown**. I do not claim a clean shell exit or infer its cause from the completed journey/video. Earlier UI01 is a separately retained setup failure reported as a missing dev launcher in build17; none of its evidence is counted here.
- Chromium reports `151.0.7922.173`; recorded drawing buffer is **1152 × 720 at 0.8 render scale**, within the 1440 × 900 capture. The renderer string is preserved as producer metadata, not independently verified hardware. Video encoding at 25 fps and the visible FPS HUD establish no game-performance result.

The [evidence manifest](/tmp/star-agent-stratum-ui02-game-review-evidence/evidence-manifest.json) pins originals, finalized videos, sampled frames, source identities and preserved earlier reports. The [compact receipt](/tmp/star-agent-stratum-ui02-game-review-evidence/receipt-summary.json) retains selected numerical results without duplicating the full journey trace.

## Concrete comparison with final04

**Ramp marker — closed in this follow-up.** Original `02-actual-terrain-ramp-view.png` and video PTS 76.000 show the real lowered ramp and clear aft portal beside `REAR BOARDING RAMP · APPROACH SLOWLY`. In final04 the same deployed mechanism was labelled `CLOSED`. The current source reads the medium system's `accessStatus`; Stratum waits during motion and only reports approach when progress and target both equal one. This matches the visible ready state. The separate Gannet getter also waits for motion/queued operations and requires the open hatch plus the lowered lift before offering approach; that is a read-only source check, not new Gannet image acceptance.

**Collection feedback — closed within the sampled actual-game scope.** Original `04-native-twin-cutters.png` and PTS 102.000–104.200 show paired beams and small feedback at the rock. The rear-chase portion at PTS 104.600–105.000 and subsequent seated frames through PTS 112.000 show no recurrence of the large collected-mineral sprites over the MFD row. Small delayed bursts visible near the rock remain external after inventory/focus transitions. This is a concrete improvement over [final04 PTS 127.200](/tmp/star-agent-stratum-final04-game-review-evidence/frames/detail-08.png), where ice/mineral sprites obscured several displays. It is bounded sampling, not an assertion that every uninspected video frame or future state is defect-free.

The inspected source is consistent with those images: `main` uses the committed extraction `destination`, preserving default backpack attraction and passing `attract: false` for a vehicle bin. `EnergyEffects.collect` forwards that option to the spray. The mining job retains its destination, so a late result does not decide its feedback from the player's later seat. No asset, camera, exposure, particle shader or mining-ledger change is credited for this correction.

**Cargo MFD — truthful in the recorded case.** Originals `00`, `03`, `04`, `07` and the final frame show `SHIP STORAGE: 136.0 kg`. The canonical item catalog and saved `ship` container account for 103 kg of processed materials (80 concrete + 16 metal stock + 3 conductor + 4 glass) plus 33 kg of supplies (3 repair × 4 kg + 12 ration × 0.5 kg + 6 sample × 2 kg + 1 scanner × 3 kg). The new adapter uses the unified `itemMass` calculation, removing the former supplies-only omission. This label describes that storage container; it does not claim total vessel mass or include the separate ore bin/backpack.

The visible Tab/Enter transfer in original `06` and PTS 105.800–106.200 moves **0.3673965511 kg basalt** from the dedicated ore container to the pack. The paired snapshots show that exact quantity leaving one and entering the other; the inventory displays 0.37 kg basalt and approximately 1.4 kg total pack mass. The final separate ore balance is **0.2972675483 kg**, matching the final MFD's **0.30 / 384 kg**. Ship storage stays at 136 kg. These are actual recorded practice-memory snapshots, not a browser-reload persistence test.

## Preserved cockpit, cabin and mechanism observations

Originals `00`, `03`, `07` and `last-frame` retain the actual-game **66° seated FOV**, clear central glazing and four readable MFD faces. No opaque central strut or backing covers the display surfaces. Recorded display-centre projections remain within the frame, but those projections are not an occlusion certificate; the originals were read visually. Fine text remains softer at the recorded 0.8 render scale.

Cabin/ramp samples at PTS 60–88 show a usable central aisle, fitted bin bodies/bases, attached ceiling/entry emitters, a visibly opening ramp and real terrain access/return. The receipt records 90 outward and 61 inward continuity samples, zero offenders, maximum world steps 0.560 m / 0.764 m and support error below 1.9e-9 m. These keyboard-route numbers are not substituted for final04's different controller trace. Closure happens behind the returning camera; full external gear motion is also off-camera and remains unscored as a visual claim.

The two visible cuts and two recorded unobstructed beam hits corroborate paired mining. **This recording still does not clearly expose both barrel lips.** Original `05` and the rear-chase frames hide the forward cutter assembly behind the hull and central arrival HUD. UI02 does not contain a fresh loaded-muzzle/start comparison; the numerical muzzle proof in final04 stays evidence of that older run. Do not promote it to new visual emergence proof.

## Residual advisories and scoped QUALITY score

The surface-resource card still overlaps camera/braking toasts, the arrival-zone card occupies the near-target area, and planet markers cross MFD headers. The values are mostly readable, but shared HUD placement remains untidy and limits exterior cutter evidence. Very bright near-strip pools still wash out local ceiling/wall detail; the aisle and furniture contact remain legible. Tiny helium/copper quantities can still round to `0.00 kg`; the larger basalt transfer is clear, but no general precision fix is claimed.

| Criterion | Final04 | UI02 | Evidence and limit |
| --- | ---: | ---: | --- |
| Silhouette and scale | N/A | N/A | Near-ramp and small rear-chase coverage cannot re-score the complete hull or its stricter 4.5 target. Separate Art04 studio review remains unchanged. |
| Materials and detail | 3.9 | 3.9 | Fitted edges and ceramic/dark/mint separation remain readable; broad finish and fine relief remain subdued at this render scale. |
| Lighting and integration | 3.8 | 3.8 | Attached sources and readable contact; unchanged near-strip washout. |
| Cohesion | 4.2 | 4.2 | Consistent Meridian controls, cabin and shared interface language. |
| Information or physical function | 3.6 | 4.1 | Correct access readiness, truthful storage/ore displays and visible physical transfer/return; HUD overlap and tiny-quantity rounding remain. |
| Motion | 3.6 | 4.1 | Coherent visible opening/traversal and external cut-local feedback, with the previous cockpit-bound effect absent from the inspected mining sequence. Off-camera closing, external gear movement and barrel-lip emergence earn no added credit. |

**Applicable mean: 4.02/5; lowest: 3.8.** The limited current-game presentation clears the 4.0/no-item-below-3 rubric without a waiver. Scores for unchanged materials, lighting and cohesion are deliberately unchanged. The higher mean follows the two demonstrated information/motion corrections; it does not inflate the hull's studio score or erase the previous failed assessment.

## Retained failures and limits

The final04 report remains unchanged at `/tmp/star-agent-stratum-final04-game-review.md`, SHA `2f0c6281586f090a1e2fb2121ff42eb0bdd7807a96c2ba58a7156bd77d7f21e1`, including its 3.82 mean and original defects. The Art04 studio report remains unchanged at `/tmp/star-agent-stratum-art04-independent-review.md`, SHA `0fbc1b39d199fd0c337686e3d647e16e41167a9e57b8ae2d447bd1676347cccb`. Its 4.5 silhouette result is separate evidence, not a newly measured UI02 score.

An optional reviewer Node mass-recomputation probe failed before assertions when its `git show` child process raised `spawnSync git EPERM` under Node 26.7.0. It was reported once and not retried/escalated; no test pass is claimed for it. The source/receipt arithmetic above remains a read-only cross-check, and that reviewer-runner failure is distinct from the producer's unexplained wrapper exit 143. [The limitation receipt](/tmp/star-agent-stratum-ui02-game-review-evidence/reviewer-probe-limit.json) preserves it.

This review establishes no physical input-hardware, touch/controller rerun, multiplayer, cold/warm memory, FPS or durable browser-reload result. It corroborates the producer's native-keyboard route at the declared capture quality, not a new test run by this reviewer. Samples cannot exclude every intervening flicker or collision. Main-game and studio lighting claims remain separate. Root retains integration/release ownership and Cees retains product acceptance.
