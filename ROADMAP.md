# Star Agent — a universe worth sharing

**Planning revision: 2026-09-07.** Cees owns product direction; the product lead
maintains this plan; the integration steward maintains verified delivery status.
This is an ambitious destination with staged exit criteria, not a claim that the
features below already exist or a promise of delivery dates.

Star Agent should let a small group leave a busy orbital port, crew a substantial
ship, cross a star system without a loading screen, discover a distinctive place,
build something that persists and return to a world changed by other players.
Human creators and their agents should be able to contribute ships, worlds,
stories and systems without needing to rewrite the engine.

## Product pillars

1. **One continuous journey.** Walking, boarding, flight, orbit, interplanetary
   travel and disembarkation remain physically connected. Optional developer
   transit is a testing tool, not a replacement for navigation.
2. **Places with identity.** Planetary geology, water, weather, vegetation, sound
   and authored landmarks make destinations recognizable and worth exploring.
   Star Citizen is the visual ambition; original assets and measured browser
   budgets determine each implementation.
3. **Ships as places and machines.** Distinct handling, functional interiors,
   cargo, engineering, crew roles, repair and understandable component systems.
4. **A shared, durable world.** Server-owned consequences, consistent seeds and
   versions, meaningful inventories and reliable recovery from disconnects.
5. **A playable economy.** Exploration, mining, industry, hauling, rescue and
   combat connect into loops rather than isolated demonstrations.
6. **An open contribution process.** Small reviewable changes, reproducible
   assets, independent evidence and a clear route from experiment to release.
7. **A browser game people can run.** Scalable settings, bounded downloads,
   accessible controls and an offline core; no required hosted AI API for play.

## What exists at this planning checkpoint

The combined development branch has seeded Aeon/Selene/Pyre/Miasma and a visitable
star, continuous flight/heading drive, local mining/EVA/construction, three flyable
hulls, a station/concourse, optional ten-player accounts/hangar/combat code,
surface effects and local music/SFX. It has a ship/location test launcher.

This is **integration progress**, not completion of the milestones below. Online
construction, full fleet parity, persistent economic loops, broad hardware quality
acceptance and the refreshed Atlas's flight integration remain open. The 64 m
Atlas is a geometry studio checkpoint. Read [verified status](docs/development/status.md)
and [exact integrated heads](docs/local-development.md) before choosing work.

## Milestones and dependencies

| ID | Milestone | Starting status | Depends on |
| --- | --- | --- | --- |
| M0 | A dependable contributor and integration foundation | In progress | — |
| M1 | Ten people, one complete shared expedition | Prototype partly integrated | M0 |
| M2 | A fleet worth crewing | Partial hulls/systems; engineering planned | M1 |
| M3 | Planetary worlds with depth and identity | Planet prototypes integrated; quality work open | M0; M1 for persistent changes |
| M4 | Settlements and an industrial frontier | Offline construction prototype | M1, M2, M3 |
| M5 | A living system of trade, missions and conflict | Small isolated foundations | M1, M2, M4 |
| M6 | Connected systems and measured population growth | Research | M1, M5 |
| M7 | A creator platform and agent-accessible universe | Research | M0, M4, M5; M6 for cross-system content |

These are dependency gates, not a strict waterfall. Planet art, fleet production
and tooling can proceed in parallel in bounded lanes. Keep only a few active
integration risks at once; finish a complete route before opening more unfinished systems.

### M0 — A dependable contributor and integration foundation

**Player outcome:** the shared test build starts predictably and contributors can
identify which version they are testing.

- One integration steward, an active-claim register, short feature branches and
  a separate release line. Replace stale default-branch guidance deliberately.
- A contributor handbook, architecture map, task/review/handoff templates and
  source/asset provenance that a newcomer can actually follow.
- CI for repository contracts, unit/build checks, real database tests and browser
  startup. A tested browser command is distinct from a laptop GPU benchmark.
- A fixed scene/input regression set; budgets, baseline evidence and exceptions
  remain reviewable at an exact commit.
- Versioned saves/protocol/generators, repeatable local setup, recoverable releases
  and sanitized diagnostic reports.

**Exit:** a new invitee follows the documented setup, delivers one scoped change,
an independent person reproduces it, the steward integrates it without losing
another feature, and a release rehearsal restores the previous compatible build.
Record remaining GitHub protection/default-branch setup explicitly.

### M1 — Ten people, one complete shared expedition

**Player outcome:** ten pilots can sign in, meet at a station, acquire distinct
hangars, depart, explore, gather something and return with their possessions.

- Callsign/email registration and login, password recovery through configured
  delivery, logout/revocation and reconnect handling. No real-name requirement.
- Ten immutable suit colors for the first cohort; visible remote rigs carry their
  equipped tools correctly. Player and ship identities survive reconnects.
- Server-assigned hangars through comms, clear landing markers, door interlocks,
  safe departure and reliable interior/deck support.
- Authoritative movement boundaries, hit detection, damage, inventory transfers,
  drop cleanup and interaction reach. No client-granted items or health.
- Client interpolation/prediction that remains usable under measured latency,
  packet delay and reconnects. Generator/protocol mismatch has a useful failure.
