# Finite station commodity exchanges

Aeon uses one commodity warehouse across its twenty berth terminals and two
authored hub directory pylons. The shared registry is
`src/trading/station-terminals.js`. Its hub IDs are
`station:hub:exchange-north` and `station:hub:exchange-south`; armory and component
retailers are excluded. The hub owner supplies the existing screens' signs and
the integration steward supplies authoritative hub travel/input routing.

The exchange shows warehouse stock, the exact price for the selected quantity,
and the range of unit prices within that order. A purchase loads physical cargo
into the selected owned active ship. At a hub terminal, that ship must still
be docked, within the physical pod of its owned lease, with no travel/cabin
flight and actual ship velocity below 1 m/s. Character walking speed is irrelevant.
An individual berth terminal serves only the ship leased to that berth.

## Pricing and persistence

Each resource starts at 1,024 SBU and is bounded by 0–4,096 SBU. There is no timer
or read-time refill. For the unit whose addition leaves `k` SBU in the warehouse:

```text
ask(k) = max(2, ceil(baseBuy * 2048 / (1024 + k)))
bid(k) = max(1, min(ask(k) - 1, floor(baseSell * 2048 / (1024 + k))))
```

Both prices decrease as stock becomes more abundant. A buy from `S` to `S-q`
sums asks at `S-q+1 ... S`; a sell from `S-q` to `S` sums bids at those identical
levels. Splitting an order preserves its total, and buying then reselling loses
the spread. For example, buying four basalt SBU from initial stock costs 83 CR;
selling those four straight back pays 48 CR. This does not guarantee profit or
loss when other players change supply between those orders.

The existing commerce JSON remains version 1, adding `marketVersion: 1` and
`markets`. Only legacy JSON lacking both fields initializes stock. Partially
missing, malformed, negative, fractional or excessive stock fails validation;
the original save is retained. LocalTrading persists normalization once at
initialization. Server normalization occurs inside `transactCommerce`, and the
live cache changes only after COMMIT. No database schema migration is required.

Quotes use the displayed ledger revision. Stale actions reject for review;
owner-scoped command receipts return the original settlement on replay without
changing stock twice. Crates, stock and wallets settle atomically through the
existing ledger. Packing continues to consume 16 kg/SBU without changing NPC
stock. Player shops retain finite deposits and manual owner prices.

`AEON_MARKET_ID` is `aeon-orbital`. Future distinct market records are supported;
an explicit trusted terminal resolver must map their registered physical
terminals. An unknown trusted market ID or unmapped terminal fails closed and
never defaults to Aeon. The steward will check equality with the hub security
policy's station ID after integration.

## Validation and integration handoff

On this branch, before combined hub integration:

- `node tests/station-market.test.js`: 10 tests passed. Covers every resource's
  complete marginal price range, bulk/split/reverse orders, shared stock,
  bounded capacity, unknown market IDs, player prices, replay, and local
  initialization/corrupt-save/write-failure behavior.
- `node tests/server-station-market.test.js`: 6 tests passed. Uses the actual
  station frames and exported screen anchors, with the existing memory
  transaction adapter. Covers concurrent buyers, parked hub delivery, lease/
  reach/motion rejection, post-evaluation transaction failure and reload.
- Existing SBU packing, local persistence and cargo-mining test files passed.
  The five non-SQL cases in `server-cargo.test.js` passed. The installed Node 26
  runner did not honor the attempted exclusion of that file's legacy SQL case;
  it failed at read-only temporary-directory creation before starting a database.
  No SQL validation is claimed here. The steward owns combined SQL/socket checks.
- Production build passed. It retains the existing bundle-size warning.

The controller/touch extension `tests/browser/station-market-route.js` is prepared,
but has not been run on a GPU. After the real journey opens a station terminal,
call `verifyStationMarketTrade({page, activate, screenshotPath})`. Pass the
existing controller D-pad/A chooser as `activate`, or native touch `locator.tap`
on the corresponding `data-controller-key`. It buys/sells one 2 SBU crate,
compares the displayed totals against settled credits/stock, verifies layout,
and saves buy/sell screenshots. Start with an empty Nomad grid. Run it at
1440×900 and in a real 390×844 touch context, then continue the physical return
to the delivered cargo. Repeat at the hub after its authoritative routing is
integrated. Debug state is read only; the helper performs no navigation mutation.

No new browser capture, FPS result, physical controller test or final integrated
acceptance is claimed. Root preserves the cargo owner's final 6 SBU Nomad
capacity and protocol 4 when merging; this branch does not change either.
