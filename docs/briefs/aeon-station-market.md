# Aeon finite commodity market

SA-MARKET-001 is the bounded follow-up to SA-CARGO-001's released API at
`17769ed26d41dbab52fbc995346da7ab54592c0b`. The integration steward authorized
finite station stock and dynamic bid/ask pricing in the existing commerce JSON.
The cargo owner retains crate geometry/capacity, player terminals and database
ownership. The steward owns the combined main/client/protocol integration and
the hub owner retains travel, authored signs and collision.

This branch owns the market and registered terminal modules, plus narrow changes
to the released model, local persistence, trading UI/system and server trading
hooks. All twenty Aeon berths and the two existing concourse directory screens
share `aeon-orbital`. Armory and component counters keep their existing role.
Delivery from the hub requires the caller's active cargo ship to remain parked
inside its leased berth. Character walking speed does not prevent delivery.

Initial stock is 1,024 SBU per resource, bounded by 4,096 SBU. Buying reduces the
warehouse; selling adds to it. Both marginal prices fall with abundance. Bulk
orders visit each stock level, and reverse orders visit the same levels with a
positive spread. The UI shows stock, actual total price, and the buy unit range.
Player shop prices remain set by their owner.

No services, database migrations, geometry, or protocol numbers change here.
Legacy JSON is normalized inside the existing transaction. An additive
`marketVersion: 1` marker prevents a damaged new save with missing markets from
being treated as a legacy ledger. Invalid stock is rejected without refilling.
See [the implementation and validation record](../aeon-station-market.md).
