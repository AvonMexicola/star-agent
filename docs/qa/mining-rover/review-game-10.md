# Burrow candidate 10 — independent keyboard game and motion review

**Keyboard route: scoped PASS. Motion: 3.8/5. Final product/input acceptance remains pending.** The recorded route now provides actual movement evidence for boarding, driving, sustained cutters and reloading. The settled cockpit is usable. Two small presentation findings remain: the MFD footer is partly buried in the dashboard, and the chase camera makes an abrupt inward adjustment beneath the Atlas cargo ceiling.

Reviewer: `/root/kestrel_reviewer`, 2026-09-07. No browser/GPU was launched and no production file was changed. I inspected the supplied eight game PNGs, the journey/native-focus/access records, and CPU-extracted intervals from the original keyboard video. The parent ran the input fixture; this is an independent inspection of its recorded result, not a claim that I personally operated a keyboard or phone.

## Identity and scope

Recorded runtime is the parent's frozen `f92a3a2` production checkpoint, with the bounded runtime corresponding to `84860a6` and later fixture-only changes. The original keyboard evidence is under `/home/cees/projects/.mining-rover-qa/input-02/keyboard/` and its `test-output/*keyboard/video.webm`. The source hashes in `journey.json` are identical before and after the run.

- GLB SHA256: `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`, 21,570 triangles / 2,177,260 bytes.
- Layout SHA256: `2d3912564b0cd16d212ae47fa528d475cc93a2941dcbdce10cbbad3b1e231a38`.
- Recorded `src/mining-rover.js` SHA256: `c3891b876967525d5b19b047ba7d1c24be12b1ced16f32b249ed4e753e1bcd0e`.
- Main video SHA256: `df750904a58ae3ece91ec3913536b1c701b1caed74b73e421fe3f1555c5c8e98`.
- `journey.json` SHA256: `b58a93cbf0a188b6a15dd5c6fc03e052b65d572a76e97d68bed37af8f036d286`.
- `native-input.json` SHA256: `14452ec3dd8517601c16f821782e7c4bb70c13049b41e3f41ea130f9a14eb560`.

Chromium 151.0.7922.173, ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2. Viewport 1440×900, DPR1, actual game render buffer 1152×720 at scale0.8. The VP8 recording is 1440×900, 25fps and 168.960s long. Errors, warnings and failed-request arrays are empty. Input is Playwright keyboard input through the actual controls, not human hardware testing.

The candidate10 native static result **4.04/5 remains unchanged** in `review-visual-10.md`. This report adds a **3.8 motion score** for the recorded keyboard scope. The arithmetic of the five previous native scores plus motion is `(20.2 + 3.8) / 6 = 4.00`, but that remains a mixture of explicitly scoped native and game evidence. It is not an all-platform acceptance decision, a replacement whole-game lighting score or performance approval. The footer update and final touch route were not in this keyboard recording.

## Motion evidence actually inspected

I inspected 267 interval frames, including overlapping detail probes, plus a 20-frame coarse timeline and all eight original game screenshots. Contact sheets and extraction manifests are under `keyboard-motion/` beside this report. Most sequences are sampled; the wheel detail contains every recorded frame for its 1.28s interval. No claim is made to have watched all 25fps of the full journey.

| Original video PTS | Sampling | What it shows |
| --- | --- | --- |
| 61.00–71.52s | 2fps, 22 frames | Door-side approach, progressive camera passage beneath the header, settling into the cockpit, start of lift descent. |
| 72.00–81.00s | 1fps, 10 frames | Lift finishes descending, forward departure, readable live speed changes, deliberate switch to chase camera. |
| 82.00–96.68s | 3fps, 45 frames | Surface travel and turning, followed body/camera orientation, attached wheels and stable body parts. |
| 85.00–86.24s | Full recorded 25fps, 32 cropped frames | Changing near-wheel rim phase while terrain passes beneath the vehicle; attached body and fenders. |
| 98.00–115.52s | 2fps, 36 frames | Twin beams held on a mineral target, increasing ore, beam-off states and resumed driving. |
| 106.40–111.80s | 5fps, 28 frames | End of sustained extraction, real cargo modal at109.20s, resumed view, separate short beam-on and beam-off states around the input-safety checks. |
| 118.00–141.00s | 1fps, 24 frames | Steering back around the deposit and driving onto the lowered lift. |
| 142.00–153.68s | 3fps, 36 frames | Parking, ascent with the rover fixed to the deck, ceiling camera adjustment, switch to the physical exit view. |
| 147.80–149.32s | 10fps, 16 frames | Ceiling occlusion and abrupt chase-camera contraction in detail. |
| 154.00–159.68s | 3fps, 18 frames | Continuous outward camera route, cleared doorway and return to walking beside the rover. |

Contact labels use the source video's quantized PTS. `performance.now()` milestones are a different clock; I have not equated the two. The extraction selects existing frames without motion interpolation. Resized sheets are for inspection; the original video and supplied PNGs remain unchanged.

## Observations and score

