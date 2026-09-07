# Atlas Mark II interior

The interior uses game coordinates in metres: Y is up and the bow points along
-Z. `assets/atlas-mark-ii/layout.json` remains authoritative for deck heights,
room bounds, interaction points, and the moving elevator aperture.

## Spaces

- The 48 m cargo bay has a clear 8 m drive lane, replaceable side tread plates,
  seven freight racks, wall ribs, numbered pressure frames, and overhead service
  rails. Ramp control pedestals remain outside the drive lane.
- The starboard crew lift uses the complete authored opening at
  `x=4.1..6.9, z=-5.8..-2.2`. The moving platform, gates, guide channels, call
  controls, and handrails belong to the top-level builder. The fixed interior
  supplies the four surrounding deck slabs, clearance trim, and landing
  vestibule.
- The upper central corridor connects the lift lobby to a split bridge
  bulkhead. The bridge has twin seats, layered forward and side consoles,
  overhead storage, and concealed practical-light housings. Its pressure
  ceiling is 13.1 m aft and slopes to 12.6 m at the forward canopy; the two
  compact overhead rib assemblies follow that slope. Forward of z=-17.8, its
  floor also follows the pressure footprint from x +/-7.2 to x +/-4.8 at
  z=-25, so no rectangular deck corners project through the canopy cheeks.
- The aft upper deck contains three double bunks and lockers on the port side,
  a galley on starboard, and a separate hygiene bay. Doorways leave the central
  corridor clear; the crew fold desk leaves a standing aisle between the bunks
  and port partition. These rooms use the 12.75 m upper ceiling and keep their
  highest fixed light housings at or below 12.70 m.
- The galley mess counter folds against the cabinet wall and has no floor
  supports. After 0.3 m capsule expansion, the galley doorway leaves .96 m,
  the main aisle leaves 1.60 m, and the turn into hygiene leaves 0.95 m for
  capsule-centre travel.

## Walking collision

`assets/atlas-mark-ii/interior-colliders.json` lists raw deterministic AABBs for
fixed furniture and partitions. Runtime collision expands X/Z by the player
capsule radius and applies a collider only when the player's standing vertical
span overlaps its Y range. Adjacent pieces are merged where a single envelope
better represents a rack, seat, or fixture group.

The file deliberately excludes floors, shallow deck trim, ceilings, overhead
lights and rails, ramps, and every moving or fixed elevator-system component.
Those surfaces remain under `AtlasMarkIISystems` and the root builder. The
current physical route is the cargo centreline to the lift, across the port
rail opening at `x=3.5, z=-4`, then back to the upper centreline. The bridge
door is clear at `x=0`; the crew doorway crosses the port partition at
`z=2.2..3.8` and opens into the inboard bunk aisle.

The pilot seat collider stops just forward of the standing interaction point.
After the runtime's 0.3 m capsule expansion, its aft boundary is `z=-20.51`,
leaving the authoritative stand point at `z=-20.5` reachable without allowing
the player through the seat shell.

## Upper-deck construction revision

`upper_deck.py` adds explicit crew fore/aft end walls and an outboard liner;
these four room-closure meshes (including the galley forward wall) consume their
bounds directly from `interior-colliders.json`. The six bunks now have enclosed
backs and chamfered end shells. A shared crown profile supplies structural
shoulders and inset flanges in crew, corridor, mess and bridge. Crew wall/ceiling
cassettes and the aft environmental cover give those frames attached equipment.
All equipment is visual detail; no life-support or privacy-curtain controls are
implemented in this pass.

The walker has 56 fixed collider envelopes. The inboard crew wall includes the
frame feet and panel thickness. Galley access covers are recessed to retain at
least 1.60 m for capsule-centre travel. The entire crew aisle is traversable at
x=-3.1 from z=3 to z=16.2, including past the fold desk. Physical and exported-mesh
checks cover that path and both previously open crew ends. Ceiling structure
stays above the standing envelope. See `docs/qa/atlas-mark-ii/upper-deck-record.md`.
