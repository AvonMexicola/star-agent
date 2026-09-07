# Community hub browser fixture — bounded CPU audit

Result: **no further routing/state mismatch found in the revised fixture**.
The initial native-focus blocker is corrected at source level. Root can freeze
the candidate for the browser replay; this audit does not claim that replay
passed. No production file was edited and no browser, GPU or server was launched.

Reviewed worktree: `/home/cees/projects/star-agent-community-hub`.
Reviewer: `/root/nomad_cutter`.
Revised `scripts/community-hub.spec.js` SHA-256:
`f385ada5d3736cb2200a39d949b4aac6fe53780dd212487e88f7b2ed0e0efc00`.
`tests/browser/station-market-route.js` SHA-256:
`30567a99386a1dc7cfa721dff49f2ae1121372671b316dbf1bb74461acfb8d7a`.

## Finding and correction

The first inspected version's focus phase opened another page and called
`bringToFront()` while leaving Playwright's focus emulation enabled. The installed
`node_modules/playwright-core/lib/coreBundle.js:37638` enables that override for
each ordinary main frame. The existing plain-DOM Chromium 151 receipt at
`.mining-rover-qa/native-input-diagnostics/focus.json` shows both pages remaining
focused and no blur under those defaults. Waiting for `state.focused === false`
would repeat the earlier rover fixture failure.

Root's revised lines 59–78 disable the override on both sessions, establish game
focus and fresh neutral before holding RT, assert a new trusted blur and focus,
check the held gate across return, then release and restore the overrides in
`finally`. This matches the previously demonstrated native mechanism. Actual
community-scene execution remains for root's next run.

## Remaining contracts checked

- D-pad right reaches the online inventory through `main.js`'s `toggleTool`
  binding. The revised fixture correctly asserts that modal and closes it before
  walking. Equipped weapon comes from the own multiplayer player, not inventory.
- Trade uses the current `view-buy`, `size-2`, `purchase-basalt`, `view-cargo`,
  `sell-<crate>` and `size-1` keys. Basalt is on the first resource page; the
  current UI's stock text and `· <integer> CR` labels match the helper's parsing.
  Trading state actually provides `marketTerminals`, `markets`, `account`,
  `owner` and ship manifests. No substitute wallet/state is assumed.
- The chosen North exchange approach is 1.6279017169 m from its registered
  screen centre, within the 2.8 m client/server reach. Hub purchases can target
  the owned Nomad still parked in its leased berth under `stationedForTrade`.
- Hub return point `(0, -6.25, 15.95)` is in the real elevator cabin: floor -8,
  eye height 1.75, door z14.3, cabin interval z14.95–17.4. Destination button keys
  and snapshot frames `station:hub` / `hangar:<id>` match current services.
  Arrival releases navigation only after the authoritative opening phase.
- Generic close now verifies zero open dialogs and enabled navigation. The
  gamepad's modal, disconnect, replacement and unsupported-mapping paths all
  retain `armed=false` for held RT and rearm on neutral. The device interruption
  cases do not claim a network-session disconnect.

## CPU receipt and limits

A pure-module probe passed against current modules: modal held gate; controller
disconnect/replacement/unsupported gates; registered terminal distance; actual
two-SBU purchase and sale; and the return-cabin predicate. At initial stock 1024,
the buy costs 41 CR and the sale returns 24 CR. Stock returns to 1024, credits to
1483 and the Nomad grid to empty, matching the helper's assertions. The pure
commerce probe supplied trusted reach/docking callbacks and is not a physical
access test.

No additional code blocker was found. Pixel overflow, real walking/collision,
native focus events in the game and asynchronous UI timing still require the
browser run. The touch branch currently performs no held-trigger/interruption
phase; do not report that coverage for touch. The keyboard Digit3 assertion
confirms continued stow inside the hub, not a complete exercise of every selection
route. The relevant central policy tests remain separate from this fixture audit.
