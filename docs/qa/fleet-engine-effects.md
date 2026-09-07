# SA-FX-001 — fleet engine effects implementation

Owner: `fleet_engine_effects`, 2026-09-07. Branch `feat/fleet-engine-effects`,
base `20e9f1b`, isolated worktree `/home/cees/projects/star-agent-fleet-effects`.
This is the effects slice for the parent fleet integration. Browser acceptance,
combined main-loop wiring and development promotion belong to the parent.

## Implemented

`enginePresentation(nav, { suspended })` supplies shared audio/visual telemetry
from actual simulation acceleration, normalized by each hull's thrust authority.
Its signed forward projection drives the aft exhaust; total acceleration remains
available to the audio adapter for lateral/reverse maneuvering. Cruise velocity
and keyboard state cannot ignite a coasting ship. Cabin flight uses the hull's
stored pose/velocity; a walking passenger's sprint cannot enable boost.

The current playable Nomad uses the nozzle lips in `SHIP_LAYOUT`; the current
Atlas uses its legacy authored twin drives at x=±7.9, y=5.3, z=13.34. The Atlas
Mark II studio is unchanged. Kestrel resolves its actual `AB_L`/`AB_R` local
transforms and adds motes without adding duplicate cores or plasma-cone meshes.
Loading/fallback assets suppress unattached exhaust.

`updateShipEngineVisuals(ship, engine)` changes only existing emissive materials
and Kestrel afterburner visibility. Powered idle retains a restrained core glow;
power-off/travel/suspension darkens it. Kestrel's authored cones engage with real
forward boost. Main-engine motes/plumes stop immediately when forward demand
ends, reverses, power switches off or travel starts. Engine-tagged pool entries
retire independently of weapon/mining particles; reused slots reset the tag.
RCS/reverse-thruster particle geometry is outside this slice.

## Validation

The following exact focused command passed **64 tests**, zero skipped:

```sh
node --test tests/engine-state.test.js tests/flight-effects.test.js tests/energy-effects.test.js tests/combat-momentum.test.js tests/ship-power.test.js tests/ship-power-support.test.js tests/kestrel-flight.test.js tests/ship-handling.test.js
```

Coverage includes actual binary GLB raycasts against all three luminous throats,
authored Kestrel socket/cone dimensions, powered core material changes, rotated
large-coordinate positions, boosted finite transforms, unseated hull momentum,
two-metre maximum GPU particle streaks, selective engine retirement, and the
actual flight adapter's separation of engines from seated weapon readiness.
Existing moving muzzle anchors, short laser lifetime, inherited projectile
velocity, weapon impact timing and mining commit/collection tests still pass.

`npm run build` passes with the existing Vite warning about chunks over 500 kB.
`npm run check:repo` and `git diff --check` pass.
`npm run plan:checks -- --base origin/dev/all-features` completed; its 860-path
plan reflects the wider base branch ancestry and is not evidence of this slice's
validation.

Initial asset-test assumptions were corrected to measured geometry: Kestrel's
deep luminous throat is .68 m behind its authored AB socket, and the cone's
radius is .39 m. Self-review corrected a Boolean coercion in the new boost path;
all hulls now have finite-transform boost assertions. These were development
corrections, not successful browser runs.

No browser, GPU job or shared service was started by this owner. No shader/render
image inspection, physical-controller testing or frame-rate claim is included.
The parent must verify the rendered engines and full controller/audio journey
before promoting the combined candidate. Build output is not committed.

## Parent integration

Import `enginePresentation` and `updateShipEngineVisuals` from
`src/effects/engine-state.js`. Sample once after navigation updates, including
the main loop's transit/focus/dialog suspension. Call
`updateShipEngineVisuals(ship, engine)` after `ship.syncFlight`, `ship.update`
and `ship.updateCabin`, including frames where the cockpit hull is hidden.
Pass `{ suspended, engine }` to `flightEffects.update`; it resolves the active
asset's exhaust itself. Spread the sample into audio input without replacing
its raw `mode`, `cabinFlight` or `insideShip` fields.

Add `tests/engine-state.test.js` and `tests/flight-effects.test.js` to the package
test list. Runtime diagnostics expose `effects.engine` with ship ID, demand,
state, nozzle count, active emitters, generated jets and engine particle count;
`effects.engineVisuals` exposes authored emission/cone state. Kestrel correctly
has two emitters, zero generated jets and two authored cones only when boosted.

Only the claimed effects modules, focused tests and this note belong to this
commit. The existing parent-owned HANDOFF append remains untouched. No asset,
navigation, database, server or schema changes; no development/public deployment.
