# Ship power and moving cabin verification

Candidate: `feat/ship-power-cabin`, based on hangar integration `4da1a5d` (PR #20).
Runtime change: `e82c3e5`, with cabin guidance correction `b891272`. Main power now controls propulsion independently of
whether the pilot is seated. Both Nomad and Atlas retain a moving rigid ship frame
while the passenger walks locally, including on powered internal Atlas lifts.

## Implementation and integration

Navigation owns the independent hull pose and velocities. Seated and unattended
flight share the existing flight-model step and swept terrain, moon and station
contacts. Passenger position and look are carried through the hull transform in
JavaScript doubles; rendering still subtracts the camera origin before upload.
No ship mesh, shader, terrain function or boarding envelope changed.

Power state reaches cockpit MFDs, propulsion audio, HUD, keyboard P and the help
menu. Controller menu edges are separate from gameplay edges, with neutral-input
rearming after closing. Power controls are only available from the pilot seat.
Existing dialogs pause simulation. See [player controls](../ship-power.md) for
course hold, shutdown physics and the external-exit interlocks.

This isolated worktree does not overwrite the shared controller tree or merge
PR #24's stopped-ship EVA implementation. Integration must preserve this lane's
independent hull frame and active layout when reconciling future EVA/controller
changes. The demo's Atlas unlock shortcut exists only in a local preview-server
wrapper outside the repository; normal fleet progression is unchanged.

## Validation record

- `npm test`: **162 pass**, including six independent ship-power invariants,
  MFD/UI/audio tests and separate modal controller input coverage.
- `npm run build`: passes. Existing Vite large-chunk advisory remains.
- New invariant coverage caught and corrected the initial unattended-hull advance
  and unpowered attitude-frame defects. An invalid drive-route fixture was moved
  to a legal orbital origin; route exclusions remain intact.
- Production preview smoke at port 5244: actual W then F in Atlas leaves main
  power on and the ship travelling at 758.686 m/s while the player is in the cabin.
  No browser warnings or errors. First smoke used a fixed 900 ms key hold that
  produced no simulation frame under concurrent SwiftShader load; the corrected
  check waits for actual acceleration before seat exit.

**Final focused browser command:** `npm run test:browser -- -c scripts/ship-power.config.js` — **3/3 pass** in 1.4 minutes, zero console errors/warnings.

Focused production browser coverage exercises powered assisted Nomad course hold,
power-off momentum and reseating, rotating Atlas cabin/lift travel, emergency MFDs,
and touch/controller power controls. Captures use Chromium 151.0.7922.173,
ANGLE/Vulkan SwiftShader, 1440×900 and 390×844; screenshots use render scale 1.
Five opening/boarding/travel regression scenarios also pass. The older full-resolution inspection timed out at its 45-second descent wait; the existing .4-scale physical journey passed on rerun. Integration checks and retained timing failures are listed in the
[regression report](ship-power-regression.md).
Software-renderer frame measurements do not establish the laptop GPU budget.
Independent Opus visual review remains pending; this is a draft review candidate,
not a merge or deployment approval.


## Captured review views

| View | Evidence |
| --- | --- |
| Nomad assisted course hold | [Main power on](ship-power/nomad-power-on-mfd.png) |
| Nomad emergency propulsion status | [Main power off](ship-power/nomad-power-off-mfd.png) |
| Atlas powered port lift in a moving, rotating hull | [Cargo deck](ship-power/atlas-moving-cabin.png) |
| Atlas emergency status | [Main power off](ship-power/atlas-power-off-mfd.png) |
| 390×844 touch power button | [Phone menu](ship-power/touch-power-menu-390x844.png) |
| Controller focus at 390×844 | [Controller menu](ship-power/controller-power-menu-390x844.png) |

Both the root agent and the independent test agent inspected the game renders:
power state and propulsion status are readable, the hull remains around the
passenger, and the phone control fits without horizontal overflow. This is
functional visual inspection, not an Opus rubric score or approval of inherited
ship art.

Browser-fixture corrections are retained here: elapsed-time thrust/spin sampling
was replaced with actual state predicates; Atlas's aft-facing port walk uses D;
Nomad physically steps inside the chair interaction radius before reseating; and
asynchronous velocity comparison allows bounded frame drift below 2 m/s. Exact
instantaneous transfer remains covered by numerical unit tests. A hidden seated
ship intentionally skips display repaint without pointer lock/controller activity,
so an invalid hidden-MFD snapshot wait was removed. The controller scenario
verifies B-close with A and the forward stick held, unchanged power, discarded
flight input, and rearming only after neutral input.


### Roll direction correction — 2026-09-06

Cees confirmed yaw is correct and pitch inversion is a preference, but E/RB must
bank right and Q/LB left. The input signs were reversed: positive roll already
rotates about ship-forward (right wing down), but keyboard Q and controller LB
were producing positive input. Corrected only the keyboard and bumper mapping.
Yaw, pitch, torque integration and flight-assist behavior are unchanged.

Regression tests first failed for both ships in both flight modes, showing Q
lowering the right wing. They now verify all four bindings by actual wing height
and unchanged nose direction. Full unit run: **166/166 pass**; build passes.
Production Nomad preview on 5245: eight checks (Q/E/LB/RB in assisted/inertial mode)
pass with actual keyboard and injected standard-gamepad input. Chromium
151.0.7922.173, ANGLE Vulkan SwiftShader, 1440×900; no console errors/warnings.
No physical controller was used. Root inspected [left bank](ship-power/nomad-roll-left.png)
and [right bank](ship-power/nomad-roll-right.png) at render scale 1. Raw results:
`/tmp/star-agent-roll-browser.json`; no hardware FPS claim.

Both local previews serve the rebuilt production output (Nomad 5245, Atlas 5244).
Reload to receive the corrected input mapping. Main/Vercel deployment is separate.
