## Follow-up — fixes since `dd7aeac`, runtime frozen at `0ab1854`

Confirmed `git diff 0ab1854 a20ca1e -- src/ index.html public/ package.json vite.config.js` is empty: `a20ca1e` is docs + the two recovered Pyre cases only. I re-read only the 9 runtime files touched by `0ab1854`.

**All four findings are fixed correctly. No new functional defects.**

- **B2 — resolved.** `navigation.js:471-475` now polls and calls `onControllerInput` before the `mode==='crashed'` return, so `toolTrigger` and all gameplay branches still stop while the pad stays live. `main.js:242` adds `{id:'crash-recover', enabled:()=>nav.mode==='crashed'}`, and the D-pad-left map shortcut was narrowed to `nav.mode==='flight'` so a crashed ship can't open the map. Verified the reachable path: `add()` sets `nav.enabled=true` and closes the menu synchronously before `callback()`, so `transit('orbit')`'s `!nav.enabled || dialog[open]` guard passes.
- **S1 — resolved.** `controller-ui.js:5` drops the `aria-disabled` filter from `controls()` and line 82 refuses `.click()` on `aria-disabled="true"`. Sold-out/unaffordable shop offers are focusable again so their reason is readable, without becoming activatable. Real `disabled` menu entries are still excluded by the `button:not(:disabled)` selector, so the enabled-gated actions behave as before.
- **S2 — resolved.** `StationShopController` and its `GamepadInput` import are gone from `station-shop.js`; `grep` finds no residual reference in `src/`, `tests/` or `scripts/`. `nav.isMapOpen` / `nav.onControllerMap` (my N1) were removed too.
- **S3 — resolved.** `mining/store.js:29` returns early with `blocked=true, saved=false, warning=legacy.loadError` when there is no mining save and the legacy manifest is unreadable, so 0 credits can never reach a `write()`. `syncManifest` then propagates `persistenceBlocked` to `purchaseStatus`.
- **N2 (Fleet controller reach) — also resolved** via `fleet-ui.js` exporting `openMenu` and the new `{id:'fleet'}` action.

**Held-tool origin fix is correct and was a real latent bug.** `mining/tool.js:50` now adds `nav.position - origin` to `mount.position`. Since `muzzleWorldPosition()` returns scene-space + `_renderOrigin` (`equipment.js:666`), the muzzle, the obstruction raycast and `effects.fire`'s start point were all offset to the camera rather than the player whenever `origin !== nav.position` — i.e. in external/third-person view. Now consistent in both.

**System map marker separation** (`system-map.js:72-88`) displaces only the selection buttons, draws leader lines to true positions, and leaves `map-zones` circles and route paths on the projected centres. Focus-ring order is unchanged, so the controller spec's ordering assumptions hold.

**One behaviour narrowing worth recording, not a defect:** D-pad-left no longer opens the map in `landed` mode (it used to, via `mode!=='walk'&&mode!=='eva'`). It remains reachable there through Menu → Controls and help → SYSTEM, and keyboard `M` is unchanged.

### Evidence read
- `star-main-acceptance-unit.log`: 445 tests, 445 pass, 0 fail. `star-pyre-recovered-tests.log`: 9 pass, 0 fail (includes both recovered cases). `star-main-acceptance-build.log`: built in 4.63s, only the pre-existing >500 kB chunk advisory.
- `star-main-acceptance-browser.log`: **15 passed (5.4m)** — complete, including `integration-recovery.spec.js` and the two cases that failed on the stale pre-`dd7aeac` run (`station-shop.spec.js:72`, `system-map.spec.js:66`).
- `integration-recovery.spec.js` is a real acceptance, not a shortcut: it crashes via `advanceFlight` (assist off, −100 m/s into forest terrain), waits for `mode==='crashed'`, then drives Menu/focus/A entirely through the injected pad with no DOM click or state mutation, and asserts the wreck position is left behind.
- `star-main-acceptance-extra.log`: **still running — 3 of 7 passed** (three Atlas Mark II cases); the four loadout/equipment cases have not reported yet. Those exact specs passed 7/7 in `star-main-extra-browser.log` against unchanged code, so this is outstanding validation, not a known defect.

### Source verdict

**Functionally mergeable.** All B2/S1/S2/S3 findings are closed at source, unit + build + the 15-case core browser suite are green against the frozen runtime, and no new issues surfaced in the changed files. The only functional gate left is the tail of `main-integration-extra.config.js`; if those four cases land green the functional review is complete. Art/performance remains the PM's separate visual gate — I have made no visual judgement.

---

Integration runner completion after the reviewer returned: the same acceptance
extra run finished **7/7 passed (2.9 min)**. Its remaining four cases are green,
satisfying the reviewer's functional condition. The final aggregate unit rerun,
including both recovered Pyre tests, finished **447/447 passed**. This completion
note is from the integration agent, not an additional Opus visual judgement.
