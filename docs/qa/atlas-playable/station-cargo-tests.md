# Atlas station and cargo CPU receipt

This follow-up tests the playable 64 m Atlas against the actual fleet hangar and
the production hull selected by `ATLAS_MODEL_URL`. It depends on parent source
`43fadf1` (locally cherry-picked as `534fba1`); only the follow-up commit should be
integrated back into the parent. No asset, grid, station or main source changed
in this lane.

The station journey exposed a collision approximation that extended both outer
nacelles down to 1.45 m. That caught real hangar service rails during floor-height
docking and a 1 m launch. `atlas-gameplay.js` now keeps the outer nacelles above
3.65 m and uses narrower inboard parts below them. The full 64 × 36 × 16 m
envelope remains unchanged. Actual GLB vertices stay enclosed at all five tested
gear poses: 1, .75, .5, .25 and 0.

Updated station assertions cover physical docking, two decks, upper lift call,
crew carriage, continuous ramp/ground walking, exterior ramp call, reboarding,
pilot return, open-ramp and moving-lift launch guards, the 1 m launch and complete
20 m/s departure without collision. Original Nomad checks remain in place.

Cargo assertions load the actual Atlas runtime model, with only CPU canvas and
texture decoding stubs. Eight real 64 SBU crate bounds intersect zero visible
hull/furniture triangles. The unchanged grid IDs and `[2,8,16]` cell coordinates
retain 512 SBU, a 5 m centre lane, crew-lift access and both ramp controls. EVA
checks use the real aft doorway and fixed cargo floor. Nomad cargo, hatch, aisle
and transaction checks remain in place.

Successful waypoint recipe for the parent browser journey follows. Coordinates
are ship-local **eye** positions in metres. Use real movement; `F` / controller
`X` interacts by proximity and height, with no aiming requirement. The CPU test
uses keyboard `X` to brake at waypoints; controller LT is the existing on-foot
brake. Release/neutral between interaction edges. Start in the parked pilot
chair with power on and the lift initially at cargo level.

| Step | Walk/interaction |
| --- | --- |
| Leave chair | Interact gives `[-2.1,11.25,-20.5]`, facing aft. |
| Upper call | Walk via `[0,11.25,-20.5]`, `[0,11.25,-6.3]` to `[3.4,11.25,-6.3]`. Interact with crew call; visible anchor `[4.45,10.83,-6.18]`. |
| Enter lift | Wait for platform `y=9.5` and all gates stopped. Walk to `[3.4,11.25,-4]`, then `[5.5,11.25,-4]`. |
| Cargo deck | Interact; wait for platform `y=2.6` and gates stopped. Rider eye becomes `y=4.35`. |
| Open forward ramp | Walk via `[0,4.35,-4]`, `[0,4.35,-21.5]` to `[-4.3,4.35,-21.5]`. Interact and wait fully open. |
| Ground | Return to `x=0`, walk continuously to `z=-33`; eye descends to `y=1.75`. |
| Exterior call | Walk `[6.65,1.75,-33]` then `[6.65,1.75,-25.3]`. Interact to close; wait; interact to open; wait. |
| Reboard | Reverse dogleg via `[6.65,1.75,-33]`, `[0,1.75,-33]`. Walk up to `[0,4.35,-20]`. |
| Return upper | Walk `[0,4.35,-4]`, `[5.5,4.35,-4]`. Interact; wait for upper platform/gates. |
| Return chair | Walk `[0,11.25,-4]`, `[0,11.25,-19]`, `[-2.1,11.25,-19]`, `[-2.1,11.25,-20.5]`. Interact. |
| Secure ramp | Launch is blocked while ramp is open. Leave chair, repeat lift descent, close ramp from interior control, return via lift/chair. |

Allow 8 simulation seconds for each lift trip/call including gates (about 6.9 s
normally), and 4 seconds for each ramp motion (about 2.73 s normally). Wait on
mechanism state rather than wall time when rendering is slow. The CPU test also
seeds a moving lift through its normal actuator method to probe the seated launch
guard; it never writes the walker's pose after the initial docking fixture.

Validation: 63 tests pass, zero skipped, with
`node --test tests/station.test.js tests/sbu-cargo.test.js tests/atlas-playable.test.js tests/station-fleet-hangar.test.js tests/freighter.test.js tests/ship-power.test.js tests/ship-weapons.test.js`.
Production build passes with the existing Vite large-chunk warning. These are
CPU geometry and navigation results, not rendered/controller acceptance. No
browser, GPU job, shared service, database or dev promotion ran in this lane;
the parent owns those remaining integration checks and delivery.
