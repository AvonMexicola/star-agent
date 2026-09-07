# Combat/cruise state in authoritative flight

2026-09-07 · SA-FLIGHT-001 · development checkpoint, domain review pending.

Navigation owns `combatMode` independently of `flightAssist`, defaulting to true
on a new flight. The existing authoritative action channel accepts `combat` and
toggles that server-owned state using Navigation's existing mode guards. The
server includes an additive boolean `combatMode` in snapshots; clients copy it
only when present. Existing clients ignore it and new clients retain their default
when reading older snapshots. No durable save or account schema changes.

This lets keyboard and controller mode selection use the same authoritative
flight speed limits. Online ship weapons remain disabled; this does not introduce
client-authoritative hits or offline patrol replication. Coordinated client/server
updates are needed to expose the new mode toggle against a running API.
