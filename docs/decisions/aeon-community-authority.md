# Aeon community authority

2026-09-07 — implementation in progress; independent review pending.

Cees requested lethal station protection, a friend exception, an unarmed social
concourse and stock-dependent trading. The protection centre is explicitly the
big Aeon station. The room already owns gun hits, death, leases and inventories;
social and commerce have separate existing owners.

Use a stable `aeon-orbital` station definition and world-double distance tests.
Only validated room attacks enter defense. Resolve accepted friendship with the
social owner's asynchronous predicate before committing a protected attack's
damage/retaliation. A failed relationship lookup must not guess that a friend is
hostile. Guard delayed decisions against a different player life and prevent a
disconnect/reconnect from escaping an already accepted incident.

Peer ramming uses the existing authoritative hull bounds and swept relative
motion. It is separate from terrain and station collision and introduces no new
planet floor. Slow contact and walking into a stationary hull are not harmful
ramming. The concourse uses its real authored occupied frame and collision;
elevator travel is a validated server sequence, never a client position upload.

Market stock lives in the existing atomic commerce state. All Aeon berth
terminals map to one market; later station IDs can map to separate stock. Dynamic
bulk totals integrate over inventory changes with a spread so a player's own
buy/sell cycle cannot create credits. Existing manually priced player shops
remain in the same ledger.

The network additions, save normalization and exact validation results will be
recorded with their checked source before integration. These decisions do not
grant public release authority or certify pending functionality/art.
