# SA-TRADE-001 — base stock, trade terminals and beacons

Status: feature branch implemented and controller journeys validated; local integration pending.
Owner: Codex, no independent reviewer or physical controller acceptance claimed.
Branch: `feat/base-commerce-beacons`; implementation `debd634`, latest development
merge `1a90ea4` incorporates `c766544`. Worktree `/tmp/star-agent-base-commerce`. Final base source `4b36b50`;
the later elevator merge preserves its runtime files unchanged.
Isolated preview 5610 and test-only memory API 8610. No production deployment.

## Player-visible behavior

Build a **Storage & trade terminal** and designate a landing pad. Interact with the
terminal, open trade, and link the local base. In **My shop**, cycle the base's real
containers and resources, choose a crate quantity, and offer only that quantity.
The panel shows stored, offered and retained kilograms and the price per SBU.
One SBU is 16 kg. New deposits remain unlisted; owners can reduce or remove offers,
load unlisted goods aboard, close the shop, or toggle its public beacon.
Resource prices apply across the base's containers.

The map's Bases filter starts enabled for new saves; existing filter preferences
are preserved. A linked local base gets one marker. Public shops advertise up to
three stocked resource names and a further-type count, with quantities and prices
on selection. Private shops have no public beacon. Closed, unpowered and empty
shops do not advertise an available sale incorrectly.

Shared registration is an explicit bridge from existing solo construction: join
Comms, track the private base-plan marker, travel to its terminal location, and
choose **Trade → Build → Register shared**. The server checks canonical terrain,
layout and actual proximity, then charges 500 CR to commission an empty shared
base. Deposit real docked ship cargo into its storage and choose the sale quantity.
Visitors land their own compatible ship on the designated pad, walk to the terminal,
buy, and receive real cargo. Payment reaches the owner's server wallet even offline.

## Architecture and limits

The existing commerce ledger, atomic database transaction and receipt identities
own money, reservations and cargo. No second wallet or duplicated inventory was
added. Local offers reserve part of existing MiningStore containers; its save guard
also covers transfers, crafting and removal. Upkeep expiry removes the shop in the
same save; authoritative solo-cloud restores cancel offers exceeding restored stock.
Shared snapshots publish offers and geometry while omitting visitors' access to
private storage and reservation source details. Layouts stream on nearby-set changes,
not every simulation tick. Protocol 6 requires matching client/server versions.
No SQL schema migration is needed for the existing JSON commerce ledger.

Shared construction editing is still unavailable. Commissioned shared layouts are
fixed, self-powered facilities, at most 64 pieces and four bases per account. Doors
stay open; solo power/fuel, health, inventory and free sandbox materials are never
imported into authoritative cargo. Registration validates the existing kit layout;
it does not implement server-side crafting costs or shared base upkeep. This is an
explicit first implementation boundary, superseding the broader upkeep/editing
ambition in the original brief. Offline bases retain normal upkeep and power checks.
Only the six existing trade commodities are supported. Private beacons hide the map
advertisement; a visitor who physically finds the base can still use an open shop.

## Validation

- `npm test`: 147 test files passed after merging current development (32.21 s).
  `/tmp/base-commerce-final-units.log`.
- `npm run test:multiplayer`: 190 pass, two existing opt-in database suites skipped,
  zero failures (6.60 s), `/tmp/base-commerce-final-server.log`. New base tests
  include real room commissioning/deposit, owner-offline purchase, stale revisions,
  command replay, last-unit races and failed commits. The new isolated PostgreSQL
  test ran and passed; its failed foreign-key transaction preserves the original
  ledger, a concurrent last-unit purchase succeeds once, and reopening retains
  exact stock and payment.
- Focused local tests cover partial stock, capacity/credits/reach/owner checks,
  power/closure, failed local persistence, unlisting, source removal and expiry.
  `/tmp/base-commerce-lifecycle.log`.
