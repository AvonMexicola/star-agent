# Character review evidence

Final runtime: `player-expedition.glb`, 8,496,328 bytes, SHA-256
`04f849bafe513f8e2a817895307a2751ebed85f76d4ef81cd0ae793ddc5911fa`.
Chromium 151.0.7922.173, AMD Radeon 860M, ANGLE / OpenGL ES 3.2.
Desktop character/game captures are 1440 × 900; phone is 390 × 844.
Images are unedited renderer screenshots copied from the task cache.

| Comparison | Previous suit | Final expedition suit |
| --- | --- | --- |
| Desktop, same camera | [Before](studio-before-desktop.png) | [After](studio-after-desktop.png) |
| Phone, same camera | [Before](studio-before-phone.png) | [After](studio-after-phone.png) |
| Rifle grip refinement | [Initial loose closure](initial-loose-rifle-grip.png) | [Final closure](rifle-laser-hands.png) |

The production studio check also covers [phone equipment](studio-phone-equipment.png),
[wave](wave.png) and [rest](rest.png). Its [record](studio-check.json) includes
every exercised view, animation state and browser errors/warnings.

The independent Opus reviewer ran `scripts/character-motion-captures.mjs` after
the final glove and hip correction. These frames come from that run:

| Subject | Captures |
| --- | --- |
| Rifle | [Hands](rifle-laser-hands.png), [opposing palms](rifle-laser-palms.png), [shoulder profile](rifle-laser-side.png) |
| Pistol and cutter | [Pistol grip](sidearm-pistol-palms.png), [cutter support grip](mining-laser-tool-palms.png) |
| Sitting | [Settled side view](sit-side.png) |
| Ladder loop | [Frame 0](climb-0.png), [frame 1](climb-1.png), [frame 2](climb-2.png) |
| Running | [Frame 0](run-0.png), [frame 1](run-1.png), [frame 2](run-2.png) |

[Motion record](final-motion-record.json): 23 fresh captures, zero errors/warnings.
These sample actual playing frames; the harness does not set animation times or
bone poses. Sparse still frames cannot establish every blend boundary, foot lock
or firing/recoil transition. The [separate hip correction evidence](../../character-leg-rig/README.md)
documents its measured anatomy and before/after frozen poses.

| Actual gameplay | Evidence |
| --- | --- |
| First person | [Floating viewmodel](game-first-person.png) |
| Third person | [Rifle](game-third-person-rifle.png), [pistol](game-third-person-pistol.png), [cutter](game-third-person-cutter.png) |
| Complete controller EVA route | [Third-person firing](eva-third-person.png), [physical return to chair](eva-returned-to-chair.png), [route record](eva-controller-check.json) |
| Asset intake | [1.85 m suit against reference/grid](props-scale-intake.png) |

The final production run passed studio, EVA, orbital/default intro and valid GPU
measurement (4 tests), followed by the complete controller opening → equip/fire →
camera switching → Wave → physical boarding → launch journey (1 test). Gamepad
input was injected; no physical device test is claimed. Opening/controller images
are produced by `scripts/opening.spec.js` in the task cache.

[GPU measurements](gpu-measurements.json) contain the actual timer queries and
full-frame draw counts. All affected hangar geometry counts meet their budget;
the strict 10 ms timing gate remains unpassed (10.81 ms first person, 10.38 ms
third-person rifle in this non-isolated desktop run). A passing measurement
harness is not timing approval. See the [production record](../production-record.md).

The initial independent reviewer also captured the six 1600 × 900 regression
views: [orbit](tour-orbit.png), [coast](tour-coast.png), [forest](tour-forest.png),
[highlands](tour-highlands.png), [hangar](tour-hangar.png), [cockpit](tour-cockpit.png).
The [tour record](tour-record.json) reports zero errors/warnings. These preceded
the final glove/hip refinement; final character-specific frames are above.
The terrain views use fixtures; cockpit boarding is physical. The existing tour
uses a fixed coast bearing, which is not guaranteed to face the sea. No checked-in
baseline was available, so no 2% pixel-difference pass is claimed. Recorded RAF
cadence is not GPU render time.
