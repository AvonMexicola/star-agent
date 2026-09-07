# Verified development status

**Snapshot: 2026-09-07, combined runtime through `8576e99`.** This page states
capabilities and gaps; [ROADMAP](../../ROADMAP.md) states ambitions. New governance
and tooling changes do not certify the entire game as finished.

| Area | Evidence-backed development state | Material gaps |
| --- | --- | --- |
| Worlds | Seeded Aeon, Selene, Pyre, Miasma, stellar encounter and canonical rock relief integrated; actual five-world browser tour | Broad visual/performance acceptance, hydrology, caves, shared dynamic weather |
| Flight | Continuous flight, heading drive, gear limits, differentiated handling, crashes and moving cabins | Complete fleet/server parity and deeper engineering |
| Ships | Flyable Nomad 02, Kestrel and legacy 30 m Atlas | 64 m Atlas is a separate 59,443-triangle geometry studio; final materials/flight integration open |
| Station | Hangar/concourse, physical boarding, services and local opening integrated | Assigned online hangar decks/gravity integrated; exterior art ongoing; wider multi-user acceptance open |
| Mining/building | Local mining, inventory/equipment, processing and construction | Full authoritative mining/building persistence and economy not integrated |
| Multiplayer | Ten-player prototype, accounts, comms-assigned hangars, authoritative inventory/hits, remote players | Local build uses memory, no SMTP; online Nomad only; live ten-person soak not established here |
| Audio | Six local score variants plus material footsteps/weapon/cutter synthesis | Final mix/listening review, broad surface and remote audio coverage |
| Developer entry | Three ships, 14 starts, temporary saves and shared seed URLs | A dev start is explicit teleport; it does not prove continuous travel by itself |
| Contribution process | Governance/roadmap/helpers/CI under validation in the framework branch | Hosted checks and settings must be reported separately from local validation |

The combined launcher checkpoint passed 650 unit checks, 79 multiplayer checks
with one PostgreSQL-only skip, a build and focused browser journeys on Chromium
151 / AMD 860M ANGLE at 1440×900 and 390×844. The subsequent hangar/gravity merge
passed focused tests, build and a two-pilot browser journey; its multiplayer suite
has 87 passes plus one PostgreSQL skip. These are historical results for named
checkpoints, not certification of later commits. See [the launcher QA record](../qa/local-development.md)
and [the hangar/gravity record](../qa/multiplayer-hangar-physics.md).

Use [the source-head inventory](../local-development.md) and current Git refs for
newer changes. Release main was `48a8468` when this snapshot was written; repository
ancestry does not prove what a live domain currently serves. Verify its release
identifier and artifact hash before making a deployment claim.

## State vocabulary

- **Proposed:** an idea or brief, no implemented result implied.
- **In progress:** owned work, possibly incomplete or unsuitable for integration.
- **Implemented:** source exists; tests/review may remain.
- **Validated checkpoint:** named checks pass on a named commit; limitations explicit.
- **Integrated:** included in the shared development build with overlap resolved.
- **Accepted:** relevant functional, visual, input and performance criteria reviewed.
- **Deployed:** the authorized target was updated and its actual release verified.
- **Parked/superseded:** retained for history; not a current task owner or active implementation.

Do not replace these states with a single green tick. A local integration or an
independent art score is not evidence of durable server behavior or public deployment.
