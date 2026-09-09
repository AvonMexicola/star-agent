# Verified development status

**Latest local checkpoint: 2026-09-09, Burrow Sentry at `bdf053c`, including checked Atlas recovery and planet rotation.** Named
older checkpoints below retain their own evidence scope. This page states
capabilities and gaps; [ROADMAP](../../ROADMAP.md) states ambitions. New governance
and tooling changes do not certify the entire game as finished.

| Area | Evidence-backed development state | Material gaps |
| --- | --- | --- |
| Worlds | Seeded Aeon, Selene, Pyre, Miasma, stellar encounter and canonical rock relief integrated; actual five-world browser tour | Broad visual/performance acceptance, hydrology, caves, shared dynamic weather |
| Planetary rotation | Locally integrated `8f819ac`: all four landable worlds spin on 60-minute days, with stable canonical terrain/building/parked-hull anchors, changing sunlight and shared protocol 9 time; controller ground/drive and two-client clock checks pass | Fixed body centres and existing assisted/EVA semantics; physical devices, independent domain/art and release performance acceptance pending. [Evidence](../qa/planet-rotation/README.md) |
| Flight | Continuous flight, targeted/heading drive, gear limits, finite-thrust momentum, combat/cruise modes, differentiated handling, crashes and moving cabins | Complete fleet/server parity and deeper engineering |
| Ships | Flyable Nomad 02, Kestrel, current 64 m Atlas, 18 m Stratum miner and 24 m Gannet rover transport; physical boarding, mining and loaded-flight journeys pass | Medium hulls are solo/development only; broad fleet performance, final Atlas materials and Kestrel ladder animation remain open |
| Station | Authored exterior and enlarged 20-berth station are default; physical community hub, finite market, defense and animated shopkeepers integrated | Final exterior materials, broad firing arcs and wider multi-user acceptance remain open |
| Mining/building | Local mining including Aeon loose stones, inventory/equipment, processing, saved supply sandbox, construction/facility/pad kit, six roof skins and powered ceiling lights | Full authoritative mining/building persistence and economy not integrated |
| Cargo/trade | Physical1–64SBU crates, Nomad6SBU/Atlas512SBU grids, carry/salvage, station exchange, durable player shops, constructed-base stock offers and public sales beacons; controller/phone and isolated SQL evidence | Mechanical handler animation, ambient persistent wrecks, dynamic NPC market and rendered online playtest |
| Settlements | Four construction-kit settlements integrated locally at `32966e3`, with map locations, physical large pads and independent finite solo exchanges; local stock and role-based delivery needs integrated at `dc578d8`, with terminal/map shortages and complete controller delivery/departure validation | Transport adds canonical shared settlement authority with actual-room/SQL checks; rendered online settlement gameplay, resident NPCs, physical controller and independent visual/performance review remain open; [evidence and limits](../qa/trade-settlements/README.md) |
| Faction finishes / pirate habitats | Locally integrated `e25c7d0`: eight saved building paints, rigid faction/safety prints, corporate identities at four exchanges, enclosed Crimson Hush/Selene and Veil/Miasma markets with interlocked doors and reduced turret perimeter; full controller/native journeys and served checks pass | Solo development checkpoint; no pressure simulation or ground pirate NPC combat. Physical devices, formal independent art and performance acceptance remain pending; [evidence](../qa/faction-building-finishes/README.md) |
| Transport | Twelve personal sealed-crate routes across four worlds; accept→physical pickup/load→continuous interplanetary flight→terminal deposit/payment; complete solo controller and keyboard/native-touch journeys pass, with two-account/SQL isolation | Locally integrated at `f294a98`; rendered two-client full flight, other hull/route journeys, physical controller and independent review remain pending; [evidence](../qa/transport-missions/README.md) |
| Deep-space recovery | Locally integrated `d3cbde3`: three disabled Atlas contracts with open ramps/alarm lights, one named2SBU objective, optional bonus loot, actual tractor recovery and terminal payment; full controller haul/delivery/sale/relaunch, guarded combat and native-phone UI pass | Solo only; full guarded delivery, other hulls, physical devices and independent art/performance review remain open. [Evidence](../qa/deep-space-recovery/README.md) |
| Characters | Expedition suit is the default local/remote model, with corrected leg rig, calibrated palms,26clips and an animation studio | Final art/motion and whole-scene performance acceptance remain open |
| Rover | Ground Selene and Atlas/Burrow Aeon meadow starts, real aft-ramp carriage and clear windscreen; full ground controller and Gannet carrier keyboard/controller/native-touch routes pass; Cees manually tested Atlas loading/flight | Broader terrain and performance acceptance, physical-device testing and multiplayer replication remain open |
| Burrow Sentry | Locally integrated `bdf053c`: separate two-seat rear laser variant, physical boarding, authoritative crew priority/pilot fallback, hull damage and Atlas carriage; complete solo, keyboard/native touch and two-client control/inventory/return journeys verified | Session vehicles; no purchase fleet, pressure simulation or full ship-gun/ram parity. Earlier intermittent socket rejection remains unexplained and did not recur in final evidence. Physical hardware, formal art and performance acceptance remain open. [Evidence](../qa/burrow-sentry/README.md) |
| Multiplayer | Ten-player prototype, persistent PostgreSQL/Prisma accounts and inventory, comms-assigned hangars, authoritative hits, assigned remote suit colors | Local database survives restarts; no SMTP; online Nomad/Atlas cargo hulls, with remaining fleet parity open; live ten-person soak not established here |
| Social | Server chat, persistent mutual friends, presence, blocking and private session kicks; complete controller/keyboard/touch and ten-pilot fixture checks | Small English-first moderation rules; no direct messages, offline delivery, chat archive, reports inbox or permanent bans |
| Combat | Fifteen offline regional Nomad/Kestrel sorties across planets, moons and belt; Easy/Standard/Hard, reinforcement waves, shield/hull damage, recovery and session reports; five full regional controller routes pass | Regional patrols have no credits/loot or durable contracts; no multiplayer NPC authority; physical-device testing and independent human difficulty tuning remain pending |
| Wildlife | Offline Pyrebear/Suloher encounters and medical recovery; seeded Aeon Tidebacks defend after injury and peaceful Mallow grazers retreat; deer rig viewer installed | No online animal replication or persistence; deer world spawning, complete native-touch encounter and final motion/performance acceptance remain open |
| Audio | Six local score variants, material footsteps/weapon/cutter synthesis, thrust-responsive engines, Doppler flybys and building/creature effects | Final mix/listening review, broad surface and remote audio coverage |
| Developer entry | Five ships, ground rover and Atlas meadow presets, paged world/habitat starts, temporary saves, shared seeds and one content-review menu | A dev start is explicit teleport; it does not prove continuous travel by itself |
| Contribution process | Governance/roadmap/helpers/CI integrated in PR52; default dev and protected shared branches verified | Newcomer onboarding/restore rehearsal and additional human maintainers remain open |

