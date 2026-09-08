# Stratum final04 — independent actual-game review

**Changes requested for gameplay presentation.** The recorded controller journey passes, and the actual-game evidence corroborates the clear cockpit, physical boarding route and paired mining operation. It also exposes two integration defects: a deployed ramp labelled closed and collected-mineral effects flying through the seated view. This review does not change the frozen Art04 studio assessment or approve a later source revision.

Reviewer: `/root/nomad_cutter/nomad_reviewer`, independent of the Stratum builder and main cabin-light helper. I authored Gannet assets, not the hull or lighting reviewed here. I read the completed evidence, decoded recorded frames on the CPU and inspected them at their original size. I did not run a browser, change production files or repeat the controller test.

## Exact candidate and evidence

- Captured source: `e727d8e8e72c7b36e662232fbb02c3a313c1ca67`; capture owner identifies the served bundle as `mainbuild15 / main-B5-qTCnz`.
- Stratum GLB: `1f5cae2a4901a2618d7cff36f1713a19777b45d586022614b9bc5449560cb75b`, independently matched against the current unchanged asset bytes; 3,867,188 bytes and 59,224 indexed triangles.
- Main evidence: `/home/cees/projects/.medium-ships-qa/stratum-controller-final04`. All ten original PNGs were inspected. I also inspected 48 ordinary frames from the finalized 148.400-second main video, including a six-frame ramp-opening sample and a six-frame collection-effect sample. One frame from the separate 1.360-second auxiliary video is blank and contributes no art evidence.
- Screenshots and video: 1440 × 900. The recorded drawing buffer is 1152 × 720, so this is a 0.8 render-scale game capture. Chromium reports `151.0.7922.173`. The recorded renderer string is retained in the manifest as capture metadata; this review makes no new hardware or performance validation claim. The video's 25 fps encoding rate is not game FPS.
- `journey.json` reports `PASS`, stable before/after hashes for 29 paths, no errors, no warnings and no failed requests. `.last-run.json` reports passed with no failed tests. The capture owner reports 1/1 controller case, 2.5 minutes / 2.6 minutes total, exit 0. These are the producer's recorded results, not tests rerun by this reviewer.
- Full source hashes, original-file hashes, frame indices and video presentation timestamps are in [the evidence manifest](/tmp/star-agent-stratum-final04-game-review-evidence/evidence-manifest.json). The smaller [receipt summary](/tmp/star-agent-stratum-final04-game-review-evidence/receipt-summary.json) retains the relevant numerical observations without copying the complete journey trace.

## What the game corroborates

The seated views in originals `00`, `03`, `06` and `08` retain uninterrupted central glazing and four usable MFD faces. The landed and returned camera is at ship-local approximately `[0, 2.9, -5.8]`, using the recorded actual-game 66° FOV. Flight, navigation, cutter charge/ore and ramp/gear state are legible. No opaque central mullion or backing blocks the displays. This is distinct from the studio camera review.

Video PTS 60–104 seconds shows the actual cabin, ramp approach, terrain exit and return. The aisle, raised bin bodies and supporting bases read as a traversable space; ceiling strips and entry lamps provide attached sources. The ramp visibly rotates downward at PTS 68.000, 68.400 and 68.800 before the opening clears. The recorded continuous route has 222 outward and 115 inward samples, both with zero continuity offenders, maximum world steps of 0.259 m and 0.207 m and maximum support error below 1.9e-9 m. Ramp closure occurs behind the camera; its animation is not visually accepted here solely because its state reaches secured.

Original `04` and video PTS 126–128 show two beams converging on the selected rock, changing the rock and increasing the dedicated ore balance. The receipt compares both starts with the loaded GLB's `Muzzle_Mining_Port` and `Muzzle_Mining_Starboard`: each start error is zero, direction errors are below 2.5e-16 and both unobstructed hits are approximately 21.678 m away. This is numerical corroboration of true barrel-based casts. **Visible emergence at both barrel lips remains unproven by this capture:** cockpit origins are outside the frame; original `05` and PTS 129–131 are rear chase views with the forward hardware hidden by the hull and central HUD card.

The dedicated ore bin finishes at 0.8871486193 kg, displayed as 0.89 kg. The recorded inventory transfer moves 0.0020323645 kg of helium-3 regolith into the backpack. Supplies stay unchanged. The inventory screenshot and video show the actual controller focus and transfer route; the UI rounds this tiny transfer to `0.00 kg`, a residual precision/communication limitation. Dialog, native focus, disconnect, replacement and unsupported-device gates each record PASS. This is injected W3C Gamepad input with a recorded native focus interruption, not a physical-controller claim.

## Findings

