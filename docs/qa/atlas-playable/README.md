# Playable 64 m Atlas adapter

This lane replaces the legacy playable Atlas with the fleet refresh asset while
retaining the saved fleet ID `atlas` and existing inventory capacities. Its base
is `bea67e8`; the geometry is the existing `0b2d852` refresh, not a new export.
The hero GLB SHA-256 is
`f61dfd26570635436ffd05a4243b38be11a891a28dada35f758ae789ed2b396e`.
This is a development integration checkpoint; it is not final art acceptance.

`src/atlas-gameplay.js` adapts the authored systems to Navigation. Cargo floor is
2.6 m, upper deck 9.5 m, pilot eye `[-2.1,11.05,-21.25]`, and the unscaled hull
envelope is 64 × 36 × 16 m before fitted weapons. Both 11.6 m loading ramps carry
walkers continuously from ground to cargo. Visible exterior call panels are at
`[6.65,1.25,±24.32]`; their ground approach is `[6.65,1.75,±25.3]`. Walk around the
ramp toe at `z=±31.566` before crossing its side rail. Interior ramp controls retain
the authored positions. The starboard crew lift at `[5.5,-4]` carries a rider
between both decks and keeps its gates/shaft interlocks. `F` / controller `X` uses
Navigation's existing interaction route. The main belly and two cargo elevators
no longer exist in the playable layout or fallback.

Flight gear uses Navigation's one 4.5 s clock, including unpowered pause and
emergency deployment. The six real folding legs and counter-levelled feet read
that same progress. Launch requires closed loading ramps and a stopped crew lift;
external ramps are locked during cabin flight. The enclosed crew lift remains
usable during flight and freezes at its exact height when power is lost.

The loader consumes the four authored pilot MFD mounts and real flight/inventory
updates. Offline Systems shows both ramps, crew lift and gear; connected Comms,
combat, thermal and power-off pages retain their existing priority. Weapons bind
the three authored S3 nodes once, including the aft-facing mount. Engine mouths
are `[±13.1,7.9,30.92]` with the existing `Atlas / engine` idle-annulus material.
Exhaust still uses actual signed demand and clears on power/travel/reset. Burrow
occupation suppresses presentation of the selected parked ship's engine.

Compatibility hooks retained for parent integration:

- `FREIGHTER_LAYOUT`, `FreighterSystems` and `LIFTS` re-export the new contract.
  The only `lifts` entry is the actual crew lift; there is no `main` compatibility
  platform. `snapshot` / `applySnapshot()` exchange `{gear,ramps,elevator}`;
  retired arrays are rejected. Parent owns server/client/remote serialization.
- `createFreighter()` retains `readyPromise`, `assetStatus`, `updateDisplays()`,
  `displayState()`, `updateGear()` and `syncFlight()`. It also exposes
  `controlState(nav)` for projected labels and the actual actuator snapshot in
  `userData.atlasSystems`. Existing generic-gear installation must respect the
  custom `updateGear`, as current main already does.
- Reset systems on a true hull swap/reset. `startStation`, `orbit` and explicit
  surface transit reset their Atlas mechanisms. Do not reset every frame.
- `surfaceAt(eyePoint)` supplies height, real ramp normal and support source for
  vehicle wheels. `operate('ramp:aft',rider,{powered,inFlight})` returns `{ok,reason}`;
  `rampObstructed(id)` and `canMove(lift,rider)` remain optional occupancy hooks.
  Parent/rover lanes own movable crates and the actual vehicle route.

CPU checks actually run in this lane: 141 tests pass, zero skipped, with
`node --test tests/atlas-playable.test.js tests/freighter.test.js tests/atlas-mark-ii.test.js tests/ship-weapons.test.js tests/ship-power.test.js tests/ship-power-support.test.js tests/engine-state.test.js tests/energy-effects.test.js tests/flight-effects.test.js tests/gear-flight.test.js tests/ship-utilities.test.js tests/navigation.test.js tests/travel-navigation.test.js tests/navigation-performance.test.js scripts/ship-camera.test.js`.
The checks include both continuous boarding ramps, crew carriage, rotating
large-world cabin support and power loss, authoritative gear timing, exact GLB
vertices inside collision parts at five gear poses, live MFD data, all nine Atlas
muzzle paths clear of its own hull, and prior moving-muzzle/inherited-projectile
velocity/short-laser-pulse regressions. CPU geometry loading substitutes image
decoders; it does not validate textures, shaders or screenshots. The first test
pass exposed stale old-hull expectations for optional ramp-tip/gate nodes and a
35 m exhaust-locality bound; those tests now assert the real required nodes and
full-scale ship-local coordinates. Production build and repository/whitespace
checks pass, with the existing Vite large-chunk warning.

No browser, GPU, server, shared service, database or dev promotion was run by this
lane. Parent owns the larger station bay, main/remote/cargo integration and the
actual opening/controller/keyboard/touch/rendered fallback journeys. A full
combined suite is still required after those changes; the old station and remote
Atlas tests cannot certify the new physical ship without updated integration.
The inherited asset review remains a geometry checkpoint: its reserved forward S3
fitting cylinder has a reported ~55 mm shoulder intrusion. This lane verifies the
actual installed muzzle directions/clear paths, not approval of that broader
reserved fitting volume or final silhouette/material quality.
