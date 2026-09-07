# Independent flight-options review — focused final pass

**Decision: CHANGES REQUIRED. Scoped visual score: 3.83 / 5.00. Not ready for merge under the QUALITY acceptance threshold.**

Candidate: `89ce649`, `feat/flight-options`, `/tmp/star-agent-flight-options`, production preview `http://127.0.0.1:5290/`. Separate Codex reviewer under shared HANDOFF TOKEN POLICY v2. No repository source was edited. The first rejection report is preserved at `/tmp/star-agent-flight-options-review.md`.

## Result and remaining correction

The old dark grass lighting arc is improved, and the cockpit footer now correctly displays **B LAND / LAUNCH** for keyboard and **Y LAND / LAUNCH** for controller. The new StationComplex weapon-obstruction fix passes its exact regression test. No additional functional blocker was identified in the focused source review.

**P2 — the near/far meadow still changes visibly in material, silhouette and ground coverage around the 6–10 m overlap.** See `src/distant-meadow.js:17` (crossed card geometry), `:41` (coverage overlap), `:45` (vertical color gradient), `:81` (instance scale), and `:83` (instance color), compared with the fine blade geometry/material in `src/meadow.js:39`. Independently captured forward walking sequences at both 80 m and 160 m show bright lime fine foreground blades ending in an island around the player, followed by broad olive cards with much more exposed pale ground. The old dark/light seam has become less severe, but the change in representation remains conspicuous as the player moves. This is visible at render scale 1 in the 80 m sequence, so reduced auto resolution is not its cause.

Required correction: make the far cluster silhouette, projected coverage and blade color distribution match the near blades through the overlap. Narrower and more naturally separated blade masks, calibrated cluster coverage and shared per-blade color treatment are potential approaches; increasing total instance count is not itself the acceptance criterion. Recheck a forward walk at both ranges with the field initially settled, including full-resolution frames. The transition should cease reading as a moving island of a different grass material.

## Updated rubric — bounded changed scope only

| QUALITY criterion | Score | Assessment |
|---|---:|---|
| Silhouette and scale | 4 | Gear endpoints, held item scale and graphics dialog remain readable. |
| Materials and detail | 3 | Coarse far cards and fine foreground blades still visibly disagree in coverage, silhouette and color. |
| Lighting and integration | 4 | Shared upward diffuse treatment removes the previous dark foreground band; bounded ship and suit lamps passed the earlier settled off/on captures. |
| Cohesion | 4 | Settings, MFDs and equipment retain the existing visual language. |
| Information design / function | 4 | MFD landing hints are now correct for both input types; graphics settings remain clear. |
| Motion | 4 | Forward walking retains streamed fields without a new discrete disappearance in these captures; gear/weapon motion passed the previous bounded inspection. The meadow representation mismatch is counted under materials above. |

Average: **23 / 6 = 3.83**. No item below 3; average remains below the required 4.0. This review neither approves inherited whole-PR34 appearance nor waives whole-scene performance budgets. No user polish waiver was supplied to this reviewer.

## Independent evidence and method

New evidence directory: `/tmp/star-agent-flight-options-final-independent/`.

- `meadow-80-stationary.png`, `meadow-80-walking-1.png` through `-4.png`, `meadow-80-stopped.png`.
- `meadow-160-stationary.png`, `meadow-160-walking-1.png` through `-4.png`, `meadow-160-stopped.png`.
- `mfd-keyboard-B.png`, `mfd-controller-Y.png`.
- `metadata.json` records positions, actual speed, terrain settling, meadow publication, render scale, draw counts and triangles for every capture.
- `page@2616bbf18b23eed1fffd70c2c3905645.webm` records this browser run.

Chromium **151.0.7922.173**, **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**, desktop **1600 × 900**, DPR **1**. Seed7291, canonical meadow at latitude15.74 / longitude22.44, walking eye height1.75 m. Debug navigation established the controlled ground fixture; actual W walking then advanced the player at approximately4.5 m/s. Initial terrain was settled and grass publication complete. Normal terrain streaming during movement is recorded. The first-person tool obscures the right portion of these views; the left and centre clearly show the transition.

Auto resolution remained1 throughout the 80 m sequence, was0.85 at the start of160 m, and later fell to0.7225; cockpit footer captures were0.614125. Therefore these are not fixed-resolution performance comparisons. Surface snapshots ranged510–534 draws and approximately1.55–1.84 million triangles. No FPS improvement, steady-state frame-time claim or budget approval is inferred from this capture, which also recorded browser video.

The focused run recorded **zero browser errors**. The previous full scoped visual capture recorded zero errors/warnings, covered desktop1600×900 and phone390×844 graphics UI, Nomad/Atlas gear, free drive, third-person tools and ground lamp off/on pairs. Those unaffected observations remain in the preserved first report. The final controller-footer check used an injected standard gamepad to select the input presentation; it is not represented as an independently repeated physical boarding journey.

## Functional validation and limits

Independently reran `node --test tests/energy-effects.test.js tests/meadow.test.js`: **18 / 18 passed**, including StationComplex visible-root obstruction at a large render origin. Source inspection confirms traversal of visible station exterior/hub/LOD/pod roots and instance transforms for hit normals. Earlier independent functional findings concerning low-altitude lunar drive penetration, synchronous meadow enumeration and holstered aiming were corrected and are documented in the first report.

Builder reports final `npm test` **467 / 467**, production build passing, feature browser tests **2 / 2**, and the affected controller opening/boarding journey passing after the StationComplex firing fix. These are attributed builder results, not substituted for independent visual acceptance.

GPU browser lane released after this run. No merge, deployment or source mutation performed.
