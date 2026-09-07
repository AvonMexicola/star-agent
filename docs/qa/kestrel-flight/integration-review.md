# Independent Kestrel integration source review

Read-only CPU review in `/tmp/star-agent-kestrel-flight`, 7 September 2026. Reviewed integration changes in `main.js`, `kestrel.js`, `fleet.js`, `fleet-ui.js`, `navigation.js`, the MFD profile, inventory capacity enforcement and flight effect guards. Parent owns production changes. No GPU was used and no visual or full input-path approval is claimed.

No unresolved high-impact defect was found in the bounded source scope after the latest Kestrel visibility correction. The boarding geometry audit is separate in `access-review.md` and `.json`; its articulated-body and terrain limitations still apply.

Re-run the additional independent harness with `node docs/qa/kestrel-flight/integration-audit.mjs`. `integration-audit.json` records source hashes, assertions and MFD snapshots. The harness extracts the actual selection callback from `main.js` without changing its body. It supplies controlled model-loading and station dependencies to exercise rollback and asynchronous state changes. It also instantiates the actual Kestrel adapter against original GLB geometry with only image references removed; a stub canvas context lets it inspect page data without claiming rendered text quality or shader compilation.

All six CPU cases passed:

1. A rejected Kestrel model load keeps the existing model, navigation ship ID, capacity and fleet selection unchanged. It does not save a new selection. The failed model is removed/disposed, and a later successful retry selects Kestrel, its pilot eye, gear and zero cargo capacity.
2. Supplies added during the awaited model load cancel the selection.
3. Minerals added during the awaited model load cancel the selection.
4. Leaving landed mode during the awaited model load cancels the selection.
5. The live adapter samples supplied canopy/ladder/gear progress, enables authored cones at full engine acceleration, and reports actual speed, AGL and moving gear on the MFD pages. Four size-2 mounts remain empty.
6. Power-off removes the authored afterburners and immediately updates emergency access/no-cargo MFD pages, without waiting for the usual 5 Hz interval.

Save isolation was additionally traced through source: `testFlightStorage()` creates a fresh in-memory map, and that object is passed to Fleet, ShipInventory, MiningStore and graphics settings. A repository-wide source search found the only direct browser localStorage access in the regular-session branch of `main.js`; the practice branch does not evaluate that access. The shared mining/commerce ledger receives the same session storage. This source review complements, rather than replaces, a browser test retaining pre-existing real save values.

Kestrel's zero hold capacity is enforced in both supply and mineral destinations. Fleet selection rejects either kind of existing ship cargo before and after asynchronous model loading. Inventory UI excludes the nonexistent ship container. The flight effects adapter blocks Kestrel weapon emission independently of whether controls are visible and omits the generic Nomad engine emitter. The actual GLB socket metadata still states no installed weapons.

One presentation defect was reported during review: the inherited visibility condition hid the whole ship in flight when pointer lock was absent, no controller had been used, and the camera had never been toggled. That is reachable directly from the seated practice start, especially on touch devices. Parent subsequently added the explicit Kestrel flight visibility condition. The current source closes that condition; a fresh hardware capture should verify it.

Minor inherited wording still refers to leaving the seat in the powered-off flight HUD and to a rear ramp when disabling EVA above terrain. Kestrel's actual interaction methods correctly reject an in-flight exit, so these are misleading hints rather than a functional escape or cargo path.

Remaining review scope: independent production-browser evidence for desktop and phone framing, readable cockpit pages, actual input progression, shader/console health and normal-save preservation. This CPU report is not a fleet-wide certification, surface collision mesh certification, or final merge approval.
