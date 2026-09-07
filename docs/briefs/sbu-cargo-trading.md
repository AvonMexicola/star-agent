# SBU cargo and trading

Cees requests physical1/2/4/8/16/32/64 SBU crates, measured Nomad/Atlas grids,
1SBU hand carry, trade-terminal purchases to a chosen docked ship, player shops
and accessible theft. This branch owns src/cargo, src/trading, server/trading and
narrow inventory/database/station/controller/navigation hooks. Existing Atlas
geometry, rover routes and abstract expedition lockers remain owned elsewhere.

One cell is0.6m on each side. A1SBU crate is hand carried; a64SBU container is
1.2×2.4×4.8m. Nomad uses one1×4×2 grid, capacity8SBU. The playable30m Atlas uses
two2×8×16 side-deck grids, capacity512SBU. Its8×10m belly elevator, two smaller
lifts, fore corridor and sample chest are excluded. The64m Atlas MarkII studio
is a different unintegrated hull and must not inherit these dimensions.

The ledger owns crate IDs/placement, accounts, stock/prices and receipts. Inputs
are bounded intentions; authoritative pose establishes terminal reach, docking
and physical boarding. Database writes atomically settle credits, crate ownership,
seller stock and any loose-resource deduction. Snapshots render committed crates.
Local mode stores the same ledger inside MiningStore's existing single save.
Malformed or failed writes retain previous state. No local-to-server cargo import.

The terminal UI uses the existing green/white Meridian palette, inherited game
font, left-aligned manifests, fixed-height views and explicit three-row pages.
Capacity and destination are always visible. Existing controller focus/neutral
router owns activation; keyboard and touch share semantic buttons.

Acceptance requires packing/carry/capacity invariants, transactional theft and
multi-player sales, isolated PostgreSQL persistence/failure/reload checks,
actual controller terminal purchase→return to crate→carry/stow and Atlas checks,
1440×900 and390×844 captures, console/resource diagnostics and release of GPU.
Independent acceptance and physical controller testing remain separate.
