# Burrow candidate 10 — scoped final phone follow-up

**Phone controls and inventory composition: scoped PASS.** The completed touch record corroborates the return journey and held-contact input gates. The raised physical MFD footer is **not visually closed by these phone images** because the touch panel covers it. Native static **4.04/5** and the independently inspected keyboard motion **3.8/5** remain unchanged; their explicitly mixed-evidence six-criterion mean remains **4.00/5**.

Reviewer `/root/kestrel_reviewer`, 2026-09-07. I inspected the four supplied PNGs, `journey.json` and `native-input.json` in `/home/cees/projects/.mining-rover-qa/input-04/touch/`. I did not run a browser, edit production, or inspect the new phone video. The parent's reported 4.9-minute full-route PASS is corroborated by the endpoint/milestone assertions; it is not a second independently observed motion score. Previous native and keyboard reports and their failing images remain unchanged.

## Identity and observations

Parent identifies frozen runtime `e7e297b`. Before/after source hashes agree in the evidence. GLB SHA256 remains `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`; layout remains `2d3912564b0cd16d212ae47fa528d475cc93a2941dcbdce10cbbad3b1e231a38`. Recorded `src/mining-rover.js` is `c725454f47b445085c6e3b2c310fa064127ad8b8ffff0a86e791101a5d226d66`.

- **02-enclosed-cockpit.png:** the 390×844 portrait controls have distinct drive, aim, cutter, exit, lift and inventory targets. Charge, ore and speed are readable. The forward view occupies the upper screen. The opaque control panel at approximately X22–382/Y479–777 covers the physical MFD and its footer; only a cut-off strip of the instrument remains visible at the left. This is a usable touch-control presentation, not evidence that the physical instrument is fully legible on a phone.
- **04-real-twin-mining.png:** both mint beams converge on the target above the panel, with an active-cutter status and increasing mineral amount. The panel still hides the emitter roots, so this image does not independently measure exact barrel-origin alignment. The Atlas background includes strongly exposed lamps; it is not a new neutral material evaluation.
- **05-ore-bin-dialog.png:** the selected rover bin, ore slots, capacity, box pager, container pager and upper-right Resume button fit the portrait viewport without overlapping. The Atlas cargo label is present. This closes the previous phone fixture's hidden paging/close-control presentation concern for this recorded state.
- **08-atlas-pilot-return.png:** the physical Atlas cockpit and Leave pilot seat/Commands controls are visible. The centre interaction prompt still says “F · SIT IN PILOT CHAIR” while the lower action offers leaving the seat; that is a small inherited endpoint prompt inconsistency, not proof of a rover return failure. This landed still does not establish Atlas flight carry.

## Input record and limits

The recorded input is **injected Chromium touchscreen on actual native controls; no physical phone tested**. Chromium151.0.7922.173 uses ANGLE / AMD Radeon860M / radeonsi krackan1 ACO / OpenGL ES3.2, viewport390×844, DPR1, render buffer351×759. Error, warning and failed-request arrays are empty. No frame-time or FPS claim is made.

The cargo gate records the same captured pointer67/CDP87 before, during and after the modal check, with PASS. The focus gate holds pointer72/CDP92 through trusted blur/focus events: power is active before leaving focus, false while unfocused, and remains false on return. Document visibility stays `visible`, so this proves focus-loss neutral behavior rather than a hidden-page transition. Final pointers and helper contacts are empty. The route record ends with the rover aboard, unoccupied and stopped, door closed, with approximately1.17857kg stored minerals and6.8663s active cutter time. This is not the 120-second duty test or a fresh cold-load persistence review.

The footer's proposed baseline190 clears the previously measured shelf height analytically, but the required fresh visual closure must show the settled physical instrument. An already captured desktop runtime cockpit still is sufficient; no new native art tour is called for. The prior cargo-ceiling chase contraction remains the reason motion is3.8. Neither a route assertion nor these four stills warrants increasing that score.

Evidence SHA256: `journey.json` = `49eea33cdd1ee027d8e80587144a44871307aaf53503b5bad29137950f78e9cb`; `native-input.json` = `dbc867c73b2aca1d2f4218b78dfe2244ad6f33bdb932a3dd03bea04b8ab00e8a`.

Cees retains final product acceptance and PR gating. The result is a narrow asset-and-recorded-route review, with the physical-footer visual check explicitly pending.
