# Construction pipeline memory for Fable and future agents

Read `AGENTS.md`, `QUALITY.md`, `docs/controller-contract.md` and the asset
production standard before extending this slice. Player-facing instructions and
current limits are in `docs/base-building.md`. The full design and Miasma material
ideas are proposals in `docs/design/base-building-plan.md`.

## Ownership and authority

`MiningStore` is the single transaction authority for material stacks, equipment,
remote containers, edited voxel density and `state.build`. Do not add a separate
base localStorage key that can commit independently of its recipe payment.
`craft` and `planCost` return a prospective state; only one successful store write
publishes it. Recheck output capacity, sources, ownership and support on activation.
Quota errors and stale browser tabs retain the last complete state. Malformed
construction records pause building and retain original disk content.

The first mainframe creates the claim and its empty physical `build-core-N`
container atomically. Each crate creates its distinct `build-crate-N` buffer.
Use `inventoryUI.registerContainer` with actual physical access callbacks; do not
make every saved base a remotely accessible inventory tab. Only an explicitly
enabled mainframe can supply construction costs across its local claim. Current
owner identity is local single-player state, not multiplayer security.

## Materials and new worlds

Legacy `pack` and `ship` arrays still mean basalt/copper/ice. Six processed material
IDs live under `materials.pack/ship`; remote inventories use item maps. Preserve
existing equipment, ammunition, shop stock, supplies and density edits when adding
resources. All current construction products use kg, finite four-kg stacks, eight
slots and 12 kg mineral mass per attached box. Do not silently change these units
or present fictional field recipes as realistic chemical mass fractions.

Outcrop placement must sample the canonical body terrain. Aeon/Pyre use
`src/mining/construction-deposits.js` and the existing worker/streaming budget;
Selene keeps its regional geology. On a moving body, generate stable IDs and shape
orientation in the body's own rotating frame. The Pyre epoch regression exists
because world-frame cells once replaced nearby deposits after a page reload.
Never evict edited deposits to respawn fresh ore; the bounded ledger is explicit.

Miasma is a separate moon implementation in PR39. Adding it to this slice requires
integrating its canonical descriptor, moving-body anchor conversion, local common
feedstocks and real material IDs together. Its current sulphur/silicate/copper
survey colours alone do not establish mineable voxel deposits or special harvests.
Biological resources, acid tanks and protective suits remain future work.

## Position and geometry contracts

Claims store an immutable body-fixed `anchor`, plus materialized double-precision
world `origin`/`quaternion`. Restore anchors once at construction initialization;
Pyre rotates and translates between page epochs. Static-world migration is exact.
Unknown old Pyre epochs cannot be inferred safely; retain the save and report it.
Each module stores only a claim-local position and a quarter-turn rotation. Subtract
the camera origin before sending claim groups to Three.js. Never upload large
planet/star coordinates directly into float geometry.

`src/build/definitions.js` owns piece costs, canonical solids, support and door
travel. `blender/build_base.py` reads those solids, exports the measured eight-piece
kit and manifest, and generates its shared WebP material maps. Rebuild after a
geometry change; update visual and collision tests together. `AUTHORED_BOUNDS`
includes rails/trim for complete placement checks; those envelopes are not filled
walking colliders. Door travel reservations must fit an enclosed room. Current
two-leaf pocket doors leave module corners clear.

Foundation/floor support, stair risers and handrail collision are distinct. The
walker uses radial terrain plus authored support, retaining elevated floor height
through navigation updates. Keep the one-millimetre contact tolerance: real lunar
curvature otherwise blocks a nominal 0.3 m foundation. It must not permit taller
risers. Upper floors need two supported walls; loading an unsupported island must
not make it walkable. Stairs can be installed before the upper landing, but that
landing must occupy an adjacent bay to leave headroom above the stairs.

`BuildSystem.raycast` serves weapon obstruction and expanded moving-envelope
queries. Ship sweep bounds come from navigation's current boarding layout relative
to its seat. Future ships must not use a guessed point collision. Existing sweeps
are conservative boxes and do not cover rotation during a movement step.

## Input and acceptance

Construction has one shared context: RT places once, LT chooses a snap, LB/RB
rotate, D-pad up/down changes height, X opens the palette, B exits, A jumps.
Suppress mining/weapon triggers and quick-item bindings until this context ends.
Use the existing neutral-arming rules through dialogs, focus loss and reconnect;
never poll the controller a second time. On-foot keyboard B is construction;
flight-options PR38 uses B for ship land/launch in its own context. Its later
LB+RB utility chord must be reconciled explicitly when those branches integrate.

Capture actual browser state and images. A posed saved base can prove rendering
and physical interaction; it cannot prove controller placement or a local economy.
The production Gamepad route must physically land, leave the hatch, place pieces,
haul supplies, traverse the result and inspect inventory. Materials tests must
mine actual fields before processing/spending. Record imported stock, test poses,
orbital epochs and physical-device coverage honestly. Separate failed checks from
passes and retain corrections in `docs/qa/base-building/`.

Useful commands: `npm test`, `npm run build`, and `npm run test:browser -- -c`
with `scripts/build-gameplay.config.js`, `scripts/materials-gameplay.config.js`,
`scripts/base-scene.config.js` or `scripts/build-ui.config.js`. Run heavy browser
captures sequentially on native AMD ANGLE GL; coordinate explicit GPU handoffs.
Independent visual review and whole-scene budgets remain review gates.
