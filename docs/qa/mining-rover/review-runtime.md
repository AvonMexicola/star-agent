# Rover runtime integration — bounded independent CPU review

Reviewer: `/root/nomad_cutter`, 2026-09-07, Node v26.7.0. **PASS for this bounded CPU integration review. No reported required fix remains open on the tested source.** This does not establish browser/controller/touch, art, performance or release acceptance.

Reviewed root-authored `src/mining-rover.js`, `src/rover-support.js` and the narrow navigation/main/handheld/lift hooks in `/home/cees/projects/star-agent-mining-rover`, uncommitted candidate above `4d38827d3c41ecd6250455d6ceace4365c743365`. The reviewer previously authored the physics core and mining storage extension; their tests were rerun as regression checks, **not independently approved here**. No production edits, browser, GPU, commit or PR action was performed.

## Exact evidence

- [probe.json](probe.json), [probe.mjs](probe.mjs): real Navigation and rover runtime, actual rover/Atlas GLB geometry, canonical Selene surface and Atlas lift support. UI is a no-op and DOM/event surfaces are CPU shims; GLB textures are omitted only to allow Node parsing. The player is placed at the actual door approach, after which boarding, lift movement and unloading run the production state machine.
- [beam-probe.json](beam-probe.json), [beam-probe.mjs](beam-probe.mjs): same runtime with synthetic ray-hit/obstacle callbacks at the mining boundary. Tests actual emitter transforms and integration arguments, not extraction of a real runtime deposit.
- Both runs recorded identical source hashes before and after execution. `src/mining-rover.js`: `ab4056e11b51889f8ffe70306d3c6d77ebcc11da2fe457b688adfaf57dba5228`; `src/navigation.js`: `d868df67114129487b69f958b950a087ae9a3fed9b77423fb9a199924f2143e4`; `src/main.js`: `079180686d6ae7456d25455de38c9087cc3d298f61485d0e95bccbdd2b2ea957`.
- Actual rover export: `7683201e25f4c1747e2d4e57a49487eb700c600676bd114601c883c6eda92dec`, 2,269,868 bytes. Full supporting hashes are in both JSON reports. `runtime-source.js` preserves the tested runtime source. Earlier partial source inventory is retained in `snapshot/` and `initial-hashes.json`; it was taken during root's fixes and is not a complete frozen copy of the original failing iteration.

## Required findings and closure

| Finding originally reported | Current closure evidence |
| --- | --- |
| Invented cargo deck under raised internal lift holes | `sampleRoverSupport` delegates to authoritative `FreighterSystems.floorAt`. Focused tests cover all three lift sources, the raised starboard hole, its actual upper platform and fixed deck. |
| Rover fit guard bypassed by on-foot lift pedestals; carry selected by broad Z position | Shared `FreighterSystems.toggle` now calls `canMove`, wired to the complete rover footprint guard. Tests reject straddling and underneath vehicles for the ordinary toggle caller, accept correctly parked and clear cases. Carrier selection uses all four actual wheel sources; main-lift descent carries the seated rover to local Y≈0. |
| Building sweep dropped its envelope in the main wrapper and used straight-wheel bounds | Main forwards the fourth argument unchanged; rover supplies `roverSweptBounds()` and proposed quaternion. This is source-level closure of the argument propagation, not a rendered construction collision journey. |
| KeyI opened rover cargo then the later inventory listener closed it | Rover consumes the event with `stopImmediatePropagation`. The harness uses the actual inventory KeyI handler after Navigation's handler: the dialog remains open and opens `meridian-rover-bin` exactly once. |
| Entering the rover during Atlas cabin flight took over Navigation's step and froze flight | Entry rejects `cabinFlight` and `spaceParked`; the cabin-flight fixture stays idle/unoccupied and reports that Atlas must land. |
| Repeated KeyT after a modal could reactivate mining without a fresh press | A fresh-press `keyHeld` latch is cleared on suspension. Actual Navigation keyboard events yield two beams before the modal, zero during it, and zero after a repeated held-key event on resume. |
| Scripted boarding ignored external obstacles | Entry validates the route and movement rechecks the shared obstacle sweep plus Atlas mesh rays. A thin wall crossing the port approach is queried and rejected before opening; player remains unoccupied and phase idle with the clear-path notice. Unobstructed actual-geometry boarding succeeds. |

An initial harness run stopped because its old assertion expected the now-blocked route to finish boarding. That assertion was updated to require rejection; it was a stale test expectation after the production fix, not a newly discovered production failure.

## Additional integration results

The complete CPU access sequence reaches the pilot seat with a closed door, lowers the actual main lift from Y4 to Y0, drives beyond the lift's supported wheel area onto canonical Selene support, and brakes to zero. World positions are around 23.6 million metres; named muzzle world positions and directions match emitted beam diagnostics with zero measured error.

Each actual emitter passes its own hit point, direction, target, dt and rate 0.22 to `onMine`, with destination `meridian-rover-bin`. Blocking only the port emitter truncates that beam to one metre and suppresses its mining call while the starboard three-metre hit still submits one cut. A 96 kg bin gives zero free capacity, zero active beams and zero further mining calls. The handheld tool's inactive path preserves the rover mining budget; destination capture and atomic commit behavior remain covered by the separate storage implementation tests.

`node --test --test-isolation=none tests/mining-rover.test.js tests/rover-physics.test.js tests/rover-mining-storage.test.js`: **28/28 passed**, 0 skipped, 2.408 s. This includes root's 240 Hz carrier-accumulator regression, all lift-support/interlock probes, physics invariants and storage rollback/replay/captured-destination tests. A first invocation with default isolation also passed all three files, but Node reported file counts; the explicit no-isolation run establishes the 28 individual test count.

## Limits

The CPU DOM shim does not establish real native dialog behavior, pointer capture, controller focus, touch reachability or an actual browser journey. Actual in-game loading and return, mining a real field deposit, full controller-only progression, held-controller/disconnect safety, rendered geometry/materials and performance still belong to the builder and separate final reviewers. No independent art score or FPS result is supplied. The source/geometry hashes bound this review; later material-only exports do not automatically inherit new geometry/route claims.
