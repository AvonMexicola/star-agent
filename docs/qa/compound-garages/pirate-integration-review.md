# Garage / Hush Exchange integration review

Reviewer: parent garage agent, a separate session from the delegated Hush Exchange author. This record covers source review and the final combined development checkpoint. All 159 combined registered unit files pass on runtime `73a7be8`; the combined browser fixture passed in 2.0 minutes on clean `16c73a5`; this is not a final art or performance acceptance score.

## Scope and findings

The shared input hooks must expose both the Garage console and the Tower isolator. The pirate interaction wrapper must be installed after the final garage/build base action assignment. Normal settlements remain visible in online play under the checked freight contract; garage vehicle services and Hush Exchange remain solo activities.

Parent review found and the pirate author corrected these issues in the isolated candidate:

- World claims were initially passed through player-save validation, leaving rendered buildings without their intended collision. The author adopted the existing settlement world-authority initialization pattern and added actual pad, wall, doorway and continuous ramp checks.
- Landed pilots and ship-cabin occupants must remain valid aircraft targets. Burrow also uses walk mode and insideShip, so the shared ship occupancy predicate explicitly excludes its roverOccupied flag.
- Static instancing must compare effective material values and texture identities, preserving different materials even when their names match. Doors, terminals, lights and transparent meshes remain independent.
- Locked trade projections must direct the player to the tower isolator. The pirate docking adapter must accept the checked freight orientation/quaternion pose contract.

The parent independently inspected the rendered tower, yard, generator and exchange. A black rectangle over the tripod remained after moving its emitter. Both sessions then independently found exactly six zero-length normals in the floodlight and six in the workbench; generator and crate normals are usable. Candidate `2c2f2fb` repairs those twelve derivative normal entries with exact provenance while preserving source originals, positions, indices, UVs and all other normal bytes. The parent’s own [yard capture](combined-pirate-yard.png) confirms the black rectangle is removed; the tripod stem and workbench now render cleanly. The [overview](combined-pirate-overview.png) retains the tower, compound walls, cover, lighting and supported approach. The author’s reversible HDR comparison remains separate.

## Validation and integration

The existing garage checkpoint has five passing browser cases and 156 passing registered unit files. Its complete controller journey is separate from the planned combined-hook fixture. The combined fixture opened both services through the shared controller action, activated the isolator and returned to play. It retained the reviewer’s own yard and overview captures. Fixture placement does not establish physical navigation.

Private runtime `73a7be8` consumes checked shared `f1ef821`, garage review `09011e7`, and pirate candidate `2c2f2fb`. The only merge conflicts were the package test list and two main initialization/diagnostic blocks. All test entries, both disposal/diagnostic fields, the online normal-settlement predicate, and the final pirate-after-garage interaction wrapping are preserved. [Combined check receipt](combined-validation.json). Pending ground pirate NPC and Sentry work belongs to other owners and has not been copied. Combined production build and browser checks pass with no application errors or warnings. The scene snapshot reports 738 draws and 2.14M triangles at 1440×900 / scale 1.0 on Chromium 151.0.7922.173, ANGLE AMD Radeon 860M. This is not a frame-time benchmark, and final performance acceptance remains pending. The delegated complete controller route and native phone return step are still pending.

Shared local integration will preserve the dirty handoff journal and existing preview/API/database services. No public deployment is authorized by this checkpoint.
