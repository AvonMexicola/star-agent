# Independent medium-ship input review — closed

Reviewer: /root/nomad_cutter. This review covers root-authored input changes since e6c6018 in `src/nomad-cabin-controls.js/css`, `src/ship-mining-input.js`, and the narrow canvas pointer handlers in `src/main.js` plus the viewport touch-action declaration. It does NOT independently review the keyboard/touch journey fixtures authored by this reviewer. No production files, services or browser sessions were changed here.

**Result: no remaining blocking source/CPU finding in this bounded delta.** Native phone composition, trusted browser gestures and complete gameplay remain pending the separately scheduled browser journeys; this report is not their acceptance or an art score.

## Finding and closure

The first revised canvas drag handler retained a stationary pointer across a dialog round trip. Reproduction: pointerdown ID1 at[10,20]; open and close Commands with another input while ID1 does not move; move ID1 to[30,20]. The retained pre-observer source calls `nav.look(-.04,0)` without a fresh pointerdown. The original source and its hash are retained as `src__main.js` / `reviewed-sources.json`, and this exact failure is re-proven at the start of `probe.mjs`.

Root added a MutationObserver for dialog `open` attribute changes. On the corrected actual source, both open and close clear the drag. The identical round trip produces zero look calls; a new pointerdown then produces the expected .04rad yaw. The new handler also owns one pointer ID, derives touch deltas from client coordinates, rejects blocked/locked/focus-lost starts, and clears matching pointerup/cancel/lostcapture, blur, visibility and pointer-lock transitions. `#viewport` now owns its touch gesture through `touch-action:none`.

## Checks actually run

- `node /tmp/star-agent-medium-input-review/probe.mjs`: **15/15 PASS** with production listener code extracted directly from the source. Tests include two simultaneous cabin movement/ascent contacts with independent release; a secondary Commands/land contact; no stale movement after menu closure; a secondary Stratum ore-button action while the mining contact remains held; immediate stop snapshot with ore mass preserved; and rejection of held touch/repeated T after interruption until fresh input.
- The probe uses explicit EventTarget/DOM stand-ins. It verifies source callback routing, not browser event trust, capture implementation, native click synthesis or CSS layout. The already retained native multi-touch diagnostic is historical supporting evidence, not rerun here.
- `node tests/ship-mining.test.js`: **10/10 PASS**, zero skips,1148.114027ms. This independently verifies the actual cutter's neutral/source/context gate, both real articulated muzzle origins, obstruction, bounded power and atomic ore publication. Log: `ship-mining-tests.log`.
- Initial probe fixture lacked DOM `localName` on its synthetic MutationRecord target, so the first closure invocation failed to call the correct production filter. `probe-first.mjs` is preserved; the stand-in now supplies normal `localName:'dialog'`. That diagnostic error is not a surviving production failure.

## 390px composition audit scope

The mobile Stratum mining panel occupies X12..192; the cabin controls occupy X218..374, leaving26px between their declared boxes. Their 38/44px minimum control heights remain in bounds on the844px target viewport by the authored stacking rules. While aboard the occupied rover, cabin controls explicitly hide and Stratum mining is ineligible/hidden in its walking mode; the rover overlay owns the controls. On the approach, the nonseated rover panel ends at Y494 (`bottom:350px`) and the shorter walking-control stack ends at Y756 (`bottom:88px`), reserving separate regions. The mobile loadout bar sits below the cabin controls and is explicitly hidden when rover-occupied. The inherited player-active topbar/launcher is hidden.

These are static CSS/state-contract findings only. Font wrapping, native bounding boxes, actual element hit tests, HUD readability and all current overlay combinations still require the real390×844 capture. No pixel-perfect fit or full touch acceptance is claimed here.

## Identity and retained evidence

Closure HEAD observed: `e052d234e0ff2dc9e4dab8cc8f7da6d17ab4a252`. Exact closure source hashes: `closure-sources.json`; corrected source snapshots: `current__*`. Main hash at probe and freeze: `32a4ed51f3bd95fe5540c790ca4dc021ec48b726545ecebd155b203604cc6b37`. Initial main hash: `92d56c768af3986b9ea0b90ccf022045e131ef9f1c0aac8e4e04fe84cf2ad40f`. The source-extracted code, frozen first failure, closure outputs and test log remain together in this directory. No GPU/browser launched, no performance claim.
