## Functional review — candidate `/tmp/star-agent-main-integration` @ `dd7aeac` vs `85aa836`

**Verdict: not mergeable yet.** One reproducible functional defect (controller dead-end after a crash) and one process blocker (no test/build evidence exists for the current HEAD). Everything else I found is minor. The integration seams you flagged — the unified ledger, the variable-grid morph, and keyboard/controller binding overlap — are in good shape.

Note on timing: `dd7aeac` ("Unify station controller routing…") landed while I was reading. My findings are against that commit; earlier reads of `system-map.js`/`station-shop-ui.js` were re-checked after it.

### Blockers

**B1 — All three logs predate the code under review.**
`scripts/terrain-lod.test.js` ("mixed 16/32 grids reconstruct the parent surface…") and `tests/station-ledger.test.js` ("unreadable storage blocks changes without throwing…") were added in `dd7aeac` and are absent from the 442-test run, so `/tmp/star-main-unit.log` and `/tmp/star-main-build.log` are from `40ac946`. `/tmp/star-integration-journeys-2.log` is worse: its two failures — `scripts/station-shop.spec.js:72` and `tests/browser/system-map.spec.js:66` — hit exactly the code `dd7aeac` rewrote (`station-shop-ui.js` lost its duplicate `StationShopController` RAF poll; `system-map.js:200` gained button-9 close). Those results neither confirm a live defect nor confirm the fix. QUALITY.md §2 needs `npm test`, `vite build`, `main-integration.config.js` and `main-integration-extra.config.js` (loadout + Atlas Mark II, never run in these logs) re-run on `dd7aeac`.

**B2 — Crashing removes all controller input; RETURN TO ORBIT is unreachable on a gamepad.**
`src/navigation.js:471-472` returns on `mode==='crashed'` *before* `this.gamepad.poll(...)` on line 474 — that is the only poll site for `nav.gamepad`, so `onControllerInput` → `controllerUI.update` never runs. `#crash-panel` is a `<section hidden>` (`index.html:48`), not a `<dialog>`, so the shared dialog router in `controller-ui.js` cannot reach `#crash-recover` either. Keyboard (`O`, `main.js:211`) and mouse/touch still work, so the crash is survivable — just not on a controller. Repro: any hard impact (e.g. the lunar case now asserted at `tests/navigation.test.js:315`) with only a gamepad connected; the pad goes dead and `#controller-status` freezes. Fails QUALITY.md §2 "works with keyboard, controller and touch".

Fix in `src/navigation.js:471`:
```js
update(dt){
  this.engineAcceleration.set(0,0,0);
  const pad=this.gamepad.poll({...});
  this.onControllerInput?.(pad,dt);
  if(this.mode==='crashed')return;
  this.toolTrigger=pad.mine||0;
  ...
```
plus one guard in `src/main.js:245` so D-pad-left does not open the system map while crashed. The command menu already contains "Quick transit · High orbit", which clears `nav.crash` via `transit('orbit')`, so no new action is strictly required — though an explicit `{id:'crash-recover',label:'Return to orbit',enabled:()=>nav.mode==='crashed'}` entry in the `actions` array would read better.

### Should fix

**S1 — Unaffordable/sold-out shop offers became controller-unreachable.** `station-shop-ui.js:41` sets `aria-disabled="true"`; `controller-ui.js:5` filters those out of `controls()`. The removed `StationShopController` used `button:not([disabled])` and included them, which is what the comment at `station-shop-ui.js:40` ("Keep unavailable offers keyboard reachable so their explanation can be read") promises. Fix in `controller-ui.js`: keep `aria-disabled` items in `items` and skip `.click()` in the activate branch.

**S2 — `StationShopController` (`src/station-shop.js:39-53`) is now dead**, but `tests/station-shop.test.js:140` still tests it (it is one of the 442 passes). The shipped shop controller path is now browser-spec-only. Delete both, or re-point the unit test at `createControllerUI`.

**S3 — A corrupt legacy manifest silently bakes 0 credits into the unified ledger.** `ship-inventory.js:61-65` sets `credits=0, persistenceBlocked=true`; `mining/store.js:22` snapshots `legacy.credits` into `state.economy.credits`; then `bindStationLedger` → `syncManifest` (`store.js:99`) overwrites `inventory.persistenceBlocked` with `Boolean(store.blocked)` = `false`. With no mining save present, the first `write()` persists 0 credits permanently, and `purchaseStatus` reports "Insufficient credits" rather than the load error (the error text does still reach `.shop-policy`). Fix: in `MiningStore`, when there is no mining save and `legacy.persistenceBlocked` is true, set `this.blocked = true` and adopt `legacy.loadError` instead of snapshotting zero.

### Minor

- `nav.isMapOpen` (`main.js:208`) and `nav.onControllerMap` (`main.js:209`) are dead — `navigation.js` no longer calls either since the map is opened inline at `main.js:245`. They read as live wiring.
- Fleet has no controller path: `fleet-ui.js:27` is keyboard-only and `#fleet-button` sits outside any dialog. Same class as B2 but preexisting to the fleet branch; the new `actions` list adds power and weapons but not Fleet.
- `docs/qa/main-integration/README.md:50` calls the map failure "an outdated two-body map focus expectation". `dd7aeac` also restored real behavior (`system-map.js:200` now accepts button 9), reinstating the `onControllerMenu` contract that `308fec9` had and the controller-menu integration dropped. Worth recording as a fix, not just a test update.

### Verified sound

- **Variable-grid morph.** `world.js:104-120` accumulates the parent surface in doubles and rounds after interpolation, selecting the parent's actual `b–c` diagonal triangle; index math is correct at both boundaries (level 4, 16→32 and level 14, 32→16). `planet.js:95-99` unions position + parentPosition into the bounds so morphing patches aren't culled mid-transition, and `addTerrainMorph` composes over the current surface shader without clobbering `configureTerrainMaterial`'s closure. The new `terrain-lod.test.js` case asserts all five parent attributes against the parent mesh directly. Pyre morphs separately via `bindParent` reading the parent's real position attribute with its own grid pair; Selene has no morph at all (pop only) — preexisting, not regressed.
- **Ledger atomicity.** `MiningStore.write` (`store.js:79-92`) compare-and-swaps on `persistedRaw` and commits `this.state` only after `setItem` returns; `bindStationLedger` routes purchase/transfer/transferAll/persist through that one write, so credits, shop stock, warehouse, cargo, cuts and loadout share a single commit, and `blocked` gates all mutation. The `dd7aeac` `supplies` normalization correctly prevents `supplies.station[itemId]` from throwing on migrated saves; the ITEMS keys it fills are all present in `CATALOG` with `unit:'item'`, so `validContainers` still passes.
- **Input partitioning.** `KeyG` is cleanly split between EVA (`navigation.js:48`) and Fleet (`fleet-ui.js:27`) with complementary guards — no overlap, no gap. `KeyT`/`Digit1-3` are split between on-foot (`mining/tool.js:33`, gated on walk/eva via `active`) and ship weapons (`flight-effects.js:20-24`, gated on `mode==='flight'`). D-pad-left is map in flight vs cycle-equipment on foot. Quick slots on 5–8 keep 4 for the external camera. I found no double-binding.

I treated the stated preexisting limitations as out of scope and did not count them against the candidate: Atlas Mark II as inspection studio, the live Atlas untouched, the unwired landing-gear solver source, and the excluded dirty station/equipment work. Visual review is separate — I made no rendering-quality judgement and took no screenshots.
