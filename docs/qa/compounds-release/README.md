# Compounds and vehicle release — 9 September 2026

Status: deployed to play and multiplayer at 02:25:56 UTC on 9 September 2026.
Protected integration PR108 merged into `dev/all-features` at `4077761`. Operator: Codex for Cees. Authorization is
Cees's explicit request to offer Burrow/Burrow Sentry at non-pirate garages, merge
all ready updates into dev, and push to play and multiplayer. No additional
production permission is inferred from contributor automation.

## Included source

The exact tested and deployed source is `ea234d2cb71cb26b53c3671a3a6db962a0da5273`.
It retains the public entry/capacity branch `206e853` and the checked development
head `3ea6b07d50d7a0e91acaf3c5047b5d56d06aadba`, plus civilian garage feature
`1536aee`. The final entry correction preserves automatic multiplayer account
entry with scene tools, and the packager includes the Gannet/Stratum viewers.
Subsequent delivery documentation does not change the deployed artifacts.

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
- Serialized multiplayer: 227 pass, two existing optional skips, zero failures,
  49.10 seconds. Another 41 entry/startup/UI cases pass after the final correction.
- Both explicit builds pass at exact `ea234d2`; 47 packaged viewer references per
  channel and all 18 homepage files validate. Repository checks pass; the explicit
  base plan covers 443 paths and leaves manual classification separate.
- Two final production-browser cases pass before publication in 2.0 minutes,
  and both pass again against the real public HTTPS sites. They cover solo's
  initial Nomad opening, unchanged normal save, exact loaded GLB hashes, keyboard
  and controller scene/held-input/return flow, and dedicated multiplayer account
  entry with scene tools and offline return. No application errors or solo API/WS
  requests. Chromium 151.0.7922.173, ANGLE OpenGL, 1440×900; injected standard pad.
- Hosted run [34302418979](https://github.com/AvonMexicola/star-agent/actions/runs/34302418979)
  passes plan, source, multiplayer, browser and required verify before PR108 merge.

Original failures remain recorded: the first database suite lacked this private
worktree's generated Prisma client; only its own temporary processes/database
were closed before generating and rerunning. The standalone viewer validator
caught missing newer ship entries, corrected in the final packager. The first
restore wrapper inherited application PG variables for its administrative
`createdb` process and failed before creating the copy; separating that process's
environment fixed the rehearsal. The first HTTPS script found only six models
because compiled paths begin `./assets`; the corrected asserted parser verifies
all compiled entry references too. No application change masks these tool failures.

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
The [final receipt](release.json) records both build identities, all public
entry/model hashes, complete staged manifest hashes and actual live checks.
All 300 public/homepage files and 1,008 multiplayer runtime/artifact files matched
the local manifests before promotion. The unprivileged service user successfully
constructed the twenty-pod authoritative world before cutover.

A private mode-0600 backup remains on the server at
`/opt/staragent/backups/compounds-20260909022304812/production.dump`. Its original
restore matched all table counts and row digests. A sanitized second backup was
restored again; the new Prisma adapter read it, and running migrations twice
changed no restored rows. Production remained unchanged during rehearsal and
only the uniquely named disposable database was removed. No private data or
credentials were copied into evidence. This bounded rehearsal is not broad
disaster-recovery certification.

Promotion at 02:25:54–02:25:56 UTC gracefully stopped only the existing multiplayer
service, atomically changed its client/server directory and the solo/homepage
symlink, then verified readiness. Zero connections preceded the restart. The two
initial local health polls occurred before the server listened; it became healthy
within two seconds. Caddy, DNS, service configuration and the production database
identity remain unchanged. The existing missing-SMTP notice remains.

Actual HTTPS release IDs and HTML match both explicit artifacts. Their compiled
entry scripts/styles and six gameplay models match the local SHA-256 values.
Homepage and www match the staged page. HTTPS health, synthetic registration,
authenticated WSS welcome (protocol10/cap20/seed7291) and hangar assignment pass;
the probe removes only its temporary account. The public browser journeys pass
with frozen tracked source throughout. [Solo capture](public-solo.png) and
[multiplayer capture](public-multiplayer.png) were inspected.

Local `dev/all-features` also contains PR108. The managed5178/API8087 preview
refreshed at02:23:39UTC with protocol10/cap20 and its existing persistent database.
Both fast-forwards preserved the complete dirty527435-byte handoff journal; the
new delivery entries were appended afterward. No root source/index or unfinished
owner worktree was staged. Delivery notes follow as a separate documentation PR.
