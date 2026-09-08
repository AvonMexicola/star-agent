# Independent pointer-capture review

Disposition: the scoped touch-click pointer-lock defect is closed by the reviewed source and the separately recorded native probe. No remaining blocker was found in the capture paths examined. This is not approval of the full Stratum touch journey, responsive HUD, or medium-ship lamp implementation.

## Identity and scope

Reviewed root worktree: `/home/cees/projects/star-agent-medium-integration`, original commit `961018787dc87ff82b8c857f37bc9791b8de6c60`, followed by the uncommitted capture patch. Original `src/main.js` SHA256: `6752f176965e072eaf536909acff79626251a3a58f649c4f830e88a1c3170b4f`. Patched SHA256: `6afa49e2125ce58a7545979b2df97bc6957ce8c1d269e5ec665ef4d68c0362dc`. The patched source was unchanged across the final CPU runs. Unchanged `src/navigation.js` SHA256: `dbdb4e62c7400416cbc9f63f027d16447f8cc21aff7c74730b5e97bfc2ee2efa`.

The reviewer authored only a new permanent regression in an isolated temporary package. No production source, browser, GPU, service, or shared worktree was changed by this review.

## Findings and closure

The original background capture function unconditionally called `nav.capture()` after entering the player interface. A short touch gesture could produce a native click and request pointer lock. The unchanged drag handler then refused subsequent touch movement because `nav.locked` was true.

The patch skips that request when either the event has `pointerType === 'touch'` or legacy/compatibility provenance reports `sourceCapabilities.firesTouchEvents`. It retains mouse capture on a touch-capable device and deliberate keyboard/no-event entry. `activateMFD` remains first, followed by the same transit, enabled-navigation, and opening guards. `enterPlayerInterface` is byte-identical. Canvas/Begin event registrations and the complete drag closure are byte-identical.

The review identified a second necessary call-site correction: Help Fly discarded its click event by invoking `capture()` without it. It now forwards the event after `closeHelp()`, preserving modern and legacy touch provenance. Intentional no-event calls also previously dereferenced `event.clientX` in powered flight; the new finite-coordinate guard prevents that error and prevents malformed coordinates from reaching MFD ray picking. All remaining MFD behavior is byte-identical.

Capture entry points examined were canvas click, Begin click, the generated Kestrel launch button, and Help Fly. The first three already pass the registered event; Help Fly now does too. The real `Navigation.capture` method retains its enabled/crashed guards and pointer-lock failure handling.

## Permanent regression and actual results

The sole import path is `tests/pointer-capture.test.js`, staged at `package/tests/pointer-capture.test.js`. It reads the real main source using `new URL('../src/main.js', import.meta.url)`, extracts the unmodified capture/MFD/interface/drag closures and event registrations, and also extracts the actual Navigation capture method. An optional `POINTER_CAPTURE_SOURCE` override exists for replaying the preserved original source.

The test uses genuine Three.js scene geometry and ray picking against a test display, including an actionable parent node. Browser services and input events are controlled doubles. A counting wrapper delegates to the genuine raycaster to prove invalid coordinates never reach it. The cases cover the native receipt's short-touch-click/next-drag sequence, both independent touch provenance fields, mouse and keyboard/no-event entry, invalid coordinates, unavailable states, actual MFD hit consumption and pick guards, Help Fly forwarding, Begin/Kestrel registrations, and idempotent interface entry.

Final executed results:

| Run | Result |
| --- | --- |
| `node --check tests/pointer-capture.test.js` | Exit 0 |
| Direct node run against preserved original main | Exit 1; 13 grouped cases, 4 pass / 9 fail, 33.994108 ms |
| Direct node run against patched main | Exit 0; 13/13 grouped cases pass, no skips, 45.754834 ms |
| `node --test --test-reporter=tap tests/pointer-capture.test.js` | Exit 0; this runner reports one successful file-level subtest, 133.4704 ms |

The initial test setup incorrectly expected positive zero for a zero vertical drag; the real source emits negative zero. That assertion-only setup failure is retained as `setup-negative-zero.test.js` and `setup-negative-zero.log`. Expectations were corrected to the exact source result. No runtime behavior or threshold was weakened. A later test-only delta added the delegating raycaster spy and explicit no-pick assertions; the final negative, positive and discovery receipts were regenerated after this change. Earlier receipts are superseded, not erased.

After importing the file, run `node tests/pointer-capture.test.js` or include it once in the normal test command. Original-source replay is `POINTER_CAPTURE_SOURCE=/tmp/star-agent-touch-capture-review/original-main.js node tests/pointer-capture.test.js`.

## Separately inspected native evidence

Root owns and ran both native probes; the reviewer inspected their receipts without launching a browser.

Original `/tmp/star-agent-stratum-touch-look-01/receipt.json`, SHA256 `97dd3a37984ba401aa99c559254f34f6e4fa5db56d19d099d406aab83c9353c4`, records a trusted 6 px touch gesture emitting a viewport click with both touch provenance fields, locking the viewport and preventing meaningful orientation change from the later 80 px drag. It reports `REPRODUCED` and `errors: []`.

Corrected `/tmp/star-agent-stratum-touch-look-02/receipt.json`, SHA256 `405fbfb292e53a88b413e9ceb8fbb856011855f9db5a71a81b781456829ca67e`, records the same trusted 6 px touch-click shape staying unlocked, then a trusted 80 px drag changing actual orientation by `0.05063895194945938` while unlocked. A subsequent trusted native mouse click still locks the viewport. It reports all checks true, `PASS`, and `errors: []`, against main SHA `6afa49e2…`. Root reported runner exit 0 and build-11 asset `main-Bl7F_107`. No claim is made that these receipts collect warnings or certify the complete touch gameplay route.

## Frozen packet

| Artifact | SHA256 |
| --- | --- |
| `package/tests/pointer-capture.test.js` (11,793 B; new file) | `efc109eb50954fcc695d6be69f8cdb17e1bc55051a317bdee7519dcf4eda244c` |
| `regression-receipt-final.json` | `44d6feef2331fc987a9383d4d57210543be8d58828305a7db06e2daa193ccb48` |
| `manifest.json` | `5c0258d468abbb3e5575e5efff87b993086e60d13718c55ac517bdb293998c7c` |
| `pointer-capture-regression.tar.gz` (4,068 B; one allowed test path only) | `2a6912af49922612d32c935d342012ca736019ba31891d90fc6e72b7dbffd59e` |

All packet paths are relative to `/tmp/star-agent-touch-capture-review`. The package's local source/dependency symlinks and temporary package configuration are excluded from the archive.

## Limits

CPU event objects are not trusted browser events; browser pointer-lock, DOM and mutation delivery are doubled. The real Three raycaster intersects a purpose-built test display, not a ship GLB. The drag test confirms dispatch through the actual handler to `nav.look`; it does not model flight physics. These limitations are complemented by the separately labeled root native probe, not hidden by it. Extraction guards fail loudly if the relevant source boundaries change. This review does not approve unrelated responsive CSS, full gameplay, visual presentation, performance, or the reviewer's own lamp code.
