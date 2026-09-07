# Independent ship-handling source review

**Decision: source/functional PASS for the current uncommitted handling candidate in `/tmp/star-agent-flight-options`.** No remaining concrete source blocker identified. This is not a browser/visual approval or a claim that Kestrel is currently playable through Fleet.

Separate Codex reviewer under the shared HANDOFF TOKEN POLICY v2. Read-only review of `src/ship-handling.js`, `src/navigation.js`, `src/flight-model.js`, `src/travel-model.js`, and the `nav.beginFrame(dt)` integration in `src/main.js`. No GPU work or source edits performed.

## Corrected finding

**Atlas mouse input was frame-rate dependent because the first navigation substep consumed and clamped the entire render-frame delta.** The independent original reproduction applied the same raw yaw input, 0.85 radians/second for two seconds, using the actual main-loop subdivision `ceil(dt/.025)`:

| Render frequency | Before correction | After `beginFrame(dt)` correction |
|---|---:|---:|
| 15 Hz | 0.30270806 rad | 0.63546885 rad |
| 30 Hz | 0.45066501 rad | 0.63546885 rad |
| 60 Hz | 0.63546885 rad | 0.63546885 rad |
| 120 Hz | 0.63546885 rad | 0.63546885 rad |

Final results agree within 1e-12 radians. A further one-second release also agrees at approximately 0.71316636 radians across all four frequencies. `frameLook` becomes zero on release; the remaining turn rate is the intended exponentially decaying response.

The final source captures queued mouse deltas once per render frame, distributes their rate across its physics steps, and combines that rate with live keyboard/controller deltas per substep. `resetSteering` clears queued input, frame rate and smoothed rate. The original finding is **closed**.

## Other reviewed behavior

- Nomad retains its previous assisted response and inertial thrust/RCS/torque constants. Kestrel and Atlas are clearly separated in agility and acceleration while cruise-speed multipliers remain close.
- Speed multipliers apply before the shared floor and station caps. The reviewed near-ground/station safety limits remain shared across hulls, including boost.
- Roll signs match the existing ship-local axes. Walking/EVA look paths retain their existing behavior; the hull turn multiplier applies to flight.
- `shipId` reaches the common occupied-cabin `advanceFlight` path, so cabin motion uses the same hull profile.
- Brake, modal pause, blur/visibility, power/assist changes, cabin reset and leaving the seat clear relevant queued steering. Emergency braking remains immediate where existing powered-ship rules permit it.
- Kestrel tuning is a prepared registry/model profile. This source review does not describe it as a Fleet-playable ship; that integration remains separate.

## Independent validation

`node --test tests/ship-handling.test.js tests/space-steering.test.js tests/ship-power-support.test.js scripts/flight-model.test.js tests/travel-model.test.js`: **34/34 passed**, including seven new handling tests. Log: `/tmp/star-agent-handling-independent-final-tests.log`.

The frame-rate and release reproduction above was separately rerun against the actual Navigation class with a minimal DOM fixture and the final main-loop ordering. It is independent of the builder's new regression test.

Browser handling comparisons and any visual rubric remain a separate gate. No whole-scene performance certification, asset-quality score, merge or deployment authorization is implied.
