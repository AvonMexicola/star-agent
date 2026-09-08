# Settlement stock and logical needs

Cees requests local stock and logical needs for the four new settlements.
Each receives a complete six-commodity supply profile and desired reserve targets
appropriate to its existing role. A shortage is target minus actual warehouse
stock. Deliveries consume actual player cargo, pay the existing wallet and reduce
the shortage in one save; a settlement stops purchasing at its target. Buying
local exports consumes finite stock. Prices retain the existing marginal-stock
curve and positive spread. The map and terminal show current supplies and needs.

Existing warehouse quantities, receipts, cargo and credits are preserved. New
profiles seed only missing markets through the existing one-time initializer.
No automatic refills, time-based production, extra commodity/currency, new save
schema or multiplayer settlement replication. Settlements remain solo world content.

Scope: catalog and new economy projection, bounded market quote rule, existing
trade UI and beacon hooks, focused conservation/migration tests and controller
journey. No geometry, lighting, controller mapping or dependency changes. Isolated
preview 5652; no API needed. Preserve active foundation/light/rover lanes.
