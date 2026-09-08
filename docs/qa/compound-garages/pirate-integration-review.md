# Garage / Hush Exchange integration review

Reviewer: parent garage agent, a separate session from the delegated Hush Exchange author. This record covers source review and the final combined development checkpoint. Final captures and combined validation are pending; this is not a final art or performance acceptance score.

## Scope and findings

The shared input hooks must expose both the Garage console and the Tower isolator. The pirate interaction wrapper must be installed after the final garage/build base action assignment. Normal settlements remain visible in online play under the checked freight contract; garage vehicle services and Hush Exchange remain solo activities.

Parent review found and the pirate author corrected these issues in the isolated candidate:

- World claims were initially passed through player-save validation, leaving rendered buildings without their intended collision. The author adopted the existing settlement world-authority initialization pattern and added actual pad, wall, doorway and continuous ramp checks.
- Landed pilots and ship-cabin occupants must remain valid aircraft targets. Burrow also uses walk mode and insideShip, so the shared ship occupancy predicate explicitly excludes its roverOccupied flag.
- Static instancing must compare effective material values and texture identities, preserving different materials even when their names match. Doors, terminals, lights and transparent meshes remain independent.
- Locked trade projections must direct the player to the tower isolator. The pirate docking adapter must accept the checked freight orientation/quaternion pose contract.

The parent independently inspected the rendered tower, yard, generator and exchange. A black rectangle over the tripod remained after moving its emitter. Both sessions then independently found exactly six zero-length normals in the floodlight and six in the workbench; generator and crate normals are usable. The author is repairing those twelve derivative normal entries with exact provenance while preserving source originals. Rendered confirmation remains pending.

## Validation and integration

The existing garage checkpoint has five passing browser cases and 156 passing registered unit files. Its complete controller journey is separate from the planned combined-hook fixture. The latter will open both services through their shared controller action and retain the reviewer's own yard and overview captures; fixture placement does not establish physical navigation.

The parent has consumed checked freight and handheld-tool commits. Pending ground pirate NPC and Sentry work belongs to other owners and has not been copied. Shared local integration will preserve the dirty handoff journal and existing preview/API/database services. No public deployment is authorized by this checkpoint.
