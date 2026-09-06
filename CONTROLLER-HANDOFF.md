# Controller support

Draft PR: https://github.com/AvonMexicola/star-agent/pull/3

Controller changes are integrated in this shared checkout while preserving the concurrent ship, cargo and crash changes. An isolated review copy lives at `/tmp/star-agent-controller-review` on `feat/controller-review` (commit `c244cbc`), based on `feat/inertial-flight`.

Owned additions: `src/gamepad.js`, `tests/gamepad.test.js`, `tests/browser/controller.spec.js`. Shared edits: navigation input handling, main HUD/help hooks, controller HTML/CSS/manual, package test entry and appended navigation tests. Do not overwrite shared navigation/main/index files with the isolated review copy; that copy intentionally excludes the other tasks.

Standard browser gamepads support analog movement/look, trigger vertical thrust, shoulder roll, L3 boost, R3 assist, B/circle brakes, Y/triangle landing/launch, X/square interactions, A/cross jump, D-pad speed, View/Share HUD and Menu/Options help. Neutral controls are required after focus changes, connection and menus. Other menus and settings still use keyboard/mouse; remapping and vibration are not implemented.

Validation: 51 unit tests pass on the isolated change; controller Chromium journey and three smoke tests pass. The default forest keyboard journey reaches the low-altitude descent but times out at 45 seconds with software rendering around 1 FPS. The full keyboard journey subsequently passed at render scale .4 with a 90-second landing wait (2.6 minutes total); production defaults remain unchanged. Physical controllers have not been tested.