The medium checkpoint passes **1,113/1,113 normal tests**, both build modes,
independent source review, and final studio reviews **4.12 / 4.10** for Stratum /
Gannet. All six full input routes pass on their recorded versions. Current
Stratum keyboard and Gannet controller routes close access, collection and
inventory-display findings; scoped game reviews pass **4.02 / 4.04**. The Stratum
completed browser PASS has a retained outer-wrapper143 discrepancy. These are
injected/native browser inputs and practice-memory commits, not physical-device,
reload-persistence or FPS certification. Exact source and served model hashes
match the shared preview; the same API/PostgreSQL/dev processes remain running.
See [medium integration evidence](../qa/medium-ships/integration.md).

The preceding fleet combination passes **1,016 normal tests** and the prior combined
HUB checkpoint passes **193 multiplayer/database checks with real disposable SQL,
zero skips**. The later ground-ramp union passes 136 physical and 51 server checks;
the final meadow preset passes its own focused checks. Three engine/audio cases,
Burrow ground mining/exit/reboard, full Atlas station boarding/departure and actual
solo/authenticated opening pass with zero page/console errors. Cees supplied the
manual loaded-rover/Atlas flight acceptance. The local client/API refresh preserves
the database and adds migration 003. [Fleet integration evidence](../qa/fleet-engine-integration.md)
records source boundaries and unperformed release-level acceptance. Base sites
have account-scoped solo cloud saves, not shared multiplayer construction.

The following named checkpoints are historical evidence, not current fleet dimensions.

The historical content review passes834unit tests,90multiplayer checks (one explicit
SQL fixture skipped), production build, repository checks and six combined browser
cases across focused runs. The later landmark material passes8focused invariants
and its actual-game shader tour. See [combined review evidence](../qa/dev-content-review.md)
for source boundaries, captures, input coverage and remaining gates. Hostile wildlife
is offline; the Pyrebear and corrected Suloher controller journeys now pass,
including Suloher medical recovery. SBU cargo subsequently passes849units,97multiplayer checks (one existing skip),
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
records that exact source and local promotion status. Sparse landmark refinement
subsequently integrated at `6e548ad`/`4706d62`; its actual shader images and limited
measured gains are recorded in [landmark QA](../qa/landmark-restraint/README.md).

The latest wildlife combination passes **869 unit tests**, the production build
and both physical Tideback/Mallow controller encounters in 5.6 minutes with no
page/console errors. Four actual-game images were inspected. Exact live GLB hashes
and served modules were verified after local promotion `c4f6b5b`. This client-only
update preserves the existing API and database without a service restart. See
[wildlife integration evidence](../qa/wildlife-integration.md). Base power, newer
rover polish, handheld tractor, community hub and performance work were separate
from that historical checkpoint and are included in the latest local integration.

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
newer changes. An earlier snapshot recorded release main `48a8468`; repository
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


Tractor follow-up (SA-CARGO-002): checked runtime70fcaad is now integrated with
the handheld Blender pass in local runtime `638a5e4`. Physical1–64SBU tractor
movement, persisted detached crates/leases and compatible grid securing replace
the instant handler. Complete Nomad controller and Atlas keyboard/native-touch
journeys pass; see [tractor QA](../qa/cargo-tractor.md). No physical-device or
independent final art acceptance is claimed.

Handheld pass (SA-ART-001) is also integrated in `638a5e4`, preserving the live
wildlife/player-performance source. The tractor has a separate authored model;
all four tools have UV/PBR textures, contact shading and retained grip/muzzle
calibration. Four final Chromium cases pass on equivalent runtime `a50c060`.
The refreshed local client/API use protocol4 and the same persistent database,
with no schema migration. [Builder QA and comparison](../qa/handheld-tools.md)
record asset budgets, failed checks/corrections and acceptance limits.


Projected terminals (SA-UI-004) add nearby welcome projections and a native HTML
exchange dashboard over the existing trade handlers. Stock, needs, cargo and owner
offers retain their existing authority. See [terminal QA](../qa/projected-terminals/README.md)
for checked source, browser evidence, local integration and acceptance limits.
