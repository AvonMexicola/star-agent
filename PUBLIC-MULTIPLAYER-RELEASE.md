# Twenty-player public capacity release

Frozen from the deployed f7a30ef revision; this release does not migrate the
multiplayer database, protocol, shared economy or ship systems to the newer local
development branch. It raises server admission to twenty, adds twenty distinct
suit colours and gives a correct full-room message. The existing station already
has twenty physical hangars.

Validation: production multiplayer browser bundle builds; 79 multiplayer tests
pass locally with one PostgreSQL-specific test initially skipped. The staged
source also passes 19 focused room/rig/real-socket tests on the actual Node 22
server. The real socket case registers synthetic accounts with distinct test IPs,
connects twenty concurrently, verifies unique colour/hangar assignments and
replicated movement, rejects an authenticated twenty-first peer, then admits that
peer after a disconnect. Production signup rate limits are unchanged.

The database test is run separately using a disposable PostgreSQL database and
its own schema. No production account/inventory data is used for that regression.
A public HTTPS/cookie/WSS probe after promotion verifies one real authenticated
join and hangar assignment and removes its own synthetic account.

This proves admission and basic simultaneous simulation, not smooth rendering or
bandwidth headroom for twenty humans in combat. Whole-room snapshots remain at
15 Hz, simulation at 30 Hz. The performance optimisation lane is independent.
