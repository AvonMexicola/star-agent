# Burrow on the 64 m Atlas

2026-09-07. This bounded follow-up to the Selene ground start consumes the checked
Atlas gameplay dependency `8cd5c0e8d87fd405d28d70586609e4412008cdf8` (local
cherry-pick `d712e2a`). The parent owns combined main integration, browser evidence
and promotion. The rover lane changed no freighter, navigation, ship asset or
shared service source.

The existing **Atlas + Burrow mining rover · Selene** entry now parks Burrow at
`[0, 2.6, 17]` on the actual cargo deck, facing the aft loading ramp. Its hull
attachment no longer requires the retired belly elevator. G / controller Y /
the touch action operate **Atlas rear ramp** through the same powered, landed
`operate('ramp:aft')` path used by on-foot controls. The rover brakes while that
ramp moves. The independent **Burrow mining — Selene surface** start remains
prominent and requires neither a carrier nor unloading.

Wheel support comes from `FreighterSystems.surfaceAt()` and its authored slope
normal, within a 50 m broadphase large enough for the 64 m hull and ramp ends.
The hull up direction remains the absolute slope reference. Only real terrain
or supported deck/ramp contacts can advance the four-wheel solver. All four
Atlas contacts retain a double-precision hull attachment; mixed terrain/ramp
contacts release it until the rover is fully aboard again.

The vehicle's body edges use the existing wall/ramp/crew-gate constraint owner.
Swept bounds also meet authored furniture, while perimeter samples use the
existing `nav.cargoConstrain` for live cargo crates. Parent cargo-row positions
retain at least a 5 m central lane. The complete rover envelope vetoes a ramp
sweep even while unoccupied or straddling its toe. This composes any existing
ramp obstruction callback and leaves the modern crew lift's `canMove` guard
unchanged. The legacy main-lift fallback composes its prior guard separately.

Launcher copy now describes the playable 64 m Atlas, while its asset studio and
station exterior overview links retain their existing URLs. Parent requested
the station's **overview** label as part of its own authored station integration;
this lane does not establish station acceptance.

## Checks

- **69/69 pass** on the portable, final source:
  `node --test --test-isolation=none tests/rover-carrier.test.js tests/rover-surface-start.test.js tests/dev-launch-options.test.js tests/gameplay-audio.test.js tests/mining-rover.test.js tests/rover-physics.test.js tests/rover-mining-storage.test.js tests/atlas-playable.test.js`.
- The six new carrier checks exercise actual `FreighterSystems`: cargo to
  authored aft ramp to canonical Selene terrain and reverse back aboard;
  closed/moving door body clearance; unoccupied/straddling ramp veto; preserved
  existing ramp and crew guards; smallest-cell live cargo and authored furniture;
  translated/rotated carrying at a 25-billion-metre origin. The old test asserting
  three *actual* Atlas lifts was replaced by new-hull support/shaft assertions.
  The retired platform guard retains a plainly named compatibility unit fixture.
- A separate diagnostic intentionally raised the carrier 0.35 m above the real
  terrain: the solver correctly stopped at the excessive ramp-to-ground step.
  Normal `Navigation.touchDown()` places its hull origin on the real surface and
  the complete forward/reverse journey passed. No tolerance was loosened.
- `npm run build` passes (291 modules; existing large-chunk warning).
  `npm run check:repo`, scoped syntax and `git diff --check` pass.

## Parent integration and limits

Append `tests/rover-carrier.test.js` to the test command. Main's hard-coded
**ATLAS LIFT** hint must use `rover.state.carrierControl.toUpperCase()` and show
G/Y only while `rover.state.aboard`, including that value in its hint cache key.
The cargo-start notice should guide players from the pilot chair through the
crew lift to the cargo deck and aft to Burrow's port door. Existing `toggleLift()`
and its key/controller/touch routes are retained as API aliases for the new ramp
operation; no additional main cargo collision hook is required.

No browser/GPU job ran here. CPU physics and authored GLB layout checks are not
visual or complete controller acceptance. The parent must verify physical
boarding through the new Atlas, ramp operation, driving off/back on, cabin
entry/exit, ore collection/inventory and native touch/controller neutral gates
against its final integrated build. Physical-device validation is separate.
