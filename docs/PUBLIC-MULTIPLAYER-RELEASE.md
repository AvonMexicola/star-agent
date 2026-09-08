# Current multiplayer release

The corrected static client **`b51fa894b1b1e26784f235b2de1e475ad98d8a5c`** is
live at <https://multiplayer.staragent.site> as of **2026-09-08 00:36:17 UTC**.
The server remains **`623430d106155f3f5b7f669f81e0975d8d47e89c`**, protocol 5,
seed 7291, capacity 20. Public `release.json` records `clientSource` and
`serverSource` separately; its `source` field identifies the current static client.

The default page now enters the Nomad hangar opening directly. F2 and controller
Menu keep scene selection optional; Comms/account login and the server-assigned
multiplayer opening remain available. Existing practice-store isolation and
explicit scene links are preserved. Gameplay model requests carry content SHA-256
revisions, including the current Nomad and hangar assets. This prevents an earlier
release's model URL from supplying stale bytes. The checked hangar has no long
floor hoses; its wall reels and overhead services remain authored details.

The patch adapts checked `5879ec8` and `c885f5c` onto the existing multiplayer
release, preserving its auth wiring. It was built with `VITE_DEV_TOOLS=1`, with
neither solo mode nor a forced account entry enabled. No server, protocol, model,
lockfile, environment, service or database source changed.

Static rollout validation:

- **49/49** focused cache, entry, startup, opening and multiplayer UI tests pass,
  zero skips. Production build, repository and whitespace checks pass.
  The resulting gameplay module is `main-CcHQYLAx.js`.
- Parent source acceptance: **1,024 normal tests**, **30 focused checks** and the
  combined actual solo opening/controller/model-request browser case pass. This
  multiplayer adaptation adds CPU and HTTP verification; no new GPU, controller
  hardware or authenticated-account fixture was run.
- All **223** built files match the staged content manifest. All **37** previous
  hashed assets remain available for already-open clients. The static directory
  changed atomically with Linux `renameat2(RENAME_EXCHANGE)` after a backup.
- Public HTTPS hashes match **10** artifacts: HTML, release metadata, new main,
  six versioned models and the previous main module. Health is successful before
  and after. PID **19466** and its start time, **442** runtime source files and
  the private environment digest are unchanged. No SQL connection, account
  creation or API restart was performed.

Exact artifact and promotion evidence is in
[the static correction receipt](qa/multiplayer/static-correction-2026-09-08.json).
The underlying runtime symlink remains `/opt/staragent/multiplayer-candidate` →
`/opt/staragent/multiplayer-releases/623430d106155f3f5b7f669f81e0975d8d47e89c`.
Only its `dist` entry now points to
`/opt/staragent/multiplayer-static-releases/b51fa894b1b1e26784f235b2de1e475ad98d8a5c/dist`.
The complete prior static build is retained in the root-only
`/opt/staragent/backups/multiplayer-static-before-b51fa89/dist` (and `dist-original`).
A static rollback can atomically replace the `dist` symlink with one pointing at
that backup; it must not restart the API or roll back the database.

Standalone studios, raw manifest fetches and textures outside `/models/` remain
outside this cache correction. Restart Vite after changing model files so its
content manifest regenerates. No production renderer or new gameplay acceptance
beyond the named checks is claimed.

## Underlying fleet and server release

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
