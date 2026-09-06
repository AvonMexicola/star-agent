# Selene expedition systems

This branch follows the first mining prototype. It repairs controller access and
the laser's visible feedback, adds one shared container interface, introduces
character EVA, and streams a deterministic asteroid population around Selene.

## Controls and playable routes

**Xbox:** Menu opens a command menu with destinations, equipment and backpack.
D-pad/left stick selects dialog controls, A confirms and B returns. View opens the
backpack. On foot, left stick walks, right stick aims, X interacts, right D-pad
equips/holsters the laser and RT fires. Releasing the controls after a dialog,
focus change or reconnection re-arms gameplay without firing a held trigger.

**Keyboard/mouse:** I or the persistent Backpack button opens inventory. At Selene,
L lands, F leaves the chair and operates the rear hatch. Walk physically down the
ramp to the Crescent deposit. Hold T or captured left mouse to fire; R holsters and
3 equips. The on-screen mining button supports touch. The laser now beams into
empty space too; only a validated rock hit yields material.

**Ring survey:** choose Selene rings in the destination list or controller command
menu. This is an explicit quick-transit shortcut; a flight course is also available
with Shift-click. Stop the ship, leave the chair, open the hatch and walk outside.
The character uses suit thrusters in EVA and can physically return through the
open rear ramp to the pilot chair. See [EVA controls](character-eva.md) for the
translation, roll and brake bindings. Nearby small rocks use the same mining tool,
resource pouch and saved density edits as the surface deposit.

## Read resources from orbit

Selene has blue-white ice provinces, rust-red copper provinces and dark slate
basalt highlands. The orbital mesh and nearby terrain sample the same geological
field. Province boundaries persist through descent, and a surface legend identifies
the region directly below the ship.

Open **Menu** (M / Xbox Menu) and choose a named resource survey, such as Copper
Ejecta Province or Frostwall Ice Province. Land with L / Y, leave the chair and rear
hatch, then follow the mining panel to the nearby outcrop. The outcrop's visible
veins and collected minerals use that region's composition. Geological fractions
describe the deposit overall; individual cuts can strike a trace mineral seam.

Five representative provincial outcrops stream on approach, with at most one live
provincial worker. They share the same tool, backpack, collision and persistent cut
system as Crescent and the small ring asteroids. The colored terrain itself remains
a heightfield; mining is available on these outcrops. See [resource geology](resource-geology.md).

## One inventory language

The backpack, ship, station and Crescent field cache use the same box/stack view.
Every box adds eight stack slots and 12 kg mineral capacity. Minerals stack to 4 kg;
supplies have their own stack limits. The backpack accepts two box mounts. Empty
boxes are freely attachable in this prototype; crafting/purchasing boxes is later.

The persistent Backpack button shows collected mineral mass. Open a container,
select an item stack, and transfer one unit or a stack to the other open container.
Ship cargo is available aboard, the station locker when docked, and the marked
Crescent cache within four metres. The cache is a physical field storage box next
to the surface deposit, not a constructed base settlement. Future base containers
register with this same interface and proximity callback.

Cuts, minerals, supplies, box counts and transfers persist in one transaction.
Legacy mining saves and supply manifests migrate without deleting their originals.
Storage failure retains the previous cut and cargo. Full weight, stack slots and
containers reject the operation without losing or duplicating items.

## Ring population and mining boundaries

The ring has a **20,000 m radial width** and **2,000 m vertical thickness**, centered
at 2.08 Selene radii. Its versioned generator describes **20,971,520 asteroids**:
8,192 angular cells × 20 radial cells × 4 vertical cells × 32 rocks. Stable IDs
produce repeatable positions, orientations and six shape families: angular basalt,
copper breccia, ice aggregates, layered shale, pitted basalt and fractured outcrops.

The browser does not allocate twenty million objects. A distant dust aggregate
and sampled instances provide the orbital view; at most 3,200 actual descriptors
in nearby cells supply close geometry. Six shared meshes at each detail level
keep draw calls bounded. Positions are computed in doubles and subtract the camera
origin before upload. Neighboring cells wrap around the ring seam. Fast flight into the belt brakes at
its boundary; local ship movement is limited to 400 m/s inside the debris band,
including boosted and inertial flight.

Nearby small rocks promote to at most two live 32³-cell excavation domains. Their
low-detail silhouettes and mineable fields sample the same continuous shape
function. A saved edited instance stays suppressed at lower detail and restores
its cut when approached again. Edits and collection share the surface mining
transaction. Up to eight surveyed surface or space deposits can currently retain edits in browser
storage; previously saved deposits remain mineable when that limit is reached.

The larger ring boulders currently provide procedural geometry and conservative
collision. Hand mining is implemented for the small rocks across all six shape
families. Large asteroid excavation needs chunked surfaces and a larger mining
system. There is no fragment physics, orbital N-body simulation, multiplayer,
planet/cave excavation or unlimited excavation storage in this slice.

## Review

The controller requirement is now part of [AGENTS.md](../AGENTS.md), with a concrete
[feature acceptance contract](controller-contract.md). Injected standard Gamepad
journeys validate real action routing; they do not substitute for a physical Xbox
hardware playtest. The local OS recognizes the Xbox Wireless Controller, while
physical button sequencing in the browser remains a user validation step.

Functional and renderer evidence is recorded separately from independent manager
visual approval. Fable/Claude retain integration, review, merge and deployment.