- One complete persistent resource/cargo journey, rather than presenting all
  offline UI as already networked.

**Exit:** a recorded ten-client scenario covers join, hangar contention, departure,
surface visit, transfer, return and reconnect. A two-hour soak target includes
bounded tick delay, memory and network growth; the test report defines hardware,
load and thresholds before the run. The eleventh join fails cleanly. A server
restart preserves verified durable state; database failure does not duplicate it.
SMTP delivery and backup restore are tested by the authorized operator separately.

### M2 — A fleet worth crewing

**Player outcome:** a nimble interceptor, everyday utility ship and heavy freighter
feel different and support their intended jobs; crew can act aboard a moving ship.

- Finish Kestrel, Nomad and Atlas against one manufacturer language and physical
  control standard. Preserve distinct turn/acceleration behavior without excessive
  top-speed gaps. Gear-down maneuvering remains safe and clearly prompted.
- Integrate the 64 m Atlas only with matching flight bounds, collision, front/aft
  ramps, top-deck lift, crew areas, bridge, cargo and fully tested boarding.
- Common S1/S2/S3 fitting contracts, explicit installed equipment, authored pivots,
  power/data links and replaceable components. Empty mounts do not pretend to fire.
- Four real MFDs, navigation/radar/comms, power distribution and component status.
  Use live state, readable hierarchy and meaningful update budgets.
- Multi-crew seats, ownership/permissions, local movement frames, turrets, engineering
  stations and recovery when the pilot disconnects or leaves the seat.
- Repair, damage isolation, heat, fuel and eventually pressure/life support, added
  as understandable playable systems with clear failure/recovery behavior.

**Exit:** crew board, load, depart, change stations while underway, solve an
engineering fault, land and unload using physical routes and supported inputs.
Hull/gear/cargo clearances and server authority pass on the same exported asset.
A finished example ship establishes an accepted asset baseline before fleet expansion.

### M3 — Planetary worlds with depth and identity

**Player outcome:** the view remains convincing from orbit to boots, and each
world offers recognizable, repeatable places rather than endless identical scatter.

- Ocean shading without altitude-dependent tiling: multiscale waves, glancing
  reflections, depth/shore transitions, foam and weather interaction. Spectral
  simulation is an experiment until it meets browser budgets and fallback needs.
- Coherent biome coverage and terrain materials through every LOD; distant forest
  continuity, stable instanced vegetation, contact response and controlled density.
- Strong geological regions, strata, erosion-shaped terrain, river/lake basins,
  coasts, ice fields and navigable landmarks. Hydrology must agree with collision.
- Distinct Pyre volcanism/ash, Miasma atmosphere/mineral basins, Selene crater/ice
  geology and stellar hazards. Preserve their versioned procedural identities.
- Day/night and weather states shared by the server, meaningful visibility, sound
  and shelter. Seasons and orbital motion require explicit simulation decisions.
- Caves and local voxel excavation that join the height-field surface without
  competing floors, holes or divergent client/server edits.
- A profiler-driven rendering ladder: better streaming/LOD, texture residency,
  occlusion and GPU work before any backend migration. WebGPU/WASM are evaluated
  with reference parity and measured benefit, while preserving a supported fallback.

**Exit:** repeat the same seeded approach/descent/walk route on multiple machines
and across reloads; geology, resources and collisions agree. Fixed orbit/coast/
forest/highland/polar viewpoints and each other body pass visual and performance
review at declared settings. A moving LOD tour shows continuity, not just attractive stills.

### M4 — Settlements and an industrial frontier

**Player outcome:** players turn an expedition into a useful, persistent home or
industrial site that others can visit, supply and help maintain.

- Server-validated claims, snap/placement, terrain support, permissions and durable
  edits; an explicit migration from current local-only constructions.
- Power generation/storage/distribution, mainframes, processing queues, refinery
  and fabrication machines. Offline progress and cancellation have defined rules.
- Physical cargo boxes, loading equipment, inventories and logistics routes;
  meaningful capacity, mass and throughput rather than duplicated item counters.
- Tiered materials and infrastructure: shelter, workshop, landing pad, storage,
  sensors, utilities and eventually larger outposts/stations.
- Depletion, restoration and cleanup policies with bounded database/mesh growth.
  Raiding, shields and ownership disputes need agreed game rules before implementation.
- A settlement stress target of 1,000 placed pieces, promoted only after measured
  streaming, collision, rendering and replication tests demonstrate it is viable.

**Exit:** two players gather materials, refine, build, power and use a base, reload
and reconnect, and see identical state. Unauthorized edits and repeated/reordered
transactions cannot grant items. Backups restore a representative inhabited base.

### M5 — A living system of trade, missions and conflict

**Player outcome:** exploration, industry and travel have reasons and consequences.

- Server-owned currency and double-entry transaction records, atomic player trades,
  market orders, contracts, escrow and recovery from partial failures.
- Supply/demand experiments tied to actual production and consumption, with tools
  to detect inflation, duplication and inaccessible starter progression.
- Survey, delivery, escort, rescue, salvage, repair, prospecting and bounty missions;
  cooperative rewards and failure conditions that survive disconnects.
