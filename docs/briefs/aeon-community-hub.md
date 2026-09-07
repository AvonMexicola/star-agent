# SA-HUB-001 — Aeon community station

Status: active. Sponsor: Cees / @AvonMexicola. Branch: `feat/aeon-community-hub`,
based on local `dev/all-features` at `2f3249f`. Root owns integration and defense;
Nietzsche owns the physical hub route and equipment policy. The bounded market
work extends cargo's committed `7b3bed8` ledger (Nomad 6 SBU / Atlas 512 SBU). Shared local promotion
remains serialized by the integration steward; Cees gates public PRs/releases.

## Player result

The big station over Aeon protects players and their ships within **30,000 metres
of the station centre**. This is a station zone, not a moving player bubble.
An authoritative damaging shot or harmful ram against a protected player or hull
causes one immediate lethal station strike against the aggressor. Accepted mutual
friends are exempt from retaliation. Normal friendly damage is still normal damage.
Weapons and mining tools stay stowed inside the occupied community concourse,
including after inventory selection, elevator arrival and reconnect.

Players physically ride the existing berth elevator into the concourse. Trading
terminals share finite Aeon stock through the existing commerce ledger. Scarcity
raises both purchase and sale prices; abundance lowers both. Bulk quotes use the
same stock interval in each direction and retain a spread. Player-owned shops
keep their owner-set prices. Later stations can have separate zones and markets.

## Ownership and contracts

- Root: `server/security.js`, `server/ramming.js`, narrow `server/combat.js`,
  `server/room.js`, `src/main.js`, `src/multiplayer/client.js` and protocol hooks;
  shared station defense policy, original heavy turret asset and renderer.
- Hub subtask: new station hub service/policy, server world adapter, existing
  station services/frames/concourse, central loadout guard and mining stow.
- Market subtask: `src/trading/market.js`, narrow existing commerce model/UI/server
  hooks and tests, from cargo's coherent snapshot. No competing wallet or schema.
- Social owner: the sole authoritative async `store.areFriends(a,b)` predicate.
  Pending requests and blocked/removed relationships are not friendship.
- Canonical station identity: `aeon-orbital`; positions remain world doubles.
  Occupied hub volume and the much larger protection sphere are separate tests.

No new account or inventory database is introduced. Existing save and transaction
owners retain control. Invalid client target/damage/friend/position claims confer
no authority. Defense reuses the room's death and physical respawn lifecycle.
Current online combat availability must be reported accurately; renderer-only
mounted shots cannot be claimed as multiplayer damage.

## Acceptance and evidence

Test the exact sphere boundary, attackers outside firing in, victims outside,
friend acceptance/removal/block, asynchronous relationship failure and late
responses, shot obstruction, actual swept ship contact and contact deduplication.
Walking into a stationary ship and harmless shared velocity must not cause a ram
penalty. Observe actual death, durable recovery and no client-authored damage.

Exercise reachable keyboard, injected standard controller and native touch routes
through the physical elevator, concourse, equipment lock, trade and return to play.
Held inputs must require release before rearming. Inspect actual 1440×900 and
390×844 game captures and errors. Hardware input and performance claims stay
separate. Defense models follow the existing Blender asset production standard,
with source, named mechanism/muzzle contracts, measured budgets, real rendering
and independent review before final visual acceptance.

The implemented branch includes the coherent social/cargo/control integration at
`aaf08cc`; its draft PR stacks on `feat/dev-social-review` (PR73). Server, SQL and
asset audit results are recorded in [the production record](../qa/community-hub/production-record.md).
Final browser routes and independent candidate06 art acceptance are in progress;
shared integration and public deployment are separate gates.
