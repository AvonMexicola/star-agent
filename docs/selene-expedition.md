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
empty space too; only a validated rock hit yields material. Tool availability is
independent of deposit distance: equip it anywhere while exploring outside the ship.
In space, ship yaw, pitch and vertical thrust use the ship's own axes.

An automatic **NOMAD** marker shows distance to your rear ramp when you leave the
ship. Follow its edge arrow if the ship is outside your view; turn until the diamond
marks the ramp, then approach slowly. It hides after boarding and needs no binding.

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

Regional outcrops now spawn throughout Selene's resource regions, using the same
mineral data as the surface colors. Copper/ice-rich cells have dense coverage;
basalt terrain has sparser deposits. Follow the mining panel's bearing and range
to the nearest outcrop. Three regional workers stream within 400 m, alongside at
most one named provincial worker. The five survey destinations still provide
reliable starting points. All use the same tool, backpack, collision and persistent
cut system as Crescent and the small ring asteroids. The colored terrain itself
remains a heightfield; mining is available on the finite outcrops. See [resource geology](resource-geology.md).

## One inventory language

The backpack, ship, station and Crescent field cache use the same box/stack view.
Every box adds eight stack slots and 48 kg mineral capacity. Materials stack to 16 kg;
supplies have their own stack limits. The backpack accepts two box mounts. Empty
boxes are freely attachable in this prototype; crafting/purchasing boxes is later.

The persistent Backpack button shows collected mineral mass. Open a container,
select an item stack, and transfer one unit or a stack to the other open container.
Ship cargo is available aboard, the station locker when docked, and the marked
Crescent cache within four metres. The cache is a physical field storage box next
to the surface deposit, not a constructed base settlement. Constructed mainframes and crates
register with this same interface and proximity callback. Ship Cargo exposes
**Deposit all resources**, and the inventory displays saved mining skill progress.
See [the construction guide](base-building.md) for the current material loop.

Cuts, minerals, supplies, box counts and transfers persist in one transaction.
Legacy mining saves and supply manifests migrate without deleting their originals.
Storage failure retains the previous cut and cargo. Full weight, stack slots and
containers reject the operation without losing or duplicating items.

## Ring population and mining boundaries

Selene's sparse v2 ring has **14,336 bodies** across a **20 km radial width** and
**2 km vertical thickness**. Its physical outer diameter is **1,826.896 km**,
centered at 2.08 Selene radii. A staggered 2,048 × 7 × 1 cell layout with bounded
position jitter replaces the original dense v1 population. Exhaustive neighboring
cell checks, including the angular seam, measure **2,132.11 m minimum clearance**
between conservative asteroid bounds: approximately two kilometres of clear space.

Three quarters of the bodies are large geological rocks; one quarter retains the
original small, hand-mineable shapes. Six geological families each have four large
variants: **24 fractured shapes** with triplanar stone, strata, mineral and ice
materials. The families remain angular basalt, copper breccia, ice aggregates,
layered shale, pitted basalt and fractured outcrops.

The renderer retains the full deterministic descriptor population. Crossing a
streaming cell does not resample a different set of distant rocks. Individual
asteroids draw out to **80 km**, using three geometry detail bands around
**4 km, 16 km and 80 km**. Detail transitions fade across 3.2–4.8 km and 14–18 km;
the outer visibility fade runs from 64–80 km. Shared instanced geometry keeps the
scene bounded, while the distant unresolved ring aggregate supplies the orbital
view. World positions subtract the camera origin in doubles before GPU upload.

Fast flight into the belt brakes at its boundary. Local ship movement is limited
to 400 m/s inside the debris band, including boosted and inertial flight. Holding
Xbox B brakes drift and thrust while still allowing manual aiming and roll.

Aiming at a nearby small rock prioritizes it for preparation; the HUD reports
preparation, range, save capacity or a large asteroid that cannot be hand-mined.
Visible asteroid triangles determine tool occlusion and local collision, so broad
collision bounds cannot block an otherwise clear mining ray or visible gap.
Nearby small rocks promote to at most two live 32³-cell excavation domains. Their
low-detail silhouettes and mineable fields sample the same continuous shape
function. A saved edited instance stays suppressed at lower detail and restores
its cut when approached again. Edits and collection share the surface mining
transaction. Up to eight surveyed surface or space deposits can currently retain edits in browser
storage; previously saved deposits remain mineable when that limit is reached.

The larger ring boulders currently provide procedural geometry and triangle
collision. Hand mining is implemented for the small rocks across all six shape
families. Large asteroid excavation needs chunked surfaces and a larger mining
system. There is no fragment physics, orbital N-body simulation, multiplayer,
planet/cave excavation or unlimited excavation storage in this slice.

Previously edited v1 asteroids remain at their original coordinates with their
saved cuts and collected cargo. Up to eight legacy deposits can survive alongside
the v2 population, within the shared save limit. These preserved player edits are
an explicit exception to the new spacing rule; they are not relocated to fit a
new layout. Runtime IDs keep the two generations separate, and restoration does
not award more resources or rewrite the old save merely to load it.

## Sunlit ice inside the belt

`RingIce` adds world-anchored micro-ice glints only inside the ring's finite radial
and vertical bounds. At most **1,200 visual particles** occupy a **104 m radius**
around the observer, with an inner exclusion of **12 m** to keep flakes clear of
the cabin. Distance and ring-edge fades avoid a hard particle bubble. Slow motion
and phase remain attached to deterministic world cells through camera turns and
origin rebases. Facets respond to sunlight and dim in the moon's shadow.

These micro-particles add visual detail to the airless belt. They have no
collision or mining rewards and do not change the two-kilometre asteroid spacing.

## Review

The controller requirement is now part of [AGENTS.md](../AGENTS.md), with a concrete
[feature acceptance contract](controller-contract.md). Injected standard Gamepad
journeys validate real action routing; they do not substitute for a physical Xbox
hardware playtest. The local OS recognizes the Xbox Wireless Controller, while
physical button sequencing in the browser remains a user validation step.

Current v2 browser evidence must be recorded against the final integrated build;
earlier dense-ring screenshots and passing runs describe that earlier version.
Functional and renderer evidence is recorded separately from independent manager
visual approval. Fable/Claude retain integration, review, merge and deployment.

## Mining particles

The cutter now uses the shared plasma, sparks and mineral-collection particle
system on Selene outcrops and mineable ring rocks. RT / T / mouse and the touch
button retain their bindings. Controls and help offers Energy glow and Reduced
particle motion; both also work through controller focus and A. See
[mining particles](mining-particles.md) for the saved-cut and rendering contracts.

## Equipment loadout

The new [equipment system](equipment-loadout.md) adds two weapon slots, a tool,
a backpack, two ammo stacks and four quick-item stacks to the shared inventory.
K / Menu → Equipment manages gear; on-foot D-pad left cycles held slots and
right returns to the cutter. The mining particle system and regional deposits
remain connected to the same saved inventory.
