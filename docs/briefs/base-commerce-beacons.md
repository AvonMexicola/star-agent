# SA-TRADE-001 — Find a player base, buy its stock, fly home

Status: implemented on the feature branch; controller browser journeys validated; local integration in progress. See [delivery record](../qa/base-commerce.md) for actual scope and evidence.
Roadmap milestone: M0
Human sponsor: Cees. Implementation owner: Codex, following the explicit implementation request.
Reviewer and integration steward: to be assigned by Cees/current steward.
Brief branch: `feat/base-commerce-beacons`, based on `dev/all-features` at `40a0fb4`.
Dependencies: existing SBU commerce and navigation; checked base-power delivery
`8969536` / PR #71 and the current fleet/station integration must be reconciled
before implementation. Do not replace newer shared hooks with that branch.
Implementation ownership is recorded in `project/tasks/SA-TRADE-001.json`.
Isolated preview 5610 / in-memory test API 8610; no new dependencies.

## Problem and result

Finish the player economy loop: mine → haul → deposit at your base → list stock
and price → advertise the base → another player finds it, lands, buys and leaves
with real cargo → the seller receives credits, including while offline.

The desired destination is the player's constructed base. A standalone trading
pad nearby is not sufficient integration. Provide a physical base trade terminal
where the owner selects what to sell from that base’s local storage. The mainframe
retains base administration and the public beacon switch. A base can advertise its location without selling;
a trading base adds a short list of currently stocked goods to its map entry.

Example map card (illustrative values):

> Cees's Outpost · Aeon · Public base · Shop open  
> Sells: Copper ore, Water ice, Metal stock · +2 more  
> Copper ore: 8 SBU available · 48 CR / SBU  
> Track base

Selecting the base reveals its current stock, unit prices, trading status and
compatible landing pad. The summary lists at most three stocked resource types
and an additional-type count. Use catalog names, not an owner-entered advertising
blurb. Update it after deposits, withdrawals, purchases and publication changes.

## Existing source, checked before this brief

- `src/trading/model.js` already owns finite player-terminal stock, owner prices,
  visitor purchases, seller credits, receipt replay protection and cargo capacity.
  `src/trading/local.js` saves solo commerce with mining inventory;
  `server/trading.js` commits shared commerce through the database transaction API.
- `src/trading/system.js` already emits trading-pad beacons; navigation already has
  a Bases filter. `src/navigation-targeting.js` also exposes the player's local
  constructed claims. These markers do not make a constructed base shared.
- `src/build/state.js` and `src/build/system.js` on the inspected integration head
  use `local-player` ownership; construction is disabled while joined online.
- The separate base-power delivery adds account-scoped cloud layout/storage saves
  in `server/base-sites.js`. Its explicit contract calls these trusted solo data
  and prohibits importing them into competitive inventory. Cloud persistence is
  not authoritative shared construction, permission enforcement or tradable stock.
- The newer station-market/fleet branches extend the same commerce and snapshot
  hooks. Reuse their final committed union; a second wallet or parallel shop ledger
  would split the economy again.

These are source findings, not fresh gameplay or deployment validation. The older
claim that player sales are wholly missing is too broad: base integration and
public base discovery are the actual gap.

## Scope and implementation contract

1. **Base identity and physical access.** Bind one shop to a durable account-owned
   base ID, a physical trade terminal, linked local storage and a compatible
   built landing pad. Resolve body-fixed anchors using existing anchor functions.
   Buyers must see and physically reach that base and terminal in the shared world;
   a marker pointing to geometry visible only to the seller does not pass.
2. **Owner selects local stock at the trade terminal.** The owner view lists eligible
   goods in storage explicitly linked to this base, with their source container,
   total quantity, quantity reserved for sale and unlisted remainder. The owner
   chooses an item, selects the quantity to offer, sets credits per SBU and lists
   it. They can change the price, adjust the offered quantity or stop selling it.
   Reserve the offered quantity against its actual source stock; the terminal is
   an interface to finite base storage, not another warehouse that requires the
   owner to haul the same goods again. Reserved goods cannot also be consumed by
   crafting, fuel or another transfer; unlisting releases the reservation. Newly
   deposited goods remain unlisted until the owner explicitly offers them.
   Example: 20 SBU of copper stored, 8 offered at 48 CR/SBU, 12 kept for personal
   use. Visitors see and can buy only the 8 offered SBU. Buying 2 leaves 18 stored,
   6 offered and 12 unlisted. The owner sees all three values and the earnings.
   Ordinary storage and construction/fuel buffers default to unlisted; only
   explicitly linked, eligible sources can supply an offer. Start with the existing
   six trade resources and SBU packing rules. Show units and any required packing
   step clearly; a listing never creates stock or extra storage capacity.
3. **One atomic purchase.** Validate authenticated buyer, current base/shop state,
   authoritative terminal reach, eligible landed ship, stock, price, credits and
   real cargo-grid fit. Atomically remove stock, debit the buyer, credit the owner
   and create the buyer's cargo, deducting the sold quantity from its source storage
   and reservation exactly once. Reject stale price/stock revisions with a refreshed
   offer before retry. Insufficient funds/stock/space or a failed write changes
   nothing. Retries and two buyers racing for the last unit cannot duplicate value.
