# Burrow ground development start

2026-09-07. Worktree `feat/burrow-surface-start`, based on `bea67e8`.
The parent owns main integration, the combined browser/controller journey and
development promotion. This lane ran CPU checks only.

The F2 location list now includes **Burrow mining — Selene surface**, with a
**Start ground mining** action and direct footer/review links. The explicit
`?dev=1&start=rover-surface` route works with any selected ship; that ship remains
parked at the station. The rover starts seated on Selene, approximately 12 m from
the existing Crescent outcrop and aimed at it. Normal driving, twin cutters,
ore-bin inventory and physical door/step exit remain the existing implementations.
This new development start does not require unloading a carrier.

`roverSurfaceStart(target)` tries a small bounded set of poses around the actual
outcrop. Each uses canonical body terrain and the existing four-wheel solver;
all contacts must be terrain, satisfy slope/step/suspension limits and clear the
body/entry obstacle checks. No replacement floor or Atlas dimensions enter this
placement. `spawnSurface()` settles the real rover solver, clears held movement
and mining input and seats the player. It refuses active travel or unavailable
vehicles. Driving no longer produces on-foot audio while `nav.roverOccupied`.

The standard development URL gate and temporary `testFlightStorage()` remain
responsible for isolation. Public entry ignores this location when dev tools are
disabled. No account, service, runtime dependency or new paid asset is required.

## Checked rover source consumed

Before adding the start, this lane applied only the approved final rover delta
from `643a7d3` through `122cb6b`: `f92a3a2`, `6f29bbc`, `6442099`, `ff00815` and
`122cb6b`. It includes candidate 10 source/GLB/materials, the canvas footer and
closing view correction, transparent-glass shadow handling, the secondary-finger
button helper and its existing rover/inventory hooks, portable review scripts,
the original input fixture and review records. The later production-record CI
receipt through `641d517` was included separately. No unrelated CI smoke change
or old task-status rewrite was consumed. Existing audio and gameplay hooks remain.

The consumed GLB is exactly **2,177,260 bytes**, SHA-256
`88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`.
The archived reviews establish only their original scopes. They do not establish
this new surface start or compatibility with the concurrently integrated 64 m
Atlas. The old cargo start remains available when a hull exposes the original
compatible lift; a missing lift now gives explicit surface-start guidance and
does not install a hidden platform or overwrite a new hull's elevator guard.

## Parent main hook

At rover creation, set `surfaceRoverStart = devOptions?.location === 'rover-surface'`.
Create the adapter if that is true **or** the existing Atlas `rover=1` condition
is true, retaining `nav.vehicle = rover`. Its availability callback becomes:

```js
() => !multiplayer.connected && (surfaceRoverStart || nav.shipId === 'atlas')
```

In the dev auto-start branch, use the surface placement instead of `transit()`
for this explicit location:

```js
const launch = surfaceRoverStart
  ? rover.spawnSurface({ target: mining.ground.position }).then(ok => {
    if (!ok) throw new Error('Burrow surface placement failed.');
  })
  : devOptions.location !== 'hangar' ? transit(devOptions.location) : Promise.resolve();
```

Keep the existing carrier `touchDown()/spawn()` and Atlas notice inside
`if (rover && !surfaceRoverStart)`. The surface adapter provides its own controls
notice. The parent can include `rover?.readyPromise ?? Promise.resolve()` in
StartupPreload, and must append `tests/rover-surface-start.test.js` to the test
command. Ship-engine telemetry must suppress the selected hull while the rover
is occupied; that helper remains the effects owner's lane.

## Verification and limits

- **55/55 pass**:
  `node --test --test-isolation=none tests/rover-surface-start.test.js tests/dev-launch-options.test.js tests/gameplay-audio.test.js tests/mining-rover.test.js tests/rover-physics.test.js tests/rover-mining-storage.test.js`.
  This includes the actual Crescent position, four canonical terrain contacts,
  immediate driving, obstruction/missing-support rejection, all ship URL choices,
  temporary inventory, footsteps, existing lift physics and ore transactions.
- `npm run build` passes with the existing large-chunk warning.
- `npm run check:repo`, `git diff --check` and the scoped check-plan helper pass.
  The plan is guidance, not evidence of browser or art acceptance.
- No browser, GPU job, shared service, account or database was operated here.
  The parent must verify the actual F2 selection, settled image, controller/touch
  driving and mining, collected ore, pause/neutral gates, exit and return before
  describing the new start as validated in the development build. Physical-device
  testing and new Atlas cargo loading remain separate.
