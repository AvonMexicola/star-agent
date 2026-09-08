# Independent Claude Opus functional review

Source4325c0b plus test-onlyfc6b281. Read-only CLI, completed with no API error.
The first sandbox request timed out; the host retry completed in670.731s.
Original findings are retained below; their correction and validation are tracked
in the ceiling/roof production record. No visual acceptance is asserted.

I reviewed `1794b87..HEAD` at the source level only — read the diff and the surrounding modules, and ran targeted `node` probes against `src/build/*` to confirm each claim. No browser, no renderer, no visual assessment, no repo test run, no mutations.

## High

**1. Roof tiles are solid blockers with no standable top — a player who lands on a roof deck is frozen in place.** `src/build/definitions.js:22`

`roofTile()` omits `support:true`. Every other walkable piece sets it (`definitions.js:12,24,25,29,36`). `constrainBuildStep` builds its support set from `pieces.filter(p=>getPieceDefinition(p)?.support)` (`src/build/collision.js:43`), so the 0–0.6 m roof volume participates in `blocked()` but never in `supportAt()`.

Reproduction (simulated directly against `constrainBuildStep`, foundation/wall/two ceilings at y=3.3, `roof-flat` at y=3.306):

```
descending onto the tile, feet 4.10 → -x
frame 0 feet 4.0100 x 0.45 hit false grounded false
frame 1 feet 3.9200 x 0.40 hit false grounded false
frame 2 feet 3.9200 x 0.40 hit true  grounded false   ← never moves again
frame 7 feet 3.9200 x 0.40 hit true  grounded false
```

Horizontal slides, the vertical retry, and the support snap are all rejected, so the position never changes. Combined with `src/navigation.js:819` (`jumpHeight` re-derived from the clamped altitude → 3.92) and `:800` (jump requires `jumpHeight===0 || surfaceObstacles.grounded`), the player also cannot jump out. Reachable by jumping from an adjacent unroofed ceiling of the same base — jump velocity is 4.5 m/s against a 0.606 m lip. Only escape is entering build mode and removing the tile underfoot.

The identical freeze exists today for `crate` (I confirmed it), so the collision rule is pre-existing — but this increment turns it into a contiguous 4×4 m top deck. It also makes the new test's stated purpose inert: `tests/build-roofs-lights.test.js:331` verifies collision steps stay "below 16 cm" against the 30 cm walking step, and `docs/base-ceilings-roofs.md` repeats that rationale, but no code path ever treats those boxes as ground. Adding `support:true` to the `roofTile` factory is what the stepped edge/corner colliders were clearly built for.

## Medium

**2. Square roof tiles can never be placed on a square ceiling that is not axis-aligned.** `src/build/system.js:79`

The mount branch sets `rotation: ['triangle','quarter'].includes(def.shape) ? p.rotation : rotation`, where `rotation = this.turn*Math.PI/2` — absolute, not relative to the ceiling. Triangle and quarter caps inherit the ceiling rotation and are fine; `roof-flat`/`roof-edge`/`roof-corner` do not.

Square floors routinely get non-90° rotations: `attachedPanels('floor', <triangle ceiling>)` (`src/build/structure.js:41`) yields candidates at 60°/150°/240°/330°, and `candidates()` for `category==='floor'` adds `this.turn*Math.PI/2` on top, so every option stays off-axis. Verified:

```
square ceiling rotation deg 60.00
roof-flat   turn 0..3 -> Place this roof tile on a matching structural ceiling.
roof-edge   turn 0..3 -> Place this roof tile on a matching structural ceiling.
roof-corner turn 0..3 -> Place this roof tile on a matching structural ceiling.
roof-flat inheriting ceiling rotation -> null
```

The footprint corners fall outside the rotated ceiling polygon, so `mountedOn` rejects all four turns. The player is aiming at a legal, supported square ceiling and gets a message saying it isn't one. `p.rotation + (shape-inherited ? 0 : this.turn*Math.PI/2)` fixes it.

**3. Lamp emissive lags power loss by up to 10 s while the actual illumination drops instantly.** `src/build/system.js:216`, `:228`, `:281`