4. **Public discovery.** Owner switches beacon between Private and Public at the
   mainframe; default Private for existing bases. Owners retain their own recovery
   marker. Public entries appear in the existing Bases map/filter and HUD targeting
   with name, body, position, shop state and short live sales summary. Turning off
   broadcast removes public listings; it is not a lock on a base someone already
   knows. Keep sales availability a separate Open/Closed action.
5. **Safe persistence and lifecycle.** Offline sellers can receive purchases.
   Disconnects/restarts retain stock, credits, listing settings and receipts. Close
   sales when the linked terminal/storage/pad is invalid or required power is lost.
   Preserve ownership and goods on power loss. Removal/decay with stock must retain
   a recoverable owner inventory or explicitly block removal; never silently prune
   stock. Hide unavailable destinations and clear stale selected markers safely.
6. **Input and presentation.** Use existing dialogs, controller focus keys, button
   price/quantity presets and neutral arming. Controller users can publish, stock,
   price, track, land, buy, inspect cargo and return to play without text entry.
   Use the existing base name; optional renaming must not gate the journey. Keyboard
   and touch use the same actions. Follow current map/dialog tokens and mobile pages.

The public record includes only deliberately advertised details. Never send private
container contents, fuel buffers, member lists or account balances to map clients.
Bound public discovery payloads and refresh cadence; do not stream all base interiors
and inventories every frame. A stale cached listing never authorizes a purchase.

## Authority prerequisite — resolve before granting shared value

Write a short decision record for the shared base identity, save/protocol change,
stock provenance, lifecycle and transaction boundary. Extend the existing commerce
ledger; keep finite sale stock, payment and receipts in one atomic authority.

Trusted solo saves, including account-backed solo base containers and sandbox
materials, cannot be used as shared sale stock. Implement a server-validated base
publication/placement route and server-owned deposits from existing authoritative
cargo. Any broader shared-building work this requires is a named prerequisite,
not something a map beacon or local purchase fixture can stand in for. Preserve
existing solo saves and provide the offline path without requiring an account.

Coordinate changes to `src/build/`, `src/trading/`, `src/navigation-targeting.js`,
`src/system-map.js`, `src/main.js`, `server/base-sites.js`, `server/trading.js`,
`server/database.js`, protocol/snapshot hooks and migrations with their current
owners. Choose migration/protocol versions from the latest integrated registry;
003 is already reserved/used for base sites. Existing 36 m trade-pad assumptions
must not certify the current 64 m Atlas: use actual hull/pad compatibility.

No auction house, remote map purchase, automatic delivery, buy orders, price
simulation, new currency, taxation, raiding or custom beacon asset is required.

## Acceptance and verification

- Two distinct accounts: A constructs/registers an eligible shared base, mines and
  hauls authoritative cargo, stocks it, prices it and publishes its beacon. B finds
  it on the map, tracks it, flies/lands, walks to the actual terminal, buys and
  inspects the real loaded cargo. Verify exact stock and both credit deltas.
- At the owner's physical trade terminal, offer only part of a stored resource;
  verify the unlisted remainder stays private and unavailable to buyers. Exercise
  price changes, increasing/decreasing the offer and unlisting. New deposits must
  not silently increase the offer. Concurrent crafting/transfers cannot spend
  reserved stock, and source-container removal cannot orphan a live reservation.
- Repeat a purchase while A is offline. Restart the isolated service and reconnect
  both accounts; base, stock, receipts, cargo and earnings must still agree.
- Cover last-unit races, double activation, replay/reconnect, stale price, full or
  incompatible ship, poor reach, non-owner edits, hidden/private listings, empty
  stock, power loss, removal/decay and injected transaction failures.
- Prove solo/sandbox stock cannot enter shared sales and that old valid saves load
  without item loss or automatic publication. Account switches must clear cached
  private state and ownership controls.
- Run an actual controller-only seller and buyer journey, including map filtering,
  result inventory and return to play. Exercise held input through dialog/focus/
  disconnect transitions. Record injected Gamepad and physical-device results
  separately; debug teleport plus a purchase is not full journey evidence.
- Inspect 1440×900 and 390×844 map/shop captures with current and empty stock,
  visible focus and no new console/page errors. Verify markers follow body anchors
  and that payload/refresh costs stay bounded. Coordinate one browser job at a time.
- Run `npm run check:repo`, `npm run plan:checks -- --base origin/dev/all-features`,
  affected commerce/build/map unit tests, real isolated PostgreSQL/socket tests,
  production build and the focused browser journeys. Record exact source IDs,
  commands, environment and failures; no results are pre-approved by this brief.

## Delivery

Submit a reviewable PR against `dev/all-features` with the decision record,
implementation, migrations, tests and curated evidence. Coordinate the standing
local integration request with the steward and update HANDOFF.md and
`docs/local-development.md` after checks. Public deployment is separate.

Next action: assign the implementation owner, settle the shared-base authority
prerequisite against the current base-power/fleet union, then build this complete
seller-to-buyer journey. This brief does not claim that the feature is implemented.
