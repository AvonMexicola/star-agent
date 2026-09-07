# Verified development status

**Snapshot: 2026-09-07, social/cargo/controls integrated locally at `f861f8f`.** This page states
capabilities and gaps; [ROADMAP](../../ROADMAP.md) states ambitions. New governance
and tooling changes do not certify the entire game as finished.

| Area | Evidence-backed development state | Material gaps |
| --- | --- | --- |
| Worlds | Seeded Aeon, Selene, Pyre, Miasma, stellar encounter and canonical rock relief integrated; actual five-world browser tour | Broad visual/performance acceptance, hydrology, caves, shared dynamic weather |
| Flight | Continuous flight, targeted/heading drive, gear limits, finite-thrust momentum, combat/cruise modes, differentiated handling, crashes and moving cabins | Complete fleet/server parity and deeper engineering |
| Ships | Flyable Nomad 02, Kestrel and legacy 30 m Atlas | 64 m Atlas is a separate 59,443-triangle geometry studio; final materials/flight integration open |
| Station | Hangar/concourse, physical boarding, services and local opening integrated | Opt-in exterior geometry preview integrated; final materials/art/timing and wider multi-user acceptance open |
| Mining/building | Local mining including Aeon loose stones, inventory/equipment, processing, saved supply sandbox and21-piece construction kit with facilities/pads | Full authoritative mining/building persistence and economy not integrated |
| Cargo/trade | Physical1–64SBU crates, Nomad6SBU/Atlas512SBU grids, carry/salvage, station exchange and durable player shops; controller/phone and isolated SQL evidence | Mechanical handler animation, persistent offline wrecks, dynamic NPC market and rendered online playtest |
| Characters | Expedition suit is the default local/remote model, with corrected leg rig, calibrated palms,26clips and an animation studio | Final art/motion and whole-scene performance acceptance remain open |
| Rover | Offline Atlas/Burrow start with physical lift, twin-cutter mining, saved ore/transfer and flight carriage; full injected-controller route verified | Art polish, keyboard/touch and multiplayer replication remain open |
| Multiplayer | Ten-player prototype, persistent PostgreSQL/Prisma accounts and inventory, comms-assigned hangars, authoritative hits, assigned remote suit colors | Local database survives restarts; no SMTP; online Nomad/Atlas cargo hulls, with remaining fleet parity open; live ten-person soak not established here |
| Social | Server chat, persistent mutual friends, presence, blocking and private session kicks; complete controller/keyboard/touch and ten-pilot fixture checks | Small English-first moderation rules; no direct messages, offline delivery, chat archive, reports inbox or permanent bans |
| Combat | Offline Nomad/Kestrel patrol encounters, shield/hull damage and recovery; integrated controller/browser evidence | No reward ledger, durable mission or multiplayer NPC authority; fitted S1/S2/S3 weapons are integrated |
| Audio | Six local score variants, material footsteps/weapon/cutter synthesis, thrust-responsive engines, Doppler flybys and building/creature effects | Final mix/listening review, broad surface and remote audio coverage |
| Developer entry | Three ships, paged world/habitat starts, temporary saves, shared seeds and one content-review menu | A dev start is explicit teleport; it does not prove continuous travel by itself |
| Contribution process | Governance/roadmap/helpers/CI integrated in PR52; default dev and protected shared branches verified | Newcomer onboarding/restore rehearsal and additional human maintainers remain open |

Current content review passes834unit tests,90multiplayer checks (one explicit
SQL fixture skipped), production build, repository checks and six combined browser
cases across focused runs. The later landmark material passes8focused invariants
and its actual-game shader tour. See [combined review evidence](../qa/dev-content-review.md)
for source boundaries, captures, input coverage and remaining gates. Hostile wildlife
is offline; Pyrebear controller gameplay is checked while the corrected Suloher
journey remains owner work. SBU cargo subsequently passes849units,97multiplayer checks (one existing skip),
full runtime hull clearance, actual controller/phone journeys and separate SQL/socket
persistence checks; see [cargo QA](../qa/sbu-cargo.md).

The combined social/cargo/controls update passes **849 unit tests and 117
multiplayer tests with a disposable PostgreSQL instance, zero skips**, plus the
production development build. All three source-owner social browser journeys now
pass: full controller entry/composition/friends/neutral input; keyboard/touch,
reload and private kick; ten admitted fixture pilots, 30 saved friends and bounded
phone pages/drafts. Independent UI capture review scores cohesion and
information/function 4/5. This does not establish ten human players or hardware
performance acceptance. [Combined integration evidence](../qa/social-cargo-integration.md)
records the exact source and local promotion status. Base power, newer rover
polish and new fauna/landmark refinements remain separate from this frozen update.

Historical validation follows. The combined launcher checkpoint passed 650 unit checks, 79 multiplayer checks
with one PostgreSQL-only skip, a build and focused browser journeys on Chromium
151 / AMD 860M ANGLE at 1440×900 and 390×844. The subsequent hangar/gravity merge
passed focused tests, build and a two-pilot browser journey; its multiplayer suite
has 87 passes plus one PostgreSQL skip. These are historical results for named
checkpoints, not certification of later commits. See [the launcher QA record](../qa/local-development.md)
and [the hangar/gravity record](../qa/multiplayer-hangar-physics.md). The subsequent
patrol-combat checkpoint records its combined tests/build and three browser cases
in [combat QA](../qa/space-combat.md).

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
