# Independent controller utility hotkeys review — first pass

**Decision: functional review PASS; bounded visual CHANGES REQUIRED, 3.83 / 5.00.**

Runtime candidate 77e8578, current branch includes documentation/test-only 0581e87, production preview 5290. Separate Codex reviewer under shared HANDOFF TOKEN POLICY v2. Source read-only; no repository mutation. Scope: LB+RB utility chord routing, release/neutral gates, HUD legend and help/command mappings. Previously reviewed flight-options assets and inherited whole-scene blockers are outside this review.

## Required correction

**P2 — the new held-chord HUD legend lacks dependable readability.** `src/main.js` builds the modifier legend in `updateHud`; inherited `.flight-hints` styling in `src/style.css` renders it at 8 px desktop and 7 px below 1050 px, with grey text directly over the scene. In `phone-shortcut-legend.png`, labels merge into Aeon's bright clouds. At desktop sizes the legend also runs over the cockpit MFD lettering. The information is present, but not reliably readable at the intended viewport.

Give the modifier legend a bounded dark backing and a readable text size, approximately 10–11 px minimum on phone, while preserving wrapping. Ensure the mappings can be read against bright terrain/clouds and cockpit instruments. This request concerns the new shortcut legend; it does not require redesigning the inherited whole HUD.

Help and command menu already present the mappings clearly. No horizontal overflow was measured in the inspected legend, utility status, open dialogs, command buttons or help grids at 1600×900, 1440×900 or 390×844. The longer PlayStation shoulder label wraps within its help cell without clipping.

## Rubric

| QUALITY criterion | Score | Assessment |
|---|---:|---|
| Silhouette and scale | 4 | Bounded legend/menu layouts fit the inspected viewports; labels group logically. |
| Materials and detail | 4 | Existing UI chrome, keycaps and menu treatment remain consistent. |
| Lighting and integration | 4 | Help and command dialogs maintain their established backing and scene separation. Legend readability is counted under information design. |
| Cohesion | 4 | Existing typography, mint accents and keycap language are preserved. |
| Information design / function | 3 | Correct mappings, but the new in-play legend is too small and loses contrast over bright backgrounds. |
| Motion | 4 | Held-chord state appears and clears; input edges, release ordering and neutral gating behave as intended in the bounded checks. |

Average **23/6 = 3.83**, no criterion below 3. The 4.0 acceptance threshold is not met.

## Functional review

No blocking input conflict or lifecycle defect found. Independent read-only assertions exercised all five mappings, hold repetition suppression, asymmetric shoulder release, consumed D-pad holds after shoulder release, ordinary D-pad restoration after release, modal neutral gating and disconnect/reconnect gating. Consuming D-pad-left removes the edge before flight's system-map interception, so the lights shortcut does not also open the map.

Final independent `node --test tests/gamepad.test.js`: **14/14 passed**, including the final unarmed Graphics chord suppression. Browser check independently opens Graphics with LB+RB+Menu and closes it with controller B after neutral release. Input uses an injected standard gamepad; this is not represented as a physical hardware-controller session or a repeated boarding journey.

Builder reports 471 unit tests, controller-only orbital shortcuts/interruptions 1/1, opening/boarding/startup/floor 4/4, and DOM router 1/1 after frame-synchronizing its tap helper. These are separately attributed builder results.

## Own evidence

Directory: `/tmp/star-agent-utility-hotkeys-review-evidence/`.

- `desktop1600-*` and `desktop1440-*`: held-chord legend, command menu, controller help and shortcut help.
- `phone-shortcut-legend.png`, `phone-commands.png`, `phone-controller-help.png`, `phone-shortcut-help.png`, `phone-direct-graphics.png`.
- `metadata.json`: actual browser/backend, render scale, viewport, dialog/control rectangles, client/scroll widths, controller and utility state, console results.
- Script: `/tmp/star-agent-utility-hotkeys-capture.mjs`.

Chromium 151.0.7922.173; hardware **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**; DPR 1; desktop 1600×900 and 1440×900, phone 390×844. Scene render scale pinned to 1. The browser run recorded **zero errors/warnings**. An initial capture attempt was stopped before completion to correct a reviewer script selector; only the successful final capture set is used here.

No FPS claim or inherited budget waiver. GPU lane released after captures. No merge/deploy authorization implied.