**Motion — 3.8/5.** The entry/exit camera follows a staged continuous path through the opening and settles into an understandable driving view. Terrain moves under the vehicle while the near-wheel rim detail changes; the fenders, cassettes, cabin and visible link structures remain attached. Steering changes the visible front-wheel angle and vehicle heading. The rover does not visibly slide off or detach from the lift during ascent. Both thin mint beams remain present during sustained cutting and end on the same mineral region; ore rises while extraction is active. No body explosion, wheel disappearance, obvious panel flicker or gross ground penetration appears in the inspected intervals.

The score stops below4 because the chase transition under Atlas is conspicuous: from147.8s a dark overhead surface progressively covers the upper view, reaching roughly its upper half at148.40s; by148.52s the camera has jumped inward and the rover is noticeably larger. It never loses the rover or compromises deck attachment, so this is presentation polish rather than a failure of the keyboard route. The subsequent external-to-eye change at the start of exiting is an intentional mode handoff. The film does not establish smoothness at unrecorded frame times or distant LOD stability.

**Actual cockpit and MFD.** `02-enclosed-cockpit.png` is now a settled driving state, with the normal exit/lift controls. The earlier mid-entry interpretation no longer applies. The wall ahead is the actual parked Atlas orientation; the unloading interval then shows terrain and an obstacle through the same windscreen. Speed visibly changes from0 to2.0,5.0 and8.1m/s, then falls during braking. Charge and ore remain readable, with a useful text hierarchy and a separate control panel. Cabin shadows do not reproduce the old native-fixture diagonal bands. However, the bottom MFD status line is physically clipped; see finding1.

**Actual exterior presentation.** The vehicle is contained by the chase camera during terrain travel and return. The ivory cab, petrol panels, rear bins and amber strip remain identifiable in the Selene lighting, and the lift view clearly shows its scale inside Atlas. Contact remains readable on the lit terrain and deck. Atlas's deep shadow obscures lower-body detail in parts of the approach; this footage should not replace the native material/underside inspection or establish general night-scene quality. I found no new asset-normal or material regression here.

## Functional corroboration and limits

The video visibly contains a sustained cutting interval and the ore-bin dialog, but save integrity and neutral-input state come from the recorded assertions/metadata. Final rover ore is **1.6868780787kg**, matching the displayed1.69kg and the sum of basalt, copper and ice. The saved flag is true, there is no inventory warning, and backpack contents remain unchanged by the extraction check. This is a save receipt in the running session, not a new cold-reload persistence review.

The native A→B→A focus record contains trusted blur/focus events. Power is active before the switch, false when unfocused, and remains false after focus returns despite the held/repeated input. Both application and document focus agree. **Document visibility remains `visible` in that record**; it proves real focus-loss neutral safety, not a hidden-page visibility transition. The cargo record also passes its held-input gate. The video independently shows beam-off states around these events, while the precise held-key identity comes from the fixture and event record.

The final state has the rover unoccupied, door closed, speed0, aboard true, and all four wheel supports on `atlas-lift:main`. Its Atlas-local origin is approximately[-1.59666,4.00000,5.30044]. The camera has returned to the Atlas pilot, with the ship still landed. The recorded distance is78.4871m and total active cutter time11.5494s. This does **not** certify the brief's120s duty target, cold reloads, storage-full/error behavior, all terrain extremes or the separate controller flight-carry segment.

The rear chase angle does not expose both exact emitter mouths; real barrel-tip origin remains supported by the prior named-node/geometry contract, not a fresh visual measurement in this film. The door edge and ordered camera passage are visible, but a complete external hinge sweep and human stepping/hand IK are not. Near-wheel rotation is visible; exact rolling ratio and full suspension travel cannot be measured reliably from these small rims. Prior finite CPU mechanism clearance findings remain the appropriate evidence for those limits.

Final Atlas-pilot scene metadata records470draw calls /1,155,054triangles. That triangle snapshot exceeds QUALITY.md's nominal900k cockpit target, includes the surrounding existing scene, and is not a rover-only measurement or comparable cold/warm benchmark. No FPS, resource-growth or whole-game performance acceptance is claimed here.

## Ranked remaining findings

1. **MFD footer clipped by its own instrument shelf.** The display spansY1.2725..1.5075; the shelf reachesY1.30. Footer baseline207 of224 maps to approximatelyY1.290, inside that shelf. Moving the same15px footer to baseline190 places the baseline nearY1.3089 and should clear it without any mesh change. Parent has queued/applied that narrow canvas-layout correction after this recording. Close with a fresh settled-cockpit PNG from the canonical runtime camera; the old image must remain failing evidence.
2. **Chase camera contracts abruptly under the cargo ceiling.** Reproduction is the above147.8–148.52s interval during lift ascent. A future refinement should shorten the camera arm before the overhead surface dominates the view and ease distance changes while preserving immediate collision safety. This does not require a rover geometry change. The current defect lowers the motion score; it is not a hidden physical collision or route failure.
3. **Final touch route remains unreviewed.** Earlier touch failures were reported as fixture targeting/feedback problems, but that does not make the final route pass. Inspect the completed touch-only evidence, including readable settled cockpit, visible inventory page/Resume controls and held-contact neutral behavior, before closing input acceptance. No additional native art tour is requested by this report.

There is no new required geometry repair from this keyboard review. Keep the native static score, finite CPU geometry result, keyboard route result and pending touch/footer closure separately identified. Cees retains product acceptance and PR gating.
