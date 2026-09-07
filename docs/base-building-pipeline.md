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

## Starter allocation and nearby ship cargo

`src/mining/starter-construction.js` owns the version-1 finite ledger: concrete80,
metal-stock16, conductor3, glass4 kg. Missing `state.starterConstruction` migrates
to `{version:1,claimed:false}`. `claimStarterConstruction()` saves the entire
103 kg allocation and its receipt together; no partial grant, repeated reload
award or XP. Preserve existing cargo/cuts/equipment. Full mass or slots leaves it
pending for the shared inventory's controller-focusable claim button.

Startup claims only after `BuildSystem` validates and restores the base extension,
and only when neither system is blocked. Do not move this write into the store
constructor: it must not rewrite malformed base saves. The manual retry shares
the blocked-build guard. Test fixtures importing finite stock must explicitly
record `starterConstruction:{version:1,claimed:true}` if no grant is intended.

`src/inventory/ship-access.js` is the shared access policy: aboard/seated, or a
walk/EVA actor within 50 m of the current actual ship origin in three-dimensional
double-precision world space. Missing/invalid origins and crashed mode fail closed.
Use it for every UI action and build payment, independent of navigation.enabled
(dialogs pause navigation). Recheck access at activation, refresh open-dialog
availability without requiring it to close, and show live range in both inventory
and placement. Construction source order is pack, opt-in local buffer, nearby
ship. Field recipes continue to use only the backpack. Physical hatch boarding,
station access and other base container proximity rules remain their own contracts.

## Materials and new worlds

Legacy `pack` and `ship` arrays still mean basalt/copper/ice. Six processed material
IDs live under `materials.pack/ship`; remote inventories use item maps. Preserve
existing equipment, ammunition, shop stock, supplies and density edits when adding
resources. All current construction products use kg, finite 16 kg stacks, eight
slots and 48 kg mineral mass per attached box. Do not silently change these units
or present fictional field recipes as realistic chemical mass fractions. New
mining recovers 1 kg concentrate per cubic metre of removed rock, replacing the
old 12 kg conversion; existing saved cargo is not rescaled. Typical measured
whole rocks yield about 8–14 kg. Keep capacity tests based on complete generated
rocks as well as individual cuts, with starter supplies occupying their real slots.

Mining progression lives in `state.progression.mining.xp`. Award it only in the
same successful `commitRock` transaction as accepted cargo and density edits.
Missing old progression starts at zero; malformed records must retain the save
and pause writes. No XP for rejected capacity, stale revisions, misses, crafting
or moving resources between containers. Levels currently have no yield multiplier.
The shared inventory displays `miningSkill` and exposes `store.stow()` as the
physical ship's **Deposit all resources** action. It is one all-or-nothing write
across all material types, preserving equipment, supplies and earned skill.

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
two-leaf pocket doors leave module corners clear. `DoorMotion` owns the transient
0.5 s smoothstep fraction; the saved boolean remains the target. Walker and ray
queries must use that same live fraction. Closing sweeps the leaf between frames
and pauses before the standing capsule; a failed save cannot change its target.

GLB `COLOR_0` carries concrete casting variation and localized wear. Preserve
vertex colours when attaching shared albedo/bump maps. Visual rear-stair recesses
and layered trim stay within measured bounds; ray tests prevent coplanar plates
and markers. Do not apply uniform dirt to every material family.

`visuals.js` makes private per-instance material clones with a shared coverage
uniform, retaining immutable cached geometry/textures and native log depth. Fade
claims over 500–600 m, then hide them; do not mutate a template's opacity. Authored
previews use the same GLBs with tinted mapped materials and owned edge geometry.
A generation token rejects stale async preview results. Dispose only private
materials/edges/display resources, never cached mesh geometry or finish textures.

Four pooled nearby service lights illuminate authored door/mainframe fixtures;
keep daytime spill for lunar shadows and fade selection by distance. Work-light
intensity is darkness-dependent. This is local module lighting, not the planned
base power/life-support system. The recipe list owns scrolling while controls
stay visible; `data-controller-scroll` tells the shared router where right-stick
scroll goes, with the native dialog as fallback for other inventories.

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
`scripts/base-scene.config.js`, `scripts/build-ui.config.js` or
`scripts/ship-radius-gameplay.config.js`. Run heavy browser
captures sequentially on native AMD ANGLE GL; coordinate explicit GPU handoffs.
Independent visual review and whole-scene budgets remain review gates.


## Polish delivery, 2026-09-07

Eight-piece export and physical dimensions are verified; polished assets total
21,228 triangles / 1,869,528 GLB bytes, with two shared 256² WebP finish maps.
Mainframe spill uses local `[0,1.50,-.56]`, base intensity 1.25; preserve its reduced
brightness when integrating. Long base-interaction copy wraps on phone widths.
The independent Opus polish review scores 4.0/5 and rechecks phone wrapping.
Read `docs/qa/base-building/polish-production.md` for original report dispositions,
536-unit / five-UI-test passes, production door/ghost/fade evidence and studio
captures. Whole-scene performance and a fresh complete controller construction
journey remain integration gates; physical Xbox is untested. PR41 stays draft.


## Supplied sandbox entry

`?sandbox=build` selects a fully separate prefixed storage adapter before Fleet,
ShipInventory or MiningStore construction. `src/build/sandbox.js` creates one
canonical Selene mainframe / 3×3 foundation pad and 4,608 kg of stock atomically.
Twelve valid eight-box bank containers supply construction through BuildSystem's
optional `supplySources` callback; ordinary mode receives none. Never widen normal
cargo access or bypass placement costs/collision to implement this mode. Reload
keeps stock spent; explicit refill resets only dedicated bank containers. Arrival
searches clear terrain outside saved pieces. Command-menu entry/exit, palette
supplies and refill share the existing controller/native-button router.

Controller production entry → wall placement/debit → refill/inventory → reload →
regular-save return passes. See `docs/qa/base-building/sandbox.md`, including host
Chromium temporary-storage failure history and the separate-save checks. Keep
sandbox stock client-local when integrating server-authoritative multiplayer.


## Radial build selection

`src/build/radial-selection.js` owns stable clockwise ordering, deadzone and angular
hysteresis. `radial.js` renders native buttons with original SVG icons and slices.
BuildUI supplies current piece, exact recipe cost formatting and the existing
choose callback. GamepadInput's `ui.stickX/stickY` deliberately exclude D-pad;
ControllerUI accepts an optional native dialog spatial focus target, retaining
shared confirm/back/scroll and neutral-arming behavior. Never poll again or place
on release. D-pad can reach recipes/supplies/close. Source and browser evidence:
`docs/qa/base-building/radial.md`; physical-device acceptance remains separate.
