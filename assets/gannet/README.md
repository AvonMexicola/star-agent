# Meridian Gannet T-06

Original vehicle transport authored for [SA-SHIP-002](../../project/tasks/SA-SHIP-002.json) and the [medium ship brief](../../docs/briefs/meridian-medium-ships.md). This is an isolated geometry, material, rig and studio checkpoint. Flight, inventory, carrier and multiplayer integration belong to the root integration lane and are not established by this asset.

The hull has a hollow pressure cabin, pilot/passenger seats, two rest berths, fitted lockers, four physical MFD surfaces, two fixed elevator call panels, a rear vehicle elevator, a six-leaf retracting hatch, four telescoping landing feet and two actual engine nozzle anchors. All measurements use metres, +Y up and -Z forward.

`layout.json` is the authored contract. `collision.json` is generated from applied mesh bounds before material batching; it preserves separate walls/furniture/moving pieces rather than filling the accessible hull with one box. `manifest.json` records the actual runtime/source hashes, budgets, input identities and packing error. The packed `.blend` retains editable geometry and embedded source images. No generated external art or paid service was used; the existing approved Meridian emblem is reused.

| Contract | Value |
| --- | --- |
| Conservative closed envelope | [-8,0,-13] to [8,7.2,11] |
| Main deck / standing eye | 1.4 / 3.15 m |
| Pilot eye | [0,2.95,-8.4] |
| Clear vehicle bay | X ±2.9, Z 4.5…11, Y 1.4…4.6 |
| Vehicle elevator | 5.8 × 6.5 m, top Y 0…1.4, 0.4 m/s |
| Fixed vestibule | X ±2.9, Z 3.4…4.5, deck 1.4 |
| Cabin portal | Z 3.4, X ±0.85, Y 1.4…3.8 |
| Burrow park | [-0.3,1.4,7.525], heading π |
| Freight | Two 64 SBU banks, outside the net clear bay |
| Gear | Four named telescoping roots; authoritative 1.8 s progress |

The elevator plate is 0.16 m thick below its support surface, so its underside reaches Y -0.16 when lowered. Root must retain canonical ground/support and assess terrain contact in the real loading journey. The studio contains no alternate terrain floor for gameplay.

## Rebuild

Use Blender 5.2 and Python with Pillow, from the feature checkout:

```sh
python3 blender/gannet_build.py
node --test tests/gannet.test.js
npx vite build --config scripts/gannet-vite.config.js
```

The wrapper generates deterministic 1024² PBR swatches, builds the Blender source on CPU, exports to `assets/gannet/.staging`, packs the GLB and verifies budgets before publishing. UVs and indices are retained; rigid positions have a maximum allowed 1 mm quantization error. No rendering or browser starts during this build. The source builder uses a clean factory scene. Staged input hashes are checked against the current builder, helper, layout and texture files before publication. Individual final renames are atomic; the bundle is not a multi-file filesystem transaction.

The procedural maps supply restrained ceramic/metal/polymer response. Their AO channel is white, not a claimed whole-hull contact bake. Geometry supplies real seams, bevels, ribs, frame thickness and recesses. Source PNGs and runtime WebP derivatives are retained with provenance.

## Integration API

- `src/gannet-layout.js`: `GANNET_LAYOUT`, `GANNET_LIFT`, `GANNET_VESTIBULE`, `gannetMechanismPose(pose)` and `gannetCollisionParts(pose)`.
- `new GannetSystems({canMove,canOperate})`: local elevator/hatch clock, `.lifts`, `.lift`, `.hatch`, `.powered`, `.moving`, `.secured`, `.command(action,{occupant})`, `.toggle('vehicle',occupant)`, `.update(dt)` and `.mechanismPose(gearProgress)`. The caller must supply trusted parked/powered/occupancy guards for gameplay. These guards are rechecked during motion.
- `systems.floorAt(localEye)` returns `{y,source,lift}` or null; source is `gannet-deck` or `gannet-lift:vehicle`. It is deliberately not the numeric `FreighterSystems.floorAt` API. Root's gameplay adapter owns conversion, sweep/interaction/rider carry and navigation.
- `createGannet(systems,{url})` returns a Three group with `readyPromise`, `setMechanismPose`, `update`, `updateGear(dt,deployed,authoritativeProgress)`, `updateDisplays(dt,nav,inventory,course)`, `displayState()` and `assetNode(name)`. `displayState()` is the shared MFD's actual snapshot. The inspection-only display pages are separate and do not fabricate Navigation or inventory state.
- `layout.controls` records the two physical call panels and their standing approach eyes. `layout.lift.control` remains [2.5,1.4,4.85]. Runtime input uses the shared router through root's adapter; this studio is not controller gameplay acceptance.

## Inspection and evidence

After acquiring the shared GPU window:

```sh
npx vite --config scripts/gannet-vite.config.js --port 5581 --strictPort
GANNET_HARDWARE=1 npx playwright test -c scripts/gannet.config.js
```

Run the dev server or the self-managed test server, not both on port 5581. The studio is `/`; its API is `window.gannetStudio` (also `shipStudio`). It includes real camera views, native buttons, the mechanism cycle, a 1.8 m scale reference and an optional actual Burrow mesh. Its reference rover does not establish physical vehicle simulation. Build/cache/evidence directories live under the operating system's temporary directory or `GANNET_QA_DIR` / `GANNET_EVIDENCE`.

CPU tests read the current checkout's Burrow. `GANNET_ROVER_ROOT` can select another explicitly identified local rover checkout without editing it. The initial final-rover check used asset SHA `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`. See [production record](../../docs/qa/gannet/production-record.md) and [iteration history](../../docs/qa/gannet/iteration-history.md). No studio or physical-game visual acceptance is claimed by these CPU checks.
