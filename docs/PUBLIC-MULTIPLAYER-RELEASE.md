# Current multiplayer release

Cees explicitly authorized the development build's multiplayer release on
2026-09-08. Runtime **`623430d106155f3f5b7f669f81e0975d8d47e89c`** is live at
<https://multiplayer.staragent.site> as of **2026-09-07 23:20:04 UTC**. It merges
checked fleet/meadow `5f63893` and promoted development `c99736f` with production
`5ecccbd`, retaining the 20-pilot cap/palette and capacity feedback. Client and
server use **protocol 5**, seed 7291. The complete Atlas, Burrow, station/HUB,
finite-market/tractor, social and base content is included. The build enables the
existing development launcher; it keeps normal multiplayer API/WS activation.

The only merge conflicts were imports in the server/UI and the spawn fixture.
Both new services and the production capacity behavior are preserved; all twenty
pilots now receive the current physical station-spawn assertions. Existing auth,
SMTP configuration and operator settings were not replaced.

Validation:

- Configured multiplayer command: **187 pass**, two opt-in SQL checks initially
  skipped. Both were then exercised in an isolated database: **27/27 auth/social
  checks pass, zero skips**. The configured cargo SQL migration/concurrency/
  atomicity/restart check also passes. No production users or storage were used
  for those CPU suites.
- Production build passes with `VITE_DEV_TOOLS=1`, **315 modules** and
  `main-B34-nHt2.js`; existing large-chunk warning retained. Repository check
  passes. The staged production Node 22.23.2 runtime loads all twenty actual
  station bays before promotion.
- A private production dump was restored to a disposable database. Ordered
  migrations **1,2,3,4** were applied twice. Every existing account, session,
  password-reset and player-state row retained its count and digest. The
  disposable database was removed.
- The old service stopped gracefully, a final checkpoint backup was taken, and
  the same migrations were applied to production before startup. Existing rows
  and the private environment file matched exactly. Static files and API switched
  together through `/opt/staragent/multiplayer-candidate`.
- Real public HTTPS registration, Secure/HttpOnly cookie, authenticated WSS,
  protocol/cap/seed, authoritative deck spawn, commerce/defense snapshot and hangar
  request pass. The probe removes only its synthetic account and empty commerce
  manifests. A final query confirms all previous rows still match the backup and
  no orphan fixture account remains in commerce.
- Eight public artifact hashes match the built files: HTML, release metadata,
  main module, Atlas, Burrow, station shell/exterior and defense. Exact hashes are
  in [the HTTP receipt](qa/multiplayer/fleet-release-2026-09-08.json). An initial
  local enumeration used a nonexistent nested defense path; the corrected check
  reads the actual `models/station-defense.glb` and passes. No runtime change was
  required. No post-start server failure diagnostics were observed.

Runtime directory:
`/opt/staragent/multiplayer-releases/623430d106155f3f5b7f669f81e0975d8d47e89c`.
The former runtime and root-only database backups are retained under
`/opt/staragent/backups/multiplayer-before-623430d`; backups have mode 0600.
No production database rollback occurred. Reassess post-release inventory/cargo
compatibility before restoring the old protocol-1 runtime; never discard later
player writes merely to revert the client.

The release branch is `release/public-multiplayer`; the existing PR is
[#78](https://github.com/AvonMexicola/star-agent/pull/78). The deployment did not
modify `public-current`, Caddy, the local 5178/8087 preview or its database. SMTP
was unconfigured before this release and remains so; no reset-email delivery is
claimed. The user's manual Atlas meadow test and the parent's checked fleet,
Burrow and authenticated opening journeys precede this release. No new GPU,
physical-controller, SMTP or twenty-human load acceptance is claimed here.

## Initial host CPU and traffic baseline

Measured 2026-09-07 21:18 UTC on the existing 8-vCPU AMD EPYC host, Node
22.23.2, frozen live runtime f9037eb. Run
`node scripts/multiplayer/capacity-baseline.mjs` in a separate checkout. It uses
only an in-memory store and deterministic synthetic pilots, warms up 300 ticks,
then measures 1,800 ticks (60 simulated seconds). The send callback serializes
real per-pilot snapshots to JSON. It never contacts the live room or database.

| Pilots | Mean tick | p95 tick | Maximum tick | Raw outgoing JSON |
| --- | --- | --- | --- | --- |
| 10 | 0.72 ms | 1.21 ms | 2.11 ms | 13.8 Mbit/s |
| 20 | 2.00 ms | 3.58 ms | 5.61 ms | 53.8 Mbit/s |

The simulation runs at 30 Hz (33.3 ms nominal tick interval), with 15 state
messages/second/pilot. At twenty pilots, measured simulation plus serialization
cost corresponds to about 6% of one CPU core. This excludes socket/TLS, SQL,
network scheduling, combat-heavy scenes and client rendering. It is a starting
baseline, not certification of twenty real players, latency or frame rate.

The current full-room JSON snapshots are bandwidth-heavy: about 6.72 MB/s across
twenty clients in this scenario, or 24.2 GB/hour if continuously full. Actual
traffic depends on scene/state and occupancy. Monitor transfer allowance as well
as CPU; an interest-managed or compact snapshot protocol is a separate future
optimization. No new server or paid service was provisioned.