`setBuildPowered` — now the switch for `WarmTaskLight` (`src/build/visuals.js:122`) — is called only from `sync()`, which returns early unless `this.data` object identity changed. The dynamic point light in `update()` is recomputed every frame from `this.power.status(c).powered`, and that flag genuinely changes between store writes: `powerStatus` recomputes `renewable` live from `powerEnvironment(c, now)` (`src/build/power.js:40`), so a solar-only base at `charge === 0` flips at sunset immediately. The persisted power record only advances on the 10 s write in `BasePower.update()` (`src/build/power-system.js:11`) or the 10 s `BaseCloud.update()`, so the emitter stays at authored brightness for up to 10 s after the room goes dark (and stays dark for up to 10 s after power returns). Any build action re-syncs and self-heals it. `docs/base-ceilings-roofs.md` states power failure "turns off its emitter and illumination"; the emitter half is deferred. The mechanism predates this increment (`MintStatus`), but the light is the first piece whose primary appearance depends on it.

## Low

**4. "Next snap" is a no-op for ceiling lights.** `src/build/system.js:79` — for `mount==='ceiling'` every candidate reuses the same rounded aim `x/z` and `this.turn*Math.PI/2`, differing only in `mountHeight`. Any two ceilings at the same height therefore produce byte-identical candidates, and unlike every other branch the mount path does not pass through `sort()`'s dedupe map. On a 3×3 ceiling grid `snapCount` reports 9 while LB/T changes nothing. Also cosmetic: the HUD keeps showing "↑ ↓ · Height" and the touch Height buttons stay enabled for mounted pieces even though `adjustHeight` now returns early (`system.js:59`, `ui.js:153` only hides them for the remove tool).

## Checked and clean

- **Mount/support invariant is consistently enforced** across placement (`system.js:165`), save validation (`state.js:31`) and removal (`removal.js:16`) through the single `mounts.js` predicate. Removal of a supporting ceiling is blocked; removal of the mount itself, and mainframe removal (guarded by `removal.js:12`), still pass. No self-match, since a mounted piece is `category:'utility'` and can never satisfy the `category==='floor'` side.
- **Footprint containment** — verified `null` for all five roof/ceiling pairs at 0°/90°/180°/270°, and 49 legal light slots per 4×4 ceiling with `max|offset| = 1.5`, i.e. the 0.8 m fixture never overhangs.
- **Collider rotation** is exact: `getWorldBoxes` re-derives the AABB from rotated corners, and mount rotations are multiples of π/2 (or inherited).
- **Rounded-profile colliders are conservative** — heights sampled at each cell's near corner, where the profile is monotonically decreasing in z (and x for corners); the largest inter-cell step is 0.1447 m, consistent with the test's 0.16 m bound.
- **Switch persistence and power** — `lightOn` is validated as an optional boolean gated on `PIECES[type].light` (`state.js:20`); `powerDemand` charges 0.05 kW only while on and treats `undefined` as on, matching the visual and fixture predicates.
- **Bounded lights** — ceiling lamps join the existing 4-slot `nearestServiceLights` pool with the 28 m cull; no per-lamp allocation.
- **Server snapshot compatibility** — `server/base-sites.js` shares `validBuild` and `planRemoval`, so the mount invariant is re-checked server-side; its stale-save guard compares `type`/`position`/`rotation` only, so a lamp toggle round-trips through `save`. `lightOn` is inside `layoutKey` (`cloud.js:7`), so a toggle is correctly detected as a pending local change and queued rather than clobbered.
- **Controller path** — the toggle mirrors the door path exactly (`structuredClone` → `store.write` → `sync` → `gamepad.suspend`), so held-X toggles once; the new Roofs tab uses the existing dynamic `LB/RB` cycle and keeps every wheel at 8 entries; all five touch keys referenced by `ui.js:153` exist; `mkdir` is imported in `scripts/build-ui.spec.js`.

Findings 1 and 2 are confirmed by execution; 3 and 4 are read from the control flow and I did not run them.