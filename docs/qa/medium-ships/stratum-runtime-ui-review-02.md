# Stratum cockpit/UI correction — independent scoped review

**No blocker found in the reviewed camera, diagnostic getter and mining-panel delta.** The actual corrected desktop pilot and mining captures close the previous clipped lower MFD rows. Portrait per-display inspection remains pending. This is a runtime/UI review by `/root/nomad_cutter`; I do not independently score my own Stratum authored art.

Reviewed root's delta from `7664b19`, subsequently frozen by root as source `4650188` / build06. Exact reviewed file hashes:

- `src/main.js`: `4c30cd4bb2b73feaf3f76f38a680cfad6291ad481f9025b92a76ad0be78b0d3b`
- `src/ship-mining.css`: `ba92e62620f3d4662250742fe7fcdb6b1061c497bf44bb099da214da0891b547`
- Actual geometry used only for eye/display projection: Stratum `b2660a8e400c7ae64ed75cf3e4166d66f1953f0fb6dcbcce5357b1edaa37eb3e`.

Supporting source hashes and unchanged snapshots of the two reviewed dirty files are preserved in this review directory. No production edits, browser/GPU launches or server changes were made.

## Source and CPU findings

The camera starts each frame from `ShipCamera`'s current position/quaternion, then applies a local X rotation of −0.12 rad for the seated first-person Stratum view. This points the camera downward while retaining the exact physical eye. It cannot accumulate between frames. Neither navigation/ship attitude nor the mining direction is changed: the mining adapter still derives sight from `nav.orientation`, then uses the real articulated muzzle directions and obstruction checks.

The reticle offset has the correct sign and projection. At 66° vertical FOV, unchanged nav-forward projects to approximately 40.72% of viewport height. A source-extracted CPU probe passed **27 ship/mode/orientation cases**, including three arbitrary attitudes and a 25-billion-metre camera origin. The eye/origin and navigation quaternion remain unchanged. Kestrel retains its exact 0.14 rad/76° branch; Gannet/Nomad, walking, external views and the actual rover-occupied walk mode receive no new tilt.

The new diagnostic camera orientation is a returned array, not a mutable quaternion reference. The mining-save getter is available only through explicit dev/debug access, reads the existing adapter using `MINING_KEY`, and returns its committed string without parsing or mutating storage. Five CPU cases passed: no read outside the diagnostic gate, practice-memory/sandbox/browser adapter identification, exact returned bytes and safe read-error reporting. This does not itself prove a successful gameplay transaction.

Projection of the **actual decoded GLB display vertices**, from canonical eye `[0,2.9,-5.8]`, puts all four display faces inside 1440×900 after the tilt. Combined bounds are X 22.24..1417.76 and Y 596.86..833.93. This is a geometry/projection result, not a shader or CSS render test. The same source-derived projection at 390×844 clips the physical four-face row horizontally, as expected from its aspect ratio. Acceptance should inspect each display through the intended reachable on-foot/look route; simultaneous four-face fit is not required. Ensure the mining/cabin overlays do not cover the selected face in those forthcoming views.

The compact CSS is scoped to `#ship-mining`; it does not change input handlers or other ship/rover controls. Both buttons have a 44px minimum height and can grow for wrapped active text. At 390px the mining panel's X 12..192 and native cabin controls' X 218..374 leave a 26px gap. Actual text wrapping, touch reach and per-display composition still require the phone capture.

One **nonblocking conditional layout concern** remains: the desktop mining panel now starts at Y392, while the demonstrated idle combat HUD ends near Y381. `space-combat.js` supplies a two-line selected-target string instead of the idle one-line string, and its target row uses 19.8px line height. That state can exceed the 11px clearance and overlap the new fixed panel position. This was not present in the examined mining captures. If Stratum displays a selected combat target, place the panel relative to the HUD's actual height or provide a compact state that preserves both; do not assume the idle screenshot covers that state.

Executed CPU command: `node /tmp/star-agent-stratum-runtime-ui-review/probe.mjs`, **exit 0 / PASS**. `probe.json` retains all 27 camera cases, five getter cases and 16 old/new viewport/display projections. Root separately reported production build06 PASS in 5.02 seconds; I did not rerun the build or full suite.

## Actual images examined

Original failure: `/home/cees/projects/.medium-ships-qa/stratum-controller-01/00-settled-stratum-landed-pilot.png`.

Corrected full 1440×900 originals under `/home/cees/projects/.medium-ships-qa/stratum-controller-02/`:

- `00-settled-stratum-landed-pilot.png`: all four complete MFD data rows are visible, the mining panel is above the Flight content and the forward central sightline has no opaque brace. The eye/projection CPU result agrees with this actual image.
- `04-real-twin-mining-cockpit.png`: both visible cutters converge near the compensated reticle. The mining panel and MFD both show cutting and 0.11 kg; the wrapped active button slightly increases panel height without hiding the Flight data. This is an image-consistency observation, not an independent ore-persistence test.
- `06-cockpit-cutter-status.png`: the beams have stopped, panel/MFD show standby and 0.62 kg consistently; the full MFD row remains readable.

`images.json` records exact hashes and byte sizes for the four unedited images. Root supplied these actual production-browser captures; I inspected them without resizing/cropping/editing. No FPS, continuous motion, full controller journey or physical-hardware claim is inferred from stills or their HUD counters.

This narrowly closes the desktop framing/UI correction. Native 390px per-display views and the complete input/transaction journey remain separate pending evidence. The independent reviewer of Stratum art retains responsibility for its geometry/material score.
