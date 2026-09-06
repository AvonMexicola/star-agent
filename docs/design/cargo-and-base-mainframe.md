# Carrying capacity and the base mainframe

Design draft · 2026-09-06 · Cees prioritizes a ship recovery marker, practical
carrying limits and base building with a central authority device inspired by a
tool cupboard. “Mainframe” is the working name. These base/cargo rules are proposed,
not an implemented claim system or an account-security feature.

## One item system, three kinds of capacity

Use mass, occupied space and stack slots together. A free slot does not make a
large engine fit in a backpack, and extra boxes cannot increase a ship's rated
payload. Item definitions need mass, packed volume, stack limit and carrying class.
Equipment and assembled building modules can require a cargo mount or two-handed
carry even when their weight is low. Show the actual limiting constraint in the UI.

| Holder | What constrains it | Expansion |
| --- | --- | --- |
| Character | Backpack slots, packed volume and carried mass; separate worn/tool mounts | Better pack or valid external box mounts, with mass/mobility tradeoffs |
| Ship | Installed crate slots, actual bay space and the hull's total rated payload | Mount compatible crates or upgrade the ship; boxes cannot enlarge the hull |
| Base | Each physically placed crate, rack, tank or machine's individual capacity | Construct more storage and the building space to contain it |

The current prototype separates mineral and supply limits: each box adds eight
slots and 12 kg mineral capacity, the pack has two mounts, and supply limits are
20 kg for the pack and 120 kg for the ship. These are existing prototype rules,
not final realistic capacities. A future migration should show a unified carried
mass total while preserving current items and attached boxes. Excess legacy loads
remain recoverable; never delete them to enforce a new capacity model.

Balance character limits around carrying a tool, expedition supplies and a useful
sample haul. Start with a comfortable load and a visible encumbered range, followed
by a pickup limit. Keep recovery movement possible. Worn equipment contributes to
movement mass without consuming backpack slots. In EVA, later mass effects should
change acceleration and propellant use, not invent walking penalties in zero gravity.

Give each ship its own cargo manifest and rated payload derived from its intended
role and actual bay dimensions. Nomad and Atlas must not silently share a generic
backpack-style capacity. Include installed cargo, passengers, fuel and equipment
in payload accounting without counting the same crate contents twice. Numerical
payloads and volume limits need a separate balance pass after measuring the hulls.

Base capacity is the sum of accessible physical containers, not a global inventory
granted by owning land. The mainframe can list storage and its locations; crafting
may use explicitly connected nearby storage. Shipping goods between the surface,
ship and station should remain meaningful. The same box UI supports every holder,
with clear transfer destinations and no invisible remote withdrawals.

## Mainframe: permission to build at a site

Place a mainframe at a valid site to establish a bounded build claim. The placer
is its owner. Begin with a fixed, clearly previewed claim radius; later tiers can
increase supported site size only after validating overlaps and building limits.
Do not promise a particular radius before testing terrain and settlement scale.

Proposed roles:

- **Owner:** manages members and roles, transfers ownership and controls the core.
- **Builder:** places and upgrades structures within the claim. Removal rights
  should be explicit; ordinary build access must not grant wholesale demolition.
- **Visitor:** can enter unlocked areas and interact only with permitted devices.

Storage access, door access, fabrication use and building rights are separate
permissions. A guest with a door code should not automatically be able to empty
crates or dismantle walls. For the first local prototype the player is the sole
owner; the data model can carry stable member IDs, but real shared permissions
require an authenticated multiplayer authority that does not yet exist here.

Placement must check the same claim ownership at preview and commit. Deny new
claims overlapping existing claims or protected station/landing areas. Pieces
belong to one claim even if their bounds touch another site's boundary. The
mainframe shows the reason a placement is denied and the required permission.

Building rights are distinct from the roadmap's proposed interference shield.
The mainframe does not automatically repel ships, stop damage or lock every door.
Do not use a local access-code UI as evidence of secure multiplayer enforcement.

For an early prototype, power loss pauses powered production but retains ownership
and access records. Mainframe destruction, upkeep, abandonment, claim transfer and
raiding need explicit rules before enabling those actions. Avoid a temporary power
failure unexpectedly transferring ownership or deleting an entire base. A minimal
first core can be indestructible until recovery and ownership transfer are designed.

## First base-building slice

User priority supersedes the earlier crafting-first sequence: finish the automatic
ship marker and useful regional deposits, then make one small base buildable.
Crafting, suit progression and caves can grow from that base/storage foundation.

Provide a finite starter base kit so testing a first base does not depend on an
unimplemented fabricator. The complete journey is:

1. Survey a site near useful minerals and preview the mainframe claim boundary.
2. Place the mainframe and register the player's local ownership.
3. Snap foundations, walls, a doorway/door, roof and access ramp into a small shelter.
4. Place a storage crate and transfer an actual mined stack into it.
5. Leave by ship, return, reload and find the same structures and crate contents.

Keep the construction kit small. Foundations must agree with canonical terrain;
visible pieces, walking collision, doors and sockets must use the same dimensions.
Reject overlapping or unsupported placements before consuming a kit item. Align
the design with the existing roadmap's modular foundations, but prove placement
and access with a few pieces before advertising a large settlement limit.

Placement on a controller needs visible snap targets, rotate/height controls,
confirm/cancel and an understandable invalid-placement reason. Use an explicit
build mode so RT placement does not also fire the mining tool. Enter it through
the shared command menu, require neutral input across transitions, and route
mainframe membership/storage screens through the existing dialog controls.

## Persistence and acceptance

Store claim ID, owner/members, mainframe identity, piece/socket transforms and
container IDs together with versioned definitions. A placement or dismantle
transaction consumes or returns inventory exactly once. Crate deletion must not
destroy contents silently. Save failure must leave the last valid structure and
inventory state intact. Streamed-out pieces retain ownership and stored contents.

The first local journey must cover controller placement through return/reload,
walkable doors/floors, slot/mass rejection, full output storage, failed writes,
overlapping claims and duplicate activation. Test later multiplayer permissions
against an actual authoritative service before calling them enforceable rights.

## Resource geography prerequisite

Cees clarified that resource biomes should spawn corresponding mineable deposits.
A colored copper patch must lead to actual copper-bearing outcrops away from the
five survey shortcuts. Start with Selene's canonical geological regions and
deterministic local deposits; later Aeon biomes can use their own resource table.
World coloring, deposit composition and collected yield must agree. Keep named
survey sites useful, preserve old edits, and distinguish mineable outcrops from
the static terrain surface. Include a way to locate the nearest local deposit.

This complements [crafting and expedition progression](progression-crafting-skills.md).
The ship marker is an immediate runtime feature; carrying rules and the mainframe
remain design work until their complete playable slice is implemented and tested.
