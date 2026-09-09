# Compounds and vehicle release — 9 September 2026

Status: authorized candidate; final build, paired publication and live verification
are recorded below when complete. Operator: Codex for Cees. Authorization is
Cees's explicit request to offer Burrow/Burrow Sentry at non-pirate garages, merge
all ready updates into dev, and push to play and multiplayer. No additional
production permission is inferred from contributor automation.

## Included source

The runtime composition is `a44629297abb3dadd89abb221623560d37ae48ff`.
It retains the public entry/capacity branch `206e853` and the checked development
head `3ea6b07d50d7a0e91acaf3c5047b5d56d06aadba`, plus civilian garage feature
`1536aee`. Later record-only commits do not change the runtime.

| Feature | Included checked head |
| --- | --- |
| Civilian Burrow and Burrow Sentry garage choice | `1536aee` |
| Two-seat Sentry authority and carrier/frame corrections | `3ea6b07` |
| Disabled Atlas cargo recovery missions | `2b280363` |
| Four rotating worlds and shared planetary clock | `1da9b0e` |
| Faction finishes and enclosed Hush/Veil compounds | `2a6e405` |
| Pirate compound and previous garage integration | `cc1e749` |
| Compact builder and rotating handheld cutter | `583bf5f` |
| Transport missions | `f90f98c` |
| Projected terminals | `23ca619` |
| Tall foundations and optional deck-mounted mainframes | `01a28df` |
| Updated mining Burrow | `f2f3e04` |
| Regional enemy ship encounters | `f1ed343` |

The development history also retains the checked Stratum and Gannet ships,
previous fleet, input, navigation, construction, trading, NPC shopkeepers and
wildlife work. Each listed head is an ancestor of this composition.

The separate five-ground-pirate/Lizzy lane remains author validation in progress
in `.worktrees/pirates` (local head `3ab7de2`, published `3a9a56c`). Its final lunar
journey/integration is not offered as completed. That unfinished work is excluded;
no other owner's dirty source is copied. Lizzy has no delivered tutorial.

## Player behavior and compatibility

All four civilian garages offer the original mining Burrow and two-seat laser
Sentry. A vehicle is placed in the clear bay without moving the player. Existing
cargo and condition survive retrieval; occupied, moving, carried or busy rovers
and an overlapping other rover are rejected. Pirate compounds get no service.
[Exact garage journeys and failures](../compound-vehicle-choice/README.md).

Garage service retains its current solo scope. The multiplayer site also contains
the offline client, but publishing it does not add authoritative Burrow mining or
online garage requests. Connected Sentry deployment and other completed shared
features use their existing server authority. Other solo features retain their
existing online gates.

Play is an explicit solo build: no startup API/account request or account modal.
Multiplayer retains automatic account entry and the existing 20-player capacity.
Both retain the scene/ship launcher. Client and server advance together from
protocol 5 to protocol 10; clients must refresh. Seed 7291 and canonical terrain
are unchanged. No schema migration is added: all four SQL migration hashes match
the deployed server exactly. The generated Prisma client is created during
installation. Account/session/inventory data stays in the existing database.

## Validation

- `npm test`: 1,283 pass, zero fail/skip, 31.02 seconds on the combined runtime.
- 37 focused garage/Sentry/carrier cases pass, including every world ramp,
  live doors, exact prism equivalence and turret ceiling clearance.
- Complete Burrow controller journey 2.5 minutes and final Sentry journey
  2.7 minutes pass. Keyboard/native390 retrieval and modal/focus/device gates
  pass with empty application errors/warnings. Exact source/hash distinctions
  and retained failures are in the linked feature record.
- Combined multiplayer, production build and public entry results follow in
  the final receipt. An initial server run lacked this new worktree's generated
  Prisma client; it was stopped, only its temporary cargo PostgreSQL was closed,
  and the generated prerequisite installed before a fresh serialized run.

Existing feature-specific controller, artwork, shader and physical flight evidence
remains linked from each feature's QA record. This release does not claim a new
physical-controller, independent final art, GPU budget, twenty-person soak, SMTP
mail delivery or disaster-recovery certification. Browser jobs use one worker and
one shared GPU lease; no application change masks a browser startup failure.

## Deployment boundary and rollback

The explicit solo artifact is staged beneath `/opt/staragent/public-releases/`
and promoted with `/opt/staragent/public-current`; the legacy main workflow uses
a different symlink. Multiplayer is staged separately beneath
`/opt/staragent/multiplayer-releases/` and promoted through the existing
`/opt/staragent/multiplayer-candidate` symlink and managed service. Caddy, DNS,
service environment and database identities are retained.

Previous solo release: `82729f5f743e1257220eb7865811e5dcadd11ab2`.
Previous multiplayer directory: `623430d106155f3f5b7f669f81e0975d8d47e89c`,
with its separately recorded `b51fa894` client and `c885f5c` model-cache correction.
Retain those directories. Roll back frontend/server together by restoring the
previous symlinks and gracefully restarting only the multiplayer service.
Do not reset or roll back the database merely because the application changes.
Actual backup, release hashes, health and authenticated WSS results follow in the
final delivery record; staging alone is not deployment.
