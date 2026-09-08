# SA-TRANSPORT-001 — Interplanetary sealed cargo contracts

Status: locally integrated at `f294a98`; developer validation passes. Independent review pending. Sponsor: Cees / @AvonMexicola. Implementer: Codex mission designer.
Branch `feat/transport-missions`, base `d08f181`; isolated `.worktrees/transport-missions`.
Owned preview5662 / private test API8662. No new dependencies or assets.

## Player journey

Choose a contract between two authored planetary/moon settlements. Accepting
records a personal contract and creates no crate. Fly to A, land a cargo ship,
walk to the terminal and order the sealed crate. Only that owner can see/handle
it. Load it with the existing tractor beam, secure it on the cargo grid, fly to B,
land and deposit that exact crate through B's terminal. The transaction removes
the crate, records completion and pays the advertised credits exactly once.

One active contract per player, bounded receipt/history data, physical original
crate across load/unload, reload and reconnect. No substitute ordinary resources,
resale, another player's collection, duplicate order or remote terminal deposit.
Abandonment recalls that owner's crate without reward; stacked supporting cargo
must be removed first. Offline saves and online account ledgers remain separate.

## Contracts and ownership

New `src/transport/` modules; narrow trading/model/system/ui/local and server/trading
hooks, cargo seal preservation and visibility, existing settlement authority hooks,
menu entry, tests and docs. Settlement stock/economy/catalog/geometry, floodlight,
foundation and rover work remain their owners' lanes. Parent integrates their
checked commits before shared delivery. Core cargo stays usable offline.

The existing commerce transaction owns mission/crate/credit changes, CAS and
idempotency. Authoritative navigation derives player identity, pickup and terminal
reach, parked ship, crate seal and destination. Shared settlements must use the
same canonical construction layout and collision on client/server. Protocol and
additive ledger changes get a short decision record and compatibility tests.

## Verification

Unit invariants for ownership, exact crate identity, site/reach, repeat commands,
stacking, abandonment, persistence and failed saves. Two-account authoritative
isolation including guessed crate/mission IDs. Actual controller-only contract,
physical pickup/load, interworld flight, delivery/result/return journey; held input
across dialog/focus/disconnect/replacement. Keyboard/native390touch and original
1440desktop screenshots. Build/repository/check plan. Physical hardware,
independent acceptance and public deployment remain separate.

## Coordinated shared trade hooks

Settlement owner offered checked `1f8a20a` for transport integration. Preserve its
local-stock label, activity/need rows and market beacon summaries while adding
Freight. Those shared UI/system lines are dependencies, not exclusive transport
registry claims; the new transport renderer/model remain owned here. Preserve
foundation/rover tests in the package list and retire no other active task.
