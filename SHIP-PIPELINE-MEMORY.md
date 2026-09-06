# Star Agent ship creation pipeline — durable project memory

Recorded: 2026-09-05. Reference implementation: Nomad surveyor, implementation
commit `9370c53`, [ship PR #4](https://github.com/AvonMexicola/star-agent/pull/4).
The ship PR was built on [inertial-flight PR #1](https://github.com/AvonMexicola/star-agent/pull/1).
This is reusable project memory for humans, Fable 5.1 and future coding agents.
It records the implemented pipeline and lessons from its delivery. Check current
source and PR status before reusing historical dimensions or integration details.

Cees's asset workflow reference now lives in
[the asset production standard](docs/asset-production-standard.md), with a
[complete hangar production record](docs/qa/hangar-production-record.md).
Use those alongside this ship-specific memory and the current `QUALITY.md`.

## Start here

The proven route is:

1. Read the physical layout and navigation contracts before designing the ship.
2. Work in an isolated branch/worktree and claim concrete files in the handoff.
3. Build an original ship in Blender, preserving a hollow, accessible cabin.
4. Save editable source and export a local-coordinate GLB with named moving pivots.
5. Load it around the existing runtime cabin, hatch, ramp and interactions.
6. Wire functional storage and live cockpit displays to actual game state.
7. Review exterior, cockpit and cargo in the isolated browser studio.
8. Test the production game journey, asset failure, persistence and shaders.
9. Submit source, runtime asset, focused code, screenshots and honest limitations.
10. Notify Fable through `HANDOFF.md`; the manager reviews and owns merging/deployment.

For the existing Nomad, use [the player and authoring guide](docs/nomad-ship.md).
For a new ship, treat the dimensions below as a compatibility target, not a
universal ship format: the game does not yet have a generalized multi-ship registry.

## What this pipeline actually produced

- An original Blender exterior with ivory ceramic, petrol/teal inset panels,
  orange rescue markings, swept wings, raked glazing, engine detail and four legs.
- An editable `.blend` and Python builder, plus an exported GLB used by the game.
- The existing walkable cabin, pilot chair, hatch and boarding ramp.
- A hollow cargo chest with an animated lid and usable inventory dialog.
- Persistent item transfers between 120 kg ship storage and a 20 kg backpack.
- Four rectangular physical MFDs showing live flight, navigation, systems and cargo.
- A usable procedural exterior and cargo fallback if the GLB fails to load.
- Studio screenshots and production browser evidence, including real keyboard boarding.

Not implemented by this ship contribution: cargo consumption, harvesting, item
equipment effects, cargo mass in flight physics, interactive MFD pages, a general
ShipState/event bus, animated suspension, ship selection, multiplayer inventory,
or account/cloud persistence. Re-entry, crash damage, controller support,
external cameras and characters are separate contributions. Read their current
handoffs before integrating; their existence elsewhere is not proof that a
particular ship branch includes them.

## Files and ownership boundaries

| Concern | Source of truth / file |
|---|---|
| Team coordination and manager notifications | [HANDOFF.md](HANDOFF.md) |
| Project architecture and contribution rules | [AGENTS.md](AGENTS.md) |
| Original Blender builder | [assets/ship/build_ship.py](assets/ship/build_ship.py) |
| Editable authored model | [assets/ship/nomad.blend](assets/ship/nomad.blend) |
| Runtime asset | [public/models/nomad.glb](public/models/nomad.glb) |
| Physical layout, horizontal collision and interaction selection | [src/boarding.js](src/boarding.js) |
| Cabin, fallback, hatch/ramp/lid animation and GLB loading | [src/ship-walkable.js](src/ship-walkable.js) |
| Modes, movement, boarding and interaction dispatch | [src/navigation.js](src/navigation.js) |
| Inventory state, mass, transfers and save validation | [src/ship-inventory.js](src/ship-inventory.js) |
| Inventory modal and input lifecycle | [src/ship-inventory-ui.js](src/ship-inventory-ui.js) |
| Inventory styling | [src/ship-inventory.css](src/ship-inventory.css) |
| Live MFD textures, meshes and telemetry | [src/ship-mfd.js](src/ship-mfd.js) |
| Scene integration, floating origin, weathering and diagnostics | [src/main.js](src/main.js) |
| Hull weathering shader | [src/surface-materials.js](src/surface-materials.js) |
| Studio page and implementation | [public/dev/ship.html](public/dev/ship.html), [src/ship-studio.js](src/ship-studio.js) |
| Inventory, collision and real-asset tests | [tests/ship-inventory.test.js](tests/ship-inventory.test.js) |
| Production ship journey | [scripts/ship.spec.js](scripts/ship.spec.js), [scripts/ship.config.js](scripts/ship.config.js) |
| Studio visual checks | [scripts/ship-studio.spec.js](scripts/ship-studio.spec.js), [scripts/ship-studio.config.js](scripts/ship-studio.config.js) |
| Separate studio dependency cache | [scripts/ship-vite.config.js](scripts/ship-vite.config.js) |
| Player instructions and committed screenshots | [docs/nomad-ship.md](docs/nomad-ship.md), `docs/images/nomad-*.png` |

`src/ship.js` and `src/ship-mk2.js` are older/alternative ship implementations.
Inspect the import in `main.js`: improving an unused alternative does not improve
the playable ship. The reference game imports `createWalkableShip`.

## 1. Establish a safe contribution workspace

Read current issues, PRs and `HANDOFF.md`, including its latest branch/ownership
rules. Existing handoff sections contain historical descriptions; later team
directions and the active source take precedence.

Never switch branches in a checkout shared with other active sessions. During
this work, a shared branch switch affected multiple contributors. The successful
delivery was extracted into `/tmp/star-agent-ship-review`, preserving unrelated
controller/crash edits in the shared checkout.

For a new topic, use an isolated worktree. Choose the actual integration branch
or an explicitly declared dependency as the base; do not assume PR #1 is still
the right base for future work.

```sh
git worktree add -b feat/ship-topic /tmp/star-agent-ship-topic origin/feat/visual-fidelity
```

Install dependencies with `npm ci` in that checkout, using the project's supported
Node version (22.12+ for the reference). A local dependency symlink can be useful
on this machine, but `node_modules/` in `.gitignore` may not hide a symlink named
`node_modules`. Never stage that link or the dependency tree.

Claim new files and small shared integration points before editing. Keep one
worktree per feature. If other features overlap `main.js`, `navigation.js`,
`index.html` or `package.json`, compose only your changes into the review branch;
do not copy the entire dirty shared version over its baseline.

## 2. Design around the physical ship

The game uses metres, **Y up**, **nose -Z**, **aft +Z**. World positions remain
JavaScript doubles relative to the planet centre. The reference planet radius
is 1,592,750 m and its sun is 25,000,000,000 m away.

Model ship geometry around a local origin. In the game, subtract the current
double-precision render origin before uploading Float32 geometry or matrices.
Do not bake astronomical world positions into Blender meshes or GLB transforms.

The reference `SHIP_LAYOUT` in `boarding.js` is:

| Contract | Reference values, metres |
|---|---|
| Closed flight envelope | min `[-6.05, 0, -6.82]`, max `[6.05, 4.28, 4.28]` |
| Landing pad contact plane | `y = 0` |
| Cabin floor / standing eye height above floor | `1.0` / `1.75` |
| Walking capsule radius | `0.25` |
| Interior horizontal limits | x `[-1.65, 1.65]`, z `[-4.5, 3.8]` |
| Hatch centre / width | x `0`, z `4`, width `1.8` |
| Doorway clear height in runtime model | `2.5` |
| Ramp | x `[-0.9, 0.9]`, z `[4, 7.2]`, from y `1` to `0` |
| Pilot seat / seated eye | `[0, 1, -2.8]` / `[0, 2.55, -2.8]` |
| Stand location after leaving chair | `[0, 2.75, -1.2]`, facing aft |
| Cargo collision box | x `[0.93, 1.65]`, z `[0.35, 1.95]`, recorded top y `2.08` |
| Cargo access point | x `0.93`, z `1.15` |
| Cargo hinge | `[1.65, 1.98, 1.15]` |

The open ramp's walk plane is `y = (7.2 - z) / 3.2`; its geometric length is
`hypot(3.2, 1)`. Collision and animation separately track door readiness. Preserve
their conservative walk-through gate and verify it in the real boarding test.

Keep the central aisle clear, including capsule clearance around the chest.
`constrainShipStep` performs swept horizontal collision against expanded walls,
the door and the cargo body. It is not arbitrary mesh collision or a complete
vertical capsule solver. Adding modeled furniture alone does not add collision.

If dimensions change, update `boarding.js`, authored geometry, runtime geometry,
interaction distances, tests and station flight-envelope checks together. The
builder/runtime still contain explicit dimensions; not every value is generated
automatically from `SHIP_LAYOUT`. Never introduce a duplicate exported layout
that can silently drift away from navigation.

Terrain support comes from `world.js`; station support comes from the authored
station/deck system. A nicer landing pad mesh does not authorize a second ground
height function. Preserve existing terrain fallback, skirts and streaming.

## 3. Author in Blender

The reference builder is an original asset workflow requiring no paid service,
hosted API, API key, downloaded textures or third-party art. Blender 5.2.0 LTS
was used; inspect local API changes when using another version.

Coordinate conversion is explicit:

```python
def xyz(p):
    # Game (x, y, z) -> Blender (x, -z, y).
    return (p[0], -p[2], p[1])
```

With glTF Y-up export, this maps back into the game's frame. Apply primitive
scale before beveling. For rods/cylinders, set `rotation_mode = 'QUATERNION'`
**before** assigning the direction quaternion. Reversing that order produced
vertical struts and sideways engine disks during the first visual pass.

Build a hollow ship, not a single filled fuselage. The Nomad builder supplies
the static exterior and cargo container; the cabin and animated boarding parts
remain runtime geometry. Use separate hull layers, bevels, weighted normals,
recessed vents and restrained material variation to make readable detail.
The current canopy uses sloped, framed glazing rather than a tall rectangular
front wall. Inspect both exterior silhouette and seated visibility.

Mirrored polygon planforms need consistent outward normals. Convert lettering
to meshes, verify its face orientation, and inspect it from the relevant side;
the first rear registration was backwards. Apply modifiers before export.

Create moving parts under stable named pivots. The required cargo node is
**`CargoLid`**, at `[1.65, 1.98, 1.15]` in game coordinates. Preserve the child's
world transform when parenting. Keep it separate from static material batches.
The runtime opens it with local `rotation.z = -progress * 1.35` radians.
Model the chest walls and bottom separately so lifting its lid reveals a cavity.

Join static meshes by material to limit draw calls. After joining, Blender
deletes source objects: recollect objects from the live scene for the next
material rather than reusing stale RNA references. Keep origins ship-local and
preserve moving child transforms. The reference export is approximately 3.4 MB,
with an approximately 778 KB `.blend`; these are historical sizes, not budgets.

## 4. Preserve source and export the GLB

From the feature checkout:

```sh
blender --background --python assets/ship/build_ship.py
```

The builder writes both `assets/ship/nomad.blend` and
`public/models/nomad.glb` and sets `save_version = 0` to avoid `.blend1` backups.
It uses `GLB`, `export_yup=True`, `export_apply=True`, and `export_extras=True`.

For a headless environment where Blender stalls on audio shutdown, this invocation
completed successfully on the authoring machine:

```sh
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python assets/ship/build_ship.py
```

Observed local startup messages included a missing `cattrs` module in Blender's
remote-asset add-on, an unavailable optional MeshOptimizer library, and a denied
thumbnail cache write. The ship itself exported and loaded successfully without
using those features. Diagnose whether a warning affects the requested export;
do not report success solely because a file exists. Inspect the asset in the
browser and test its bounds/pivot. Do not repair unrelated machine packages or
weaken sandbox permissions just to silence optional startup messages.

The builder recreates the authored design deterministically from its parameters;
this is not a promise of byte-identical `.blend`/GLB output across Blender versions.
Rebuilding overwrites the `.blend`: preserve manual edits first, then either
incorporate them into the builder or document the source/export divergence.
Ship the source and export together. Do not commit backup files or export logs.

## 5. Integrate the asset without breaking play

`createWalkableShip({ assetURL } = {})` returns a Three.js group synchronously.
It immediately contains a functional procedural fallback and asynchronously loads
the GLB using `GLTFLoader`.

| Runtime member | Purpose |
|---|---|
| `readyPromise` | Resolves to loaded model, or `null` after handled asset failure |
| `setDoor(open)` | Sets target hatch/ramp state |
| `setStorage(open)` | Sets target cargo lid state |
| `update(dt)` | Advances visual hatch, ramp and lid animations |
| `updateDisplays(dt, nav, inventory, course)` | Updates live MFD textures |
| `displayState()` | Returns read-only display diagnostics |
| `userData.assetStatus` | `loading`, `ready` or `fallback` |
| `userData.assetError` | Asset-load failure detail when applicable |
| `userData.storageProgress`, `doorProgress`, `rampReady` | Visual diagnostics |

Require `CargoLid` before activating the loaded model. On success, add the GLB,
select its lid pivot, and hide only the fallback exterior/cargo. Do not hide the
runtime cabin, lights, hatch, ramp or MFDs. On failure, keep a usable ship and
storage interaction; a decorative asset must not prevent core play.

In `main.js`, attach the ship, apply weathering to the original runtime meshes,
and apply it again to the late-loaded model through `readyPromise`. Each frame,
position/orient the ship using the navigation state and render origin, forward
the door state, animate it, and update displays when visible. Preserve the
existing distinction between a parked ship and the seated in-flight view.

Built-in Three.js standard/basic materials supply the required logarithmic depth
support. Any replacement custom geometry shader needs the corresponding log-depth
chunks. The atmosphere consumes that depth; inspect actual rendered output.
Weathering must skip MFD screen materials marked `userData.unweathered`, so a
canvas display does not receive the hull's normal/roughness shader injection.

Asset URL handling matters: production `base: './'` can be relative to the page.
The development studio explicitly passes `/models/nomad.glb` because its page
lives under `/dev/`. Test URL resolution in both the game and studio; never
assume a nested preview page resolves relative assets like the root game.

## 6. Connect physical inventory access

`interactionAt` selects the seat, cargo access or door from a ship-local walking
position. Cargo access requires being inside, on the accessible side of its box,
within 1.12 m of the reference access point. The seat retains priority; the door
remains reachable farther aft. Verify the thresholds after changing layout.

`Navigation.embark()` dispatches the cargo interaction through `openInventory`.
The UI clears held movement, stops walking velocity, disables navigation,
releases pointer lock, opens the lid and calls the accessible dialog's
`showModal()`. Help and quick-transit shortcuts are gated while inventory is open.
On close/Escape, close the lid, clear input and re-enable navigation. Controller
integration must respect these same modal gates and avoid a stale action edge
moving or launching the ship as the dialog opens/closes.

The current inventory contract is:

- Storage key: `star-agent.nomad-inventory.v1`; JSON schema version `1`.
- Containers: `ship` (120 kg) and `pack` (20 kg).
- Repair kit: 4 kg; field ration: 0.5 kg; sample case: 2 kg; scanner: 3 kg.
- Initial ship counts: 3 repair, 12 ration, 6 sample, 1 scanner (33 kg).
- Initial backpack: 2 rations (1 kg).
- A transfer moves exactly one item, checks its source count and destination mass,
  and never creates/discards an item when a capacity check fails.
- Loading validates version, finite safe non-negative integer counts and capacity.
  Malformed data falls back to initial inventory. Plan migrations before changing
  IDs or meaning of an existing schema version.
- Transfers persist to browser local storage; unavailable storage leaves the
  session usable and shows a persistence limitation.

Persistence is per browser origin and currently shared across planet seeds. A
different localhost port is a different origin; do not mistake separate preview
inventories for a broken save. Inventory persistence does not persist parked ship
position or a flight session. The dialog uses labeled controls, capacity meters,
an announced result message and preserves the focused transfer control on redraw.

## 7. Build live MFDs with a usable forward view

Use real screen meshes in the cockpit. The current layout has four 512×320
canvas textures (16:10) on 0.464×0.29 m planes. Mount centres are
`x = (i - 1.5) * 0.52`, `y = 2.08`, `z = -4.25`, tilted around X by `-0.36` radians.
Textures update at approximately 5 Hz, with actual cadence limited by frame rate.

Screen material is `MeshBasicMaterial`, with an sRGB canvas texture,
`toneMapped: false`, and the unweathered marker. The static bezels and side keys
are transformed into one ship-local batch. Four screens plus that batch require
five base scene draws; shadow or other passes can add work.

| Display | Actual inputs |
|---|---|
| Flight | Speed, altitude above terrain, mode/flight assist |
| Navigation | Optional course, relative bearing, latitude/longitude |
| Systems | Flight environment, door target/progress, local vertical velocity |
| Cargo | Real inventory mass and physical access location |

Use explicit empty states such as `NO COURSE`. Do not display invented fuel,
shield, power or damage values as working systems. Side keys are visual only in
this implementation. Future touch/button page selection needs a new input and
focus contract, not just extra painted screen labels.

The initial wide MFD row clipped the outer screens and the console hid lower
text. The final layout was tested from the actual seated eye with the game's
52° camera, not just a flattering studio angle. Check the full four-screen row,
bottom text, canopy frame, forward horizon and HUD overlays at target resolutions.

## 8. Preview and diagnose in an isolated studio

```sh
npm run dev -- --config scripts/ship-vite.config.js --port 5190 --strictPort
```

Open `http://localhost:5190/dev/ship.html`. The page provides exterior, boarding,
cockpit, cargo and open/close-lid views with orbit controls. Its implementation
lives in `src/ship-studio.js`, where Vite resolves bare imports. JavaScript served
raw from `public/` cannot directly resolve `import ... from 'three'` without an
appropriate import map; this caused the first studio startup failure.

The studio imports source modules and is **development-only**. A production
preview of `/dev/ship.html` is not a supported viewer route just because the HTML
was copied to `dist`. The real game route is tested separately in production.

The separate cache `/tmp/star-agent-ship-vite-cache` avoids other active Vite
servers invalidating optimized dependencies. A `504 Outdated Optimize Dep` was
resolved with a separate cache/server, not by changing the ship geometry.

Chat-owned development processes stopped after earlier turns. For a long-lived
local viewer, this project used a transient **user** service named
`star-agent-ship-viewer.service`, running Node/Vite from the isolated worktree.
That is a session convenience, not production infrastructure or a boot-persistent
installation. Resolve current Node/Vite paths locally rather than hardcoding a
personal machine path into the repository.

```sh
systemctl --user status star-agent-ship-viewer.service --no-pager
```

Before a studio test, account for that viewer: the test reserves port 5190 and
has `reuseExistingServer: false`. Coordinate stopping/restarting the known viewer
or choose a different test port and cache. Never kill unrelated browser/Vite
processes. Verify an actual HTTP response and browser asset loading before
promising a working viewer link; service creation can precede HTTP readiness.

## 9. Verify geometry, behavior and rendered output

For the reference pipeline:

```sh
npm test
npm run build
npm run test:browser -- -c scripts/ship-studio.config.js
npm run test:browser -- -c scripts/ship.config.js
```

Depending on changes, also run the general browser suite and the existing full
boarding/station journeys. Existing commands include
`npm run test:browser -- -c scripts/inspect.config.js` and
`npm run test:browser -- -c scripts/station.config.js`; read their port/build
settings before using them beside another session.

The ship production config uses port **5186**, build directory
`/tmp/star-agent-ship-build`, reports `/tmp/star-agent-ship-tests`, a 1440×900
viewport and one worker. The studio uses **5190**, reports
`/tmp/star-agent-ship-studio`, and a 1600×1000 viewport. Coordinate these resources
between ship sessions too; the paths isolate other features, not two simultaneous
runs of the same ship config.

Evidence required by the implemented tests:

- Transfer conservation, capacity rejection, persistence/reload, malformed saves,
  unavailable browser storage and invalid item/container input.
- Collision with the real chest, a clear central aisle, and interaction from the
  cabin without interaction through the outside wall.
- Parse the actual GLB; assert its bounding box fits the flight envelope and its
  `CargoLid` hinge is correctly positioned and locally scaled.
- Load the production game, transit to a test starting region, land with **L**,
  stand with **F**, walk to storage, transfer an item, and observe cargo MFD data.
- Ensure movement/help/orbit shortcuts cannot escape the inventory modal.
- Close storage, walk to the hatch, lower the ramp, walk outside, return, close
  the hatch, walk to the chair, sit and launch using normal controls.
- Reload and confirm the item transfer persisted.
- Abort the GLB request and confirm fallback boarding/storage remain usable.
- Inspect screenshots and collect page/WebGL/Three.js shader errors.

Quick transit may establish a test starting location; it does not replace the
physical boarding steps being tested. Diagnostic direct placement in the focused
fallback test is not evidence for the separate end-to-end walking journey.

On the authoring machine, sandboxed isolated Node tests sometimes reported only
one result per file without executing/reporting their individual cases clearly.
Use an approved unrestricted `npm test`, or the diagnostic command below, and
inspect real case names/counts rather than presenting file count as case count:

```sh
node --test --test-isolation=none tests/ship-inventory.test.js
```

Chromium could not launch in the restricted sandbox; the approved browser runs
used the system executable and ANGLE/SwiftShader. Several parallel software-GPU
runs caused a landing timeout. Render scale 0.4 made movement verification
practical; final game screenshots used scale 1.0. Separate performance limits
from assertion failures, inspect navigation/console state, and do not mask an
actual defect merely by increasing timeouts.

Historical verified results for implementation `9370c53`: **46 isolated unit
cases, production build, two production ship browser cases and one studio case
passed**. The earlier combined controller/crash workspace also passed its
56-case unit suite and two ship browser cases before extraction. These counts
describe those snapshots, not all future branches or current production.
No page/shader errors occurred in the passing ship runs. Browser: Chromium 151,
ANGLE/Vulkan SwiftShader. This is correctness evidence, not hardware FPS evidence.

Inspect `/tmp/nomad-*.png` while iterating. Durable evidence lives in
`docs/images/nomad-exterior.png`, `nomad-cockpit.png`, `nomad-cargo-open.png`.
Commit selected non-private screenshots, not generated reports, `dist`, logs,
dependency folders or recordings containing private information.

## 10. Review, manager notification and further integration

Before delivery, review the focused diff and `git diff --check`. Update player
controls, authoring notes, screenshots and limitations to match the final result.
Use explicit file staging in an isolated worktree; avoid importing other sessions'
changes or a `node_modules` symlink. Keep source and GLB paired.

Submit a PR describing the problem, resulting behavior, verification environment,
screenshots, dependency branch and limitations. Use a body file for multiline
`gh pr create` content. Check CI and reviewer requests. A successful automatic
Vercel preview does not mean the manager merged or deployed the ship to production.

Fable 5.1 is the project lead. The established notification channel is the shared
`HANDOFF.md`. Append a clearly addressed notice with the memory path, PR, status,
integration boundaries and any required follow-up. Preserve other agents' text;
do not rewrite historical handoff sections. A posted notice is not an
acknowledgement from Fable. No separate direct-message channel was available to
this ship session.

Manager integration should preserve both sides of overlapping changes:

- `main.js`: async model weathering, inventory modal gates, MFD updates and
  diagnostics alongside any controller/crash/re-entry/camera integration.
- `navigation.js`: storage interaction beside controller actions and crash gates;
  stop the current update if an action opens a modal.
- `boarding.js`: actual hull/cargo dimensions; keep any future suspension or
  character clearance changes consistent with the visible ship.
- Materials/re-entry: compose shader hooks, exempt cabin/instruments as required,
  and refresh late-loaded hull meshes after their materials are prepared.
- External cameras: preserve the distinction between actual camera render origin,
  ship pose and pilot position; review first-person MFD framing again.
- `package.json`, help UI and documentation: combine focused additions instead of
  replacing files from one feature with another feature's older copy.

Per the team handoff, Fable/Claude reviews and merges dependencies in order and
owns deployment. Do not silently merge or redeploy while documenting this pipeline.

## Completion record template for the next ship

```text
Ship / purpose:
Branch, base dependency, PR, implementation commit:
Owned files and shared integration points:
Blender version, editable source, builder and runtime asset:
Coordinate frame, flight bounds, cabin/seat/ramp/cargo changes:
Named pivots, animation owners, fallback behavior:
Inventory schema/capacities and actual MFD inputs:
Unit/build/browser checks actually run and results:
Browser, renderer/backend, viewport, render scale:
Inspected screenshot paths and limitations:
Viewer command/port and known process ownership:
Manager handoff location; acknowledgement if received:
Merged/deployed status, only when verified:
```

When extending the pipeline, update this file and its pointers in the same
contribution. Do not leave a new agent reconstructing the workflow from tool logs.

## Atlas and Nomad cockpit extension — 2026-09-06

Cees requested a much larger ship with a huge cargo elevator and cargo lifts,
explicitly as an unlockable ship, then requested a better Nomad pilot chair and
removal of the centre windscreen strut. Implementation lives in isolated
`/tmp/star-agent-freighter-work`, `feat/unlockable-freighter`, based on integrated
`feat/visual-fidelity` ad20802. Preserve the separate opening, travel, equipment,
external-camera and terrain lanes when merging. Shared checkout branch switching
remains prohibited. Manager Fable/Claude owns merge and deployment.

### Multiple ship layouts and progression

`boarding.js` still exports the original immutable Nomad dimensions as the default.
`Navigation.layout` selects the current layout. Do not replace the global Nomad
dimensions to accommodate a larger ship. Seat transforms, parked origin, walking
eye height, approach clearance, flight station collision and main rendering must
all use the active layout. `nav.canDock` passes the full active hull and orientation
to the station; checking the pilot point alone admits ships whose stern hits a wall.

`fleet.js` defines Nomad (120 kg) and Atlas (2,400 kg). There was no existing economy
or progression system at this base. The first milestone is a real surface landing
followed by a station docking. Navigation emits those events at successful
touchdown/dock; merely opening Fleet or transiting to an approach does not count.
`star-agent.fleet.v1` stores validated boolean progress and selected ship. Nomad is
the new-player default. Atlas can only be selected after the milestone. Selection
requires a seated player at the station, awaits the model, validates the state
again, aligns the replacement with the bay and uses its own seat offset. Switching
to a smaller hold fails if the current inventory cannot fit. The existing inventory
manifest and backpack transfer without duplication. The UI receives a getter for
the active ship, so storage animations do not continue targeting the retired model.
Modal navigation and shortcut gates must include Fleet as well as inventory/help.

### Atlas model and lift contract

The original builder `assets/ship/build_freighter.py` outputs `atlas.blend` and
`public/models/atlas.glb`. Same Y-up/-Z convention and Blender conversion as Nomad.
The closed collision envelope is x ±9.5, y 0..9.8, z -16..14 metres. Cargo deck
y=4, pilot eye `(0,5.55,-10.5)`, standing point `(0,5.75,-8.8)`.

Required empty nodes retain their names and parent transforms:

| Node | Deck travel | Footprint |
| --- | --- | --- |
| MainLift | 0..4 m | x -4..4, z 0..10 (8 × 10 m) |
| PortLift | 4..7 m | x -5.9..-3.7, z -6..-3 |
| StarboardLift | 4..7 m | x 3.7..5.9, z -6..-3 |
| CargoLid | hinged around its outboard edge | forward starboard inventory chest |

`FreighterSystems` is the only lift simulation. Navigation advances it and carries
a rider by the exact platform displacement in ship-local Y before walking. Render
code reads the same y values and never runs an independent lift clock. Platform
origins are their upper walking surfaces; authored deck meshes extend below them.
Calls and platform controls are proximity/height checked. Swept expanded rail
bounds prevent walking into an absent platform or off a moving platform. A player
straddling an edge cannot start it. Main ground boarding opens at the rear only
when fully lowered. Internal upper landings open at the forward edge; guards remain
on the other sides. Maintain headroom above the upper landing when sculpting the
forward roof: the shelf is at y=7 and the walker's eye at 8.75. The roof transition
belongs ahead of z=-8, outside that standing volume.

The main elevator drives the segmented rear hatch. Launch requires main y=4 and
both internal lifts y=4, with no pending travel. The cargo cases on the small lifts
are secured props that move with them, with a clear rider lane and collision; they
are not loose movable inventory crates. Both a visual fallback and physical lift
state remain available if the GLB fails. The MFD Systems page shows cargo-lift
security; Cargo uses the active inventory capacity.

Station collision needs separate local hull, drive and landing-gear boxes for
Atlas. A single solid envelope incorrectly filled the open underbody and snagged
the station pad before docking. The outer envelope is still used for whole-ship
hangar-fit tests; movement sweeps all component boxes and uses the earliest hit.
Do not bypass the real station collision tree to solve a large-ship docking issue.

### Nomad cockpit refinement

The centre canopy division is removed in the Blender source, not hidden by a
runtime mask. A ray from the actual seated eye tests for opaque forward obstructions.
The new `PilotChair` group contains material-batched shell/upholstery, shoulder
and thigh supports, harness webbing, headrest and armrests. Its seat and standing
coordinates are unchanged. The old primitive chair is a separate fallback group;
hide it only when `PilotChair` exists in the loaded GLB. Never leave both visible.
Batch static chair meshes per material under that parent to avoid dozens of draws.

### Validation, evidence and delivery

`tests/freighter.test.js` covers unlock/save rules, lift carriage, launch readiness,
shaft collision, inventory conservation and GLB bounds/pivots. The station suite
includes actual Atlas docking, platform traversal and launch interlocks. Nomad
asset tests include chair presence, rear-aisle clearance and the unobstructed
forward ray. The complete suite reached 76 passing tests during this extension.

`scripts/freighter.config.js` runs production Atlas and Nomad tests on 5214 with
output `/tmp/star-agent-freighter-build`. It includes the full Atlas unlock and
physical cargo journey plus missing-asset fallback. Fixture positioning is only
used for starting landing/docking approaches; do not describe that test as a full
manual interplanetary flight. Explicitly wait for modal close/enabled navigation
before pressing movement keys, since native dialog close events are asynchronous.

Studio configs: `freighter-studio.config.js` on 5193 and
`nomad-refinement.config.js` on 5215. Port 5194 belonged to another feature session;
do not stop or reuse it. The old 5190 Nomad viewer can still be running from the
previous ship checkout. Current dev routes are `/dev/freighter.html` and
`/dev/ship.html`, including the Nomad Pilot Seat camera. These source-module routes
are development-only. Screenshots are collected under `/tmp/atlas-*` and
`/tmp/nomad-refined-*`; curated evidence belongs in `docs/images`.

Use Chromium/ANGLE SwiftShader, 1440×900 game and 1600×1000 studio, scale .4 for
movement and 1.0 for final game screenshots. Inspect actual images: the first Atlas
render exposed an MFD-occluding console, which was lowered before delivery. No GPU
performance claims follow from these software-rendered runs. Blender 5.2.0 LTS
successfully exported both ships despite unrelated optional `cattrs` extension
startup and missing MeshOptimizer messages. `ALSOFT_DRIVERS=null` remains useful.

Keep the manager handoff append-only. Commit/push at each green checkpoint or at
least every 30 minutes per the current team policy. The initial implementation
checkpoint was 3e5ef97. See `docs/atlas-freighter.md`, the final PR and the appended
HANDOFF entry for final validation, screenshot links and deployment status.


### Modular station integration (2026-09-06)

See [STATION-PIPELINE-MEMORY.md](STATION-PIPELINE-MEMORY.md) for the twenty-berth
orbital port, shared/instanced station assets, clear floor contract, passenger
elevators, rotating ring collision and schema-2 warehouse transfers. Ship storage
uses the same manifest and capacity rules. The Atlas docking/launch envelope must
stay clear when adding hangar furniture or hanging signs. This station work is
stacked on PR #14; the manager owns integration and deployment.

### Asset budget and editable-source checkpoint — 2026-09-06

The PR20 integration's `0d75c3f` reduces Nomad's small bevels (width at most .04 m)
from three to two segments while retaining its explicit six-segment pilot chair;
Atlas uses two segments for its manufactured bevels. Both runtime GLBs and tracked
editable `.blend` files were rebuilt from the checked-in scripts. Nomad is
57,784 triangles / 3,783,616 bytes; Atlas is 58,460 / 3,770,128. No functional
geometry or UV stream was removed. Names, transforms, materials and lift origins
remain unchanged; millimetre-scale bevel sampling differences are documented in
[the production record](docs/qa/hangar-production-record.md).

Repeat exports preserved positions, normals, indices and JSON, with generated UV
rounding differences up to 1.19e-7; do not claim byte-identical output. Always check
both geometry and encoded byte budgets before accepting a hero asset. The final
0d75c3f production journey suite passed all 18 cases; visual acceptance and any
later art correction remain tracked in the same record. The original Opus review
failed at 3.67; its later attempt stopped at the service's session limit. Neither
an attempted review nor this memory file constitutes merge approval.

## Station-shop inventory continuation — 2026-09-06

The concourse continuation at runtime `9e5a713` keeps the existing inventory key
but migrates valid v1/v2 cargo into a v3 manifest with credits and finite station
shop stock. Purchased weapons/components are stored cargo, not equipped weapons
or installed ship upgrades. The current ship's capacity and Atlas unlock remain
unchanged. A purchase persists money, stock and delivery together before changing
memory; malformed saves remain intact. Read the full migration, physical transfer,
controller and performance evidence in
[the concourse record](docs/qa/station-concourse-production-record.md) before
extending the item catalogue or asset pipeline.

## Atlas Mark II physical controls and four-screen authoring continuation

PR #30 remains a standalone authoring candidate, not installed in the live fleet.
`assets/atlas-mark-ii/layout.json` owns PilotMFD_01..04 transforms/dimensions and
the chair-aligned pilot eye. `createShipMFDs({mounts, includeFrames, screenOffset})`
can consume authored mounts while its default fleet layout and `update()` API stay
unchanged. `updatePages()` permits truthful inspection data without a fabricated
Navigation/inventory object. Four canvases remain 512×320 at 5 Hz.

Use [the physical control standard](docs/physical-control-standard.md) for physical
buttons and projected action labels. `projected-action-label.js/.css` are reusable;
the Atlas adapter demonstrates real ramp/lift/seat state, moving anchors and guarded
F/A/TAP activation. The shared hangar verb contract awaits station adoption.
[Nose/MFD/control evidence and limitations](docs/qa/atlas-mark-ii/cockpit-controls-record.md)
records the actual candidate, input checks, geometry fixes and independent-review boundary.
