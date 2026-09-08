# Garage / Hush Exchange integration review

Reviewer: parent garage agent, a separate session from the delegated Hush Exchange author. This record covers source review and the final combined development checkpoint. All 159 combined registered unit files pass on runtime `73a7be8`; final browser captures are pending; this is not a final art or performance acceptance score.

## Scope and findings

The shared input hooks must expose both the Garage console and the Tower isolator. The pirate interaction wrapper must be installed after the final garage/build base action assignment. Normal settlements remain visible in online play under the checked freight contract; garage vehicle services and Hush Exchange remain solo activities.

Parent review found and the pirate author corrected these issues in the isolated candidate:

- World claims were initially passed through player-save validation, leaving rendered buildings without their intended collision. The author adopted the existing settlement world-authority initialization pattern and added actual pad, wall, doorway and continuous ramp checks.
- Landed pilots and ship-cabin occupants must remain valid aircraft targets. Burrow also uses walk mode and insideShip, so the shared ship occupancy predicate explicitly excludes its roverOccupied flag.
- Static instancing must compare effective material values and texture identities, preserving different materials even when their names match. Doors, terminals, lights and transparent meshes remain independent.
- Locked trade projections must direct the player to the tower isolator. The pirate docking adapter must accept the checked freight orientation/quaternion pose contract.

The parent independently inspected the rendered tower, yard, generator and exchange. A black rectangle over the tripod remained after moving its emitter. Both sessions then independently found exactly six zero-length normals in the floodlight and six in the workbench; generator and crate normals are usable. Candidate `2c2f2fb` repairs those twelve derivative normal entries with exact provenance while preserving source originals, positions, indices, UVs and all other normal bytes. Rendered confirmation remains pending.

## Validation and integration

The existing garage checkpoint has five passing browser cases and 156 passing registered unit files. Its complete controller journey is separate from the planned combined-hook fixture. The latter will open both services through their shared controller action and retain the reviewer's own yard and overview captures; fixture placement does not establish physical navigation.

Private runtime `73a7be8` consumes checked shared `f1ef821`, garage review `09011e7`, and pirate candidate `2c2f2fb`. The only merge conflicts were the package test list and two main initialization/diagnostic blocks. All test entries, both disposal/diagnostic fields, the online normal-settlement predicate, and the final pirate-after-garage interaction wrapping are preserved. [Combined check receipt](combined-validation.json). Pending ground pirate NPC and Sentry work belongs to other owners and has not been copied. Shared local integration will preserve the dirty handoff journal and existing preview/API/database services. No public deployment is authorized by this checkpoint.