- `npm run check:repo` passed. `npm run plan:checks -- --base origin/dev/all-features`
  generated the required plan; its wider diff includes already integrated fleet
  changes because that remote base is behind local development. A plan is not QA.
- Production builds passed, with existing large-chunk warnings. Browser builds use
  `VITE_DEV_TOOLS=1` solely to exercise documented initial fixtures.

Failed attempts retained: first server test assigned read-only `shipSpeed`; fixed
the fixture. Initial isolated SQL execution inside the runner aborted in Node
26.7.0 `InternalCallbackScope::Close` (`execution_async_id == 0`); examined its
systemd core with the diagnose-crash skill, no application cause or OOM established.
The authorized outside-runner attempt exposed missing generated Prisma code;
`npm run prisma:generate` and earlier cleanup registration resolved the fixture.
The isolated SQL test then passed. No production database was touched.

First seller browser run reached actual landing, cabin exit, the constructed
terminal, partial listing, pricing and desktop/390px phone rendering. Its map step
failed because the default Bases filter was off. Fixed new-save discovery and own
marker duplication; the final rerun passed. It was an application/fixture failure, not a
Chromium startup crash. Initial screenshots were visually inspected: stock values,
focus and text are legible and the phone panel scrolls without horizontal overflow.
The second run passed native tab focus/held-trigger assertions but its cleanup
attempted to detach CDP after closing that session's tab. Corrected cleanup order;
no application change was needed. Failed evidence remains in
`/tmp/star-agent-base-commerce-attempt01` and `-attempt02`.

Final `npm run test:browser -- -c scripts/base-commerce.config.js` passed both
journeys in 3.1 minutes (seller 1.6 m, buyer 1.5 m), one worker, Chromium
151.0.7922.173, requested ANGLE/OpenGL, seed 7291. No page or console errors.
The seller route physically lands and exits Nomad, accesses the built terminal,
offers 3 SBU/48 kg out of 80 kg, sets 53 CR, publishes the beacon, selects its map
entry, and returns to play. Held RT stays suppressed across dialog exit, real
browser tab focus loss/return, and controller disconnect/reconnect until neutral.
The buyer uses a real local WebSocket room with an offline seller, selects the
shared beacon, lands, walks to the terminal, buys 1 SBU, inspects its cargo,
physically reboards and takes off. Ledger proof: buyer 1447 CR, seller 1053 CR,
16 kg copper retained at the base, zero offered stock, one physical cargo crate.
Existing base/stock and the initial 180 m spawn are fixtures; no pose mutation
occurs after join. All gameplay input is injected standard W3C Gamepad input;
physical controller hardware has not been tested. This is no performance claim.

Final screenshots and JSON receipts are in
`/tmp/star-agent-base-commerce-evidence`: `physical-terminal.png`,
`owner-stock-1440.png`, `owner-stock-390.png`, `base-map.png`, `buyer-map.png`,
`buyer-cargo.png`, `buyer-departure.png`, `seller.json` and `buyer.json`.
Builder visually inspected the terminal, desktop/phone stock, phone map,
buyer cargo and departure: rendered geometry and readable labels/focus, no
horizontal phone overflow. The same existing kit assets are reused. Independent
visual acceptance is not claimed.

Final focused local/room/SQL tests after map-details changes: 10 passed in
1.71 s, `/tmp/base-commerce-final-focused.log`.

## Integration and operations

Latest development merge preserved medium ship inventory hooks and unioned all
normal tests. HANDOFF conflict resolution retained both journals. This changes the
multiplayer protocol: paired local client/API restart is required on integration.
Public release and independent approval are not implied by local testing.

Review screenshots: [owner stock](base-commerce/owner-stock.png), [public map entry](base-commerce/base-map.png), [buyer cargo](base-commerce/buyer-cargo.png).

Final elevator union `f51822f`: 31 focused base/room/SQL/station checks passed in 2.90 s; development production build passed in 3.87 s. The base runtime files match the browser-validated source. The station owner retains its separate keyboard/phone validation limits.
