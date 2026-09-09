# Starter tractor verification — 9 September 2026

A fresh solo or multiplayer backpack contains one3kg cargo tractor. The original mining laser remains in the Tool slot. Assigning the tractor to that slot enables the existing cargo beam and model; swapping or holstering releases its lease. Online equip/restore accepts the owned standalone tractor, and the existing authoritative cargo gate accepts it alongside the older mining-multitool utility.

Saved inventories retain their exact quantities. No new slot, save schema, item refill, model, dependency or controller binding. The existing inactive-tractor drive-entry fix is preserved. The user guide describes fresh inventory behavior and the Cargo utility route for older profiles.

Validation:

- Full configured `npm test`:165 test files pass. Loadout tests exercise finite starter count, atomic swapping, saved equipped tractor, transfer to ship without refill, and unchanged older inventories.
- First full run failed the medium-ship mass assertion because its old expected backpack mass excluded the new3kg tool. The fixture expectation now includes its real catalog mass; all four medium inventory checks and the full rerun pass.
- Final focused multiplayer suite:63/63 pass. Checks cover owned equip, restore, no ammunition fire, missing-item rejection, authoritative tractor cargo, hub/passenger neutral gates and isolated PostgreSQL persistence. The first run had62/63 pass: the new test expected an empty hand after reconnect, while existing reconnect behavior selects the owned rifle. The corrected assertion checks that the absent tractor cannot be restored; no reconnect runtime change.
- Production browser01 passes1.1m (1.4m with build), Chromium151.0.7922.173, ANGLE GL launch backend,1440×900 desktop and390×844 phone. All movement, loadout selection, beam use, interruption gates, securing and return to mining use an injected standard Gamepad. A2SBU shipment is the only preloaded cargo fixture; no post-launch player/cargo teleports. Zero page/console errors. Screenshots inspected; the existing handheld tractor and green beam are visible in the game renderer.

[Controller receipt](controller.json), [Tool-slot selection](starter-loadout.png), [active beam and crate](nomad-tractor.png), [phone cargo](tractor-cargo-phone.png). Full raw browser evidence and logs remain under `/tmp/star-agent-starter-tractor-evidence-01`, `/tmp/star-agent-starter-tractor-results-01` and `/tmp/starter-tractor-browser-01.txt`.

The isolated feature was advanced over locally integrated marker styling `d3f8a06` without overlapping runtime edits. The tractor journey ran before that unrelated marker merge; final combined build and focused integration tests are recorded with local delivery below. Physical-controller/hardware-touch testing, independent acceptance and public deployment are not claimed.

Final combined production build passes (`main-z4xFCVwp.js`,4.49s; inherited large-chunk warning). Five affected source test files pass after the marker merge. Repository and whitespace checks pass.

Runtime `1c29454` is integrated into local `dev/all-features`. The existing managed
preview/API service was refreshed with its persistent database configuration.
Six served module checks, ten tested-file byte comparisons and both5178/8087
API health routes pass; [local receipt](local-integration.json). An initial served
probe expected a space after `clearLoadout:`; the source intentionally preserves
its compact formatting. Correcting only the probe passed. Original534183-byte
shared HANDOFF was preserved exactly before the delivery append. Owned private
browser/preview processes have exited. No public deployment.