1. **P2 — deployed ramp falsely reports CLOSED.** Original `02-physical-ramp-on-terrain.png` and PTS 76/88 show the open portal and deployed ramp while the recovery marker reads `REAR BOARDING RAMP · CLOSED`. The matching egress state is `ramp: 1, target: 1, secured: false`. Captured `src/ship-marker.js` reads the legacy `nav.doorOpen`, independently of the medium mechanism. Read the selected mechanism's actual readiness for this label, including a waiting state during motion. Root owns this correction. Its proposed source fix was read separately and appears consistent, but no corrected native receipt is part of final04: this finding remains open in this frozen record.

2. **P2 — ship ore-collection motes enter the pilot view.** [PTS 127.200](/tmp/star-agent-stratum-final04-game-review-evidence/frames/detail-08.png) shows large mineral sprites over much of the navigation/mining/cargo MFD area and right forward glass. This recurs at PTS 126.600, 126.800, 127.000, 127.600 and 127.800; it is not confined to one still. The paired beams remain targeted. Captured `src/main.js` forwards successful extraction to generic `effects.collect`; captured `src/effects/flight-effects.js` always places its collector at `nav.position + rotated(0.2, -0.35, -0.15)`. The generic attraction therefore brings ship-cut feedback to the pilot vicinity. Give ship extraction a physically appropriate external intake destination, or keep its feedback near the cut; preserve on-foot collection and the ore ledger. This is an effects integration correction, not a reason to alter the Stratum hull.

3. **P3 — overlapping HUD reduces task clarity and evidence coverage.** The surface-resource card overlaps landing/camera toasts, the persistent arrival-zone card occupies the near-target region, and planet markers cross the MFD header region. Original `05` hides the forward cutter assembly behind that central card. Most settled MFD values remain readable, but the camera/landing instruction is partially obscured. Allocate a non-overlapping status area and obtain a bounded side/quarter active-cut view for visual muzzle-emergence closure. The overlap is observed in this integration; this review has not established when the shared HUD issue was introduced.

4. **P3 — cabin lighting is usable but locally harsh.** PTS 60, 64, 92 and 96 show legible wall/bin/floor relationships, with very bright pools at the strip positions washing out the nearby ceiling/wall detail. Bin bases remain grounded and readable; I see no demonstrated floating furniture in these frames. Broad material detail is softer than the studio under the recorded render scale and video compression. Any refinement should target local emitter response while retaining the readable aisle, not increase global exposure. This is an advisory finish limitation, not an allegation of missing lamps or a new geometry defect.

## Scoped QUALITY assessment

Scores assess only visible actual-game presentation at this capture quality. Successful assertions do not earn art points.

| Criterion | Score | Evidence and limit |
| --- | ---: | --- |
| Silhouette and scale | N/A | Only cropped rear/near-entry and small rear-chase views; insufficient new coverage to re-score the complete hull or its stricter 4.5 silhouette target. The separate Art04 studio gate remains unchanged. |
| Materials and detail | 3.9 | Ceramic/dark structure/mint and restrained amber remain distinct; actual cabin and MFD surrounds have readable fitted edges. Broad surfaces are subdued and fine relief is limited at 0.8 render scale. |
| Lighting and integration | 3.8 | Attached sources make the aisle, bins and entrance usable, with readable contact; near-strip highlights wash out local detail. |
| Cohesion | 4.2 | The hull interior, controls and inventory retain the Meridian/shared interface language. |
| Information or physical function | 3.6 | All four live MFDs and the physical access route work, but the deployed marker is false, tiny transfer feedback rounds to zero and HUD layers compete. |
| Motion | 3.6 | Visible opening and physical traversal are coherent; paired cuts and release feedback read correctly. Recurrent mineral sprites crossing the seated view undermine the active mining presentation. Closing, external gear motion and visible barrel-lip emergence are not scored as passed. |

**Applicable mean: 3.82/5; lowest: 3.6.** The current-game scope is below the required 4.0 mean. No threshold waiver is assumed. This does not reverse or inflate the distinct studio result: the same asset's geometry/material studio assessment is retained, while these main-game integration corrections need their own follow-up evidence.

## Limits and follow-up

Preserve final04 as the successful functional run with these visual findings. Close the false marker and cockpit-bound collection effects with exact changed source identities and new actual-game originals/motion; obtain an unobscured view of both active barrel lips if claiming their visual emergence. Do not relabel this recording after fixing the source.

The Art04 studio report remains unchanged at `/tmp/star-agent-stratum-art04-independent-review.md`, SHA `0fbc1b39d199fd0c337686e3d647e16e41167a9e57b8ae2d447bd1676347cccb`. Earlier failed studio iterations remain historical evidence. This review establishes no phone/touch/keyboard result, live multiplayer authority, durable reload persistence, hardware-controller coverage, cold/warm resource budget or FPS result. Practice-memory bytes were parsed during the producer's run; they do not prove browser reload durability. The displayed FPS HUD is not a benchmark. Sampled frames cannot exclude every intervening flicker, collision or LOD fault. Root and Cees retain integration and product acceptance.
