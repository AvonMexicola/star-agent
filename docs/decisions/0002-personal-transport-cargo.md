# ADR 0002 — Personal freight in the existing commerce transaction

Status: implementation checkpoint; independent review pending. 2026-09-08.
Authority: Cees requests personal mission crates ordered at A and deposited at B.

The existing commerce ledger already owns atomic cargo/credit writes, optimistic
revisions and transaction receipts. Extend each participating account with an
optional version1 transport record, one active mission and eight completion
records. Legacy accounts and ordinary crates stay valid without normalization.
Issued crates carry an immutable mission/owner seal, retained through hand/tractor
and grid movement. Validate exactly one matching crate for every issued mission.
Never repair missing or invalid freight by granting another crate.

Ordering, depositing and abandonment execute in the existing transaction. The
server derives identity, terminal reach, parked hull and apron position. Crates
are private to their accepting owner in snapshots, interaction and loose-cargo
collision. Ordinary trading cannot consume a sealed crate. Deposit removes the
exact crate and grants the catalog reward once. Mission goods are sealed contract
stock, separate from the finite commodity-market supply.

Protocol7 pairs shared authored settlement collision/terminals with the client
and owner-private freight snapshots. Both sides use the canonical construction
layouts; no second terrain or database table is introduced. Older clients must
update before joining. The local preview API must restart after integration;
PostgreSQL schemas/accounts are retained. Offline MiningStore and account-backed
online commerce remain separate inventories. Explicit server durability and
reconnect checks are required before claiming saved multiplayer transport.

Shared targeted drive is scoped to the active freight pickup/delivery. The server
checks pilot mode, power, secured cargo, gear, atmosphere altitude and actual nose
alignment, then computes the canonical endpoint and full hazard-cleared analytic
flight. Submitted positions, endpoints, reward and owner are not authority. The
existing navigation integrator and snapshot handle continuous motion and abort.
Client charge remains the shared three-second input affordance; existing server
free-heading travel has no separate charge duration. Normal flight/landing and
terminal reach still complete the last 20 km. Other shared targeted routes retain
their existing unavailable status; free-heading travel remains available.
