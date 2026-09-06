# Hangar stack integration review

PR #20 combines the Nomad cockpit refinement, unlockable Atlas, twenty modular
hangars, central hub, cargo transfer and manufactured service-corner finish with
`feat/visual-fidelity` at `029cae8`. The production candidate preserves the current
playable opening, system travel, water, player menu and controller handoff.

## Integration decisions

- StationComplex shares the opening's direction and tilted orientation across
  pods, rings and hub. Controlled doors and their collision follow the opening.
  The cinematic locks its berth; render transforms use the final camera origin.
- The active ship layout is selected before starting the opening. Saved Atlas
  players spawn ahead of its full hull; its cinematic camera clears the wide
  cockpit. Fleet selection cannot interrupt the cinematic.
- Travel collision uses the fixed complex centre. Physical player position
  selects the nearest berth; the cinematic camera cannot change that selection.
- The structural slab remains below the authored deck. Modular hero and LOD
  station assets are retained. The separate station hull refinement in #22 is
  outside this candidate.

## Verification

- `npm test`: 151 tests passed, including tilted twenty-pod layout, controlled
  doors, saved Atlas spawn/boarding/lift, fixed travel keep-out centre, structural
  floor and actual GLB aisle/clearance tests.
- Production build passes with the existing bundle-size advisory.
- Initial production browser run: four tests passed. It covers Nomad's complete
  opening, rear hatch/ramp boarding, seat and launch; controller handoff and
  `intro=0`; moving-camera floor checks at scale 1 and .55; and saved Atlas opening,
  camera clearance, fleet guard and map.

Additional browser and screenshot results are recorded here when complete.

## Review status

Independent Opus visual review has not run. The attempted reviewer invocation
returned HTTP 429 with a session reset at 13:50 Europe/Amsterdam on 2026-09-06.
`QUALITY.md` requires its rubric to pass, or an explicit Cees “polish later”
decision, before merge. No review score or hardware performance approval is
claimed by these functional checks.

The operations gallery remains decorative architecture with static graphics.
Distant block storage, ceiling/wall construction, bright navigation signs and
hub furniture remain follow-up art work. This candidate does not add multiplayer
networking; twenty pods are the reusable station layout.
