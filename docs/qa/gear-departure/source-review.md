# Gear maneuvering and flight cues — independent source review

Reviewer: separate Codex reviewer session, read only in `/tmp/star-agent-flight-options`. Candidate: uncommitted gear/effects changes on handling commit `477dbc3`. Scope: canonical gear state, powered maneuver limits, drive entry, HUD prompt and ordinary dust versus drive tunnel. No inherited asset or whole-scene performance approval; no browser/GPU run yet.

## Finding

**P2 — surface landing assist bypasses the declared gear ceiling** (`src/navigation.js:476`). `landOrLaunch()` deploys gear, but the surface-autoland branch directly assigns up to 800 m/s and skips the new gear-aware flight step. Reproduced with a fresh Navigation, position `(0,1592750+5000,0)`, `landOrLaunch()`, `beginFrame(1/60)`, `update(1/60)`: autoland true, gearDeployed true, progress 0.0092592593, speed 800, speedProfile.limit 35. Apply the ceiling to automatic surface descent too, or explicitly scope the requirement and player-facing description to manual flight. Station docking/lift already use 3 m/s.

## Checks

Independent targeted tests: **37/37 passed**. Command: `node --test tests/gear-flight.test.js tests/travel-navigation.test.js tests/ship-power-support.test.js tests/energy-effects.test.js scripts/flight-model.test.js scripts/travel-model.test.js`. Log: `/tmp/star-agent-gear-independent-tests.log`.

Manual assisted/inertial speed paths share the gear limit; powered overspeed brakes exponentially instead of snapping. Station limits remain tighter. Gear progress advances in navigation once per physics substep, including occupied cabin flight; renderer receives that same value. Navigation pauses and power-off pause gear travel; drive entry remains blocked until actual progress reaches zero. Orbit initializes stowed, station opening and touchdown deployed. Ordinary Slipstream is immediately invisible at intensity zero. The separate travel tunnel is immediately hidden when travel ends; ordinary space dust emission is gated against atmosphere and active drive. Dust is camera-relative and leaves world-coordinate precision contracts intact.

Source verdict: **changes requested for the surface-autoland exception**, unless builder confirms an intentional narrower manual-flight requirement. Visual verdict/rubric pending independent browser capture after GPU handover.

## Corrected source re-review

Builder capped surface descent with the shared `GEAR_FLIGHT.speed` constant. Independent replay of the exact original reproduction now returns speed **35 m/s**, progress 0.0092592593, gear deployed, autoland active, and profile limit 35. Finding closed. The new diagnostic counts alive camera-local dust without modifying simulation/render behavior.

Independent rerun with the same six test files: **38/38 passed**, including the added surface-autoland regression; latest output replaces `/tmp/star-agent-gear-independent-tests.log`.

Final bounded source verdict: **APPROVED**. No open functional blocker identified in this change. Visual approval remains pending independent captures of the prompt and ordinary/travel flight cues; inherited scene budgets and ship asset quality remain outside this verdict.