- NPC traffic, patrols and encounters with bounded simulation and visible intent.
  Ground/ship combat, shields, countermeasures and component damage use shared authority.
- Factions, reputation and restricted areas; clear consequences for aggression.
  Accessibility, new-player safety and community moderation are design requirements.
- Exploration discoveries, derelicts, authored narrative locations and reusable
  encounter tools, with original lore and documented content provenance.

**Exit:** play a complete earn/spend/repair/progress loop with multiple people.
Transactions reconcile, adversarial tests find no known duplication route, and
several roles remain rewarding without combat. Balance comes from playtests and
measured economy data, not a roadmap's untested time-to-kill or earnings estimate.

### M6 — Connected systems and measured population growth

**Player outcome:** more people and more places without unreliable travel or lost state.

- Grow tested room/session limits in steps: 10 -> 50 -> 200, only after authority,
  bandwidth, tick scheduling and client visibility budgets pass each stage.
- Interest management by space/body/cell; priority/delta updates; versioned content
  caching and server-owned time. Binary transport is a measured optimization.
- Safe handoff between regions/processes with one owner for an entity/transaction,
  idempotent reconnect and explicit cross-region latency behavior.
- Multiple star systems, long-distance routes, exploration and inter-system logistics
  that use the same precision and travel contracts.
- Service observability, opt-in client diagnostics, capacity alarms, rolling upgrades,
  protocol compatibility windows, backup drills and rehearsed incident recovery.
- A longer-term 1,000+ participant universe is a research ambition across cells or
  sessions, not a claim that the current machine can host that many nearby ships.

**Exit:** publish measured capacity envelopes and costs for a named build/workload;
perform a controlled process failure and version upgrade without duplicating or
losing committed state. Increase population only when evidence supports it.

### M7 — A creator platform and agent-accessible universe

**Player outcome:** contributors can add coherent places, ships and experiences,
and players can bring useful assistants without sacrificing world integrity.

- Versioned content-pack schemas for ships, materials, biomes, stations, missions
  and recipes, with an editor/inspection route and reproducible build tools.
- Validation for named nodes, collisions, LODs, texture memory, licenses, dependencies
  and content budgets. Curated packs have a rollback and compatibility story.
- A documented agent command API for permitted game actions, with player consent,
  scoped capabilities, rate/resource limits, audit records and revocation.
  Never execute arbitrary uploaded agent code inside the authoritative game process.
- Agent-assisted crew/logistics/mission tools built on the same allowed player
  actions; no privileged inventory minting, hidden aiming advantage or required
  commercial AI API in the core loop.
- Community world-building events, mentoring, contributor credits and rotating
  maintainers. Pack reviews and playtest evidence make quality reproducible.

**Exit:** an external contributor follows public-facing guidance to build and
validate a small pack; a player enables/revokes a bounded assistant; malformed or
excessively expensive content is rejected before affecting the shared world.

## Workstreams and first sensible slices

| Stream | Next bounded result | Larger direction |
| --- | --- | --- |
| Integration/tooling | Land this contributor framework and verify GitHub settings | Repeatable releases and community maintainers |
| Multiplayer | Reliable ten-player station departure/return and durable resource loop | Interest management and multi-region ownership |
| Fleet/engineering | Finish Atlas geometry/materials and matching physical flight shell | Multi-crew engineering and modular components |
| Planet rendering | One accepted coast-to-highland route with consistent materials/LODs | Weather, hydrology, caves and ecological identity |
| Character/interaction | Correct remote/local grips, pose blends and complete input routes | Crew actions, medical/rescue and traversal |
| Combat | Installed-mount semantics, targeting and authoritative damage | Encounters, countermeasures and meaningful component failures |
| Industry | Replicate one complete mining -> processing -> storage transaction | Settlements and supply chains |
| Economy/missions | One server-recorded delivery contract | Markets, factions and cooperative progression |
| Audio | Review mix/ducking and actual surface/weapon coverage | Adaptive score, spatial ships and environmental sound |
| Accessibility/performance | Recorded hardware/input baselines and readable settings | Remapping, scalable presentation and broader devices |
| Creator tools | One reusable asset/mission intake path | Versioned community content packs |

## How work enters and leaves the roadmap

An idea becomes a candidate brief, then an agreed scoped task with an owner,
dependencies, explicit acceptance and test plan. `Implemented`, `integrated`,
`accepted` and `deployed` are separate states. Only evidence closes a milestone;
completed PR counts and model-generated screenshots do not.

Use [governance](GOVERNANCE.md), [branch stewardship](docs/development/branches.md)
and [review gates](docs/development/reviews.md). Archive abandoned experiments with
what was learned; do not leave parallel obsolete modules described as active plans.
Raise research questions through [decision records](docs/templates/decision.md),
including technology migrations and changes to quality budgets.

There are no automatic engine rewrites, server purchases, model subscriptions,
publicity changes or deployment approvals in this roadmap. The
[historical roadmap](docs/archive/roadmap-2026-09-06.md) retains earlier plans without
making their estimates or superseded instructions current policy.
