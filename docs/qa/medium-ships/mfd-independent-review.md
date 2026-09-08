# Independent source/CPU review — medium MFD inventory correction

**PASS for the bounded source/CPU scope. No new blocker found.** The exact final13 missing-mass case now produces `BACKPACK: 1.5 kg` and `SHIP STORAGE: 136.0 kg` from the live canonical container. The original game review remains frozen at changes requested until fresh native images verify the corrected display.

Reviewer: `/root/nomad_cutter`, discoverer of the original omission and independent of this fix. Candidate declared by root: `3cf80ad`, build17 `main-UzszgUIJ`; the subsequent development-enabled build does not change this source review. All four Mendel-authored files match `/tmp/star-agent-medium-mfd-author.manifest.json` exactly. Root's main adapter wiring and normal test entry were also read and pinned. No production write, browser/GPU run or asset load was performed.

## Exact scope and identities

| Path | SHA-256 |
| --- | --- |
| `src/medium-ship-inventory.js` | `d4575851eb23914751e9dad97550bf08fe408be36bdb393fd133f382daf1640c` |
| `src/ship-mfd.js` | `b7698357697300f97f174021fe9745e9eccefe44b408a0d3d12c0120f2bb331d` |
| `src/medium-ships.js` | `ab79cf62ccce0ae55d1e1ca16736ba009d8a5e055406bef84068a4d9b08c26c1` |
| `tests/medium-ship-inventory.test.js` | `c95599e25b38e9c09174e0ff640bd9702a5d3ef9fd5bb7debdb8a8bb55bc89c0` |
| `src/main.js` | `ddab737f2cfdf850e69c786045b156aafd48e2ca97382bdd9dfa3448bae895de` |
| `package.json` | `7e6075710da246368239f6a55ee9949ab303eb304544beeb84911ef84cc7cd20` |

`/tmp/star-agent-medium-mfd-independent/identity.json` includes byte sizes and six additional relevant store, catalog, legacy inventory, inventory UI, client and Gannet-loader pins. All 12 hashes remained unchanged before/after the independent probe. The shared MFD's original source was reconstructed by reversing only the authored formatter delta and verified to the exact original SHA `c35f6319…eb4e4` before comparison.

## Findings and verification

- **Canonical totals count once.** `MiningStore.container()` already composes supplies, processed materials and ore. The adapter calls the canonical `itemMass()` on that object, without adding `legacy.mass()` again. Catalog IDs are unique. An independent real in-memory store reproduction commits exactly the final13 `0.5431160913443113 kg` basalt into the rover bin, transfers it into the backpack, and claims the actual construction grant. The real MFD formatter gives 1.5 kg backpack and 136.0 kg ship storage; supplied mass is not duplicated.
- **Live read-only binding.** The adapter captures the store object and calls `container()` at each read. Main creates it after `MiningField` and before the UI binds the manifest; it reads later commits correctly. No item snapshot is cached and no ledger method is exposed. The probe verifies that displaying leaves storage bytes, state identity and write count unchanged; the same adapter observes a subsequent transfer, and a real rejected storage write leaves its displayed totals at the prior accepted values. The immediate Gannet power-off repaint retains the canonical total.
- **Separate capacities and contents.** The displayed aggregate has no false `/20`, `/240` or `/960` denominator. Resource and supply limits remain in the unchanged store/UI. Stratum's dedicated 9.50/384 kg ore bin is not added to general ship storage; its 32 SBU freight footer remains separate. The actual Stratum display closure was exercised with power on and off. No mass for worn equipment or SBU packages is invented.
- **Narrow main selection.** Source-executing the actual `ship.updateDisplays(...)` call with five hull IDs and connected/disconnected states verifies all ten combinations: only offline Gannet/Stratum get the adapter. There is one construction and one normal test-list entry. The Gannet loader forwards that argument into the shared MFD; the Stratum wrapper uses its optional readout directly. Client `connected` and Navigation's multiplayer state are published from the same client state. The adapter does not introduce a second online inventory source.
- **Legacy and online preservation.** Independent old/current MFD snapshots are exactly equal across 24 combinations: four profiles, two power states, and offline/direct/wrapped connection forms with the unchanged legacy argument. Connected direct and wrapped states bypass a deliberately throwing local `massReadout`, including power-off. Powered-on server cargo still reads the server container and capacity.

One inherited limit is retained explicitly: **the shared online power-off storage page already reads the legacy inventory mass rather than server cargo.** The exact old/current comparison reproduces that unchanged behavior. This fix does not repair or worsen it, and this review does not certify truthful online power-off storage. Medium hulls are currently gated to solo play by main; the scope here is the offline medium correction and preservation of existing other-hull behavior. Root may track the old online display issue separately.

## CPU receipts

- `node --test tests/medium-ship-inventory.test.js tests/ship-power-support.test.js tests/multiplayer-ui.test.js`: **3/3 test files PASS**, exit0, 198.780377ms reported by the host tool. This includes the new four-case file and existing power/multiplayer checks; it is not the full suite.
- `node /tmp/star-agent-medium-mfd-independent/probe.mjs`: **six independent cases PASS**, including 24 original/current comparisons and ten actual-main binding cases, Node26.7.0. Exact records: `/tmp/star-agent-medium-mfd-independent/probe.json`.
- The first independent probe failed because its synthetic Kestrel *studio* nav fixture lacked `previewProgress`; the production source was unchanged. The incomplete probe and full failure are retained as `probe-attempt-01.mjs` and `attempt-01.log`. Adding the studio's required preview fields to the CPU fixture produced the passing result. No application failure or source fix is inferred from that harness error.

The probe uses real store transactions and real canvas MFD formatting with a minimal CPU canvas stub. Only the narrow main call and Stratum display closure are source-extracted to avoid unrelated scene/model startup. The original game receipt and builder's negative reproduction are not overwritten.

## Limits and next gate

No source finding remains for this bounded delta. The root-owned collection-mote and marker corrections are outside this audit, even though their current main file shares the pinned hash. Normal-suite/build results remain root receipts, not this reviewer's runs. No native screen readability, shader, GPU cost, timing, keyboard/touch/controller journey, live save reload or multiplayer journey is certified here.

Fresh actual-game Gannet pixels must show the post-transfer MFD matching the canonical contents before G13-GAME-01 and the original game visual disposition close. No visual score is changed by this CPU PASS.

Repository copy: local raw-receipt links are expanded above. The frozen original report is `/tmp/star-agent-medium-mfd-independent/review.md`, SHA-256 `b8f312b0c6bc6add5de2e67d77a00472ccef2d68628a1d304041ea1455585129`; its findings are unchanged.
