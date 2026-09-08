# Authored solo settlements and finite markets

Status: implemented local development checkpoint; independent review pending.

World-owned settlement layouts reuse BuildSystem geometry and collision through
an isolated, non-persistent content adapter. They do not enter player construction
saves, claim limits, removable pieces or storage. Regular claim placement reserves
the settlement footprint. The layout survey samples canonical seeded terrain and
stores each resolved claim's existing body-fixed anchor representation.

Solo commerce initializes four additional entries in the existing `markets`
record through its normal atomic MiningStore save. `settlementVersion: 1` records
completion of this additive initialization. After that receipt exists, a missing
market is invalid and cannot replenish stock. Existing account, cargo, excavation,
player-market, receipt and Aeon stock records are retained. Existing readers permit
additional market IDs. No generator, multiplayer protocol or server schema changes.

The client removes these settlements from rendered world content, physical
collision, navigation signals and reachable terminals while connected online.
Server authority must be implemented before enabling shared settlements; client
settlement market IDs never grant online inventory or collision authority.
