## Independent re-review — system map, `feat/navigation-map` (PR19)

**Evidence I took myself:** `node scripts/map-review.mjs http://127.0.0.1:5181 /tmp/star-agent-map-opus-final` → `desktop.png`, `phone-chart.png`, `phone-details.png`, `off-axis.png`, `zoom.png`, `drive-held.png`, `evidence.json`. Behaviour claims stills can't carry are substantiated against `src/system-map.js`, `src/system-map.css`, `src/map-projection.js`.

### Scores (§3 rubric, half-steps used)

| # | Criterion | Score | Why |
|---|---|---|---|
| 1 | Silhouette & scale | **4.5** | Aeon reads as a lit sphere, Selene as a ~34 px moon, ship as an oriented arrow with crosshair; chart now fills the column (`flex:1`, `system-map.css:5`) so nothing is cramped. Scale still verifiably true: grid 5,000 km ≡ the 123 px scale bar in `desktop.png`, 2,000 km bar with wider grid in `zoom.png`. Held back only by exclusion rings that are true-scale and therefore ~1 px / sub-pixel. |
| 2 | Materials & detail | **4** | `map-defs` emits a per-body `radialGradient` whose centre is offset by the *projected* sun vector (`system-map.js:61-64`); both bodies now have a lit limb and a terminator instead of flat `--line` fill. Mint limb is selection-only (`.map-surface.selected`), warm dashed `--warning` edge on exclusions, grey travelled route under mint remaining. Not a 5: shading is a three-stop grey ramp at a fixed 32 % offset — no texture, no limb darkening. Appropriate restraint for a chart, not "material definition". |
| 3 | Lighting & integration | **4** | One consistent light source across bodies, nothing blown, `--chart-bg` reads as ground, subtle `drop-shadow` on the ship. Still no emissive halo matching the HUD's `0 0 9px #b6efd155`; a deliberate, defensible choice. |
| 4 | Cohesion | **5** | Unchanged and still the strongest axis: base `dialog` chrome, `.eyebrow`/`kbd`/`.primary-button`, tokens only, `--warning` used exactly as §1 prescribes. |
| 5 | Information design | **4.5** | Every earlier deduction is closed: grid is derived from `fit.scaleBar.metres / metersPerPixel` (`system-map.js:65`), origin-anchored to Aeon and labelled "Grid: 5,000 km"; APPROACH has a leader (`#map-arrival-leader`) and a directional chevron instead of a second circle; off-axis capture shows a real "offset from plane: 697 km"; drive row reserved, phase/ETA/progress honest. Nits only: the "Drive exclusion" legend key points at a near-invisible ring, and the phase label is 9 px against 24 px static numerals. |
| 6 | Motion | **4** | Verified from stills where possible: header baseline is y≈101 in **both** `desktop.png` and `drive-held.png` — the 17 px jump is gone (`#map-drive{min-height:40px;visibility:hidden}`). From code: `map-enter .16s ease-out`, zoom animated over 180 ms with cubic ease-out **and** a lerped centre, both bypassed under `prefers-reduced-motion`. No close transition exists. Still the least screenshot-provable score. |

**Mean 4.33.** No item below 3, none below 4. **Mergeable: yes** — clears the §3 bar of ≥ 4.0.

### Blockers
None.

### Non-blocking follow-ups
1. **Sticky header slices the chart eyebrow.** In `off-axis.png` and `zoom.png` (y≈154) "PLANET + MOON" and the star-distance row are cut mid-glyph: at 1440×900 the dialog (`height:min(840px,92dvh)` = 828 px) overflows by ~20 px, so the body scrolls and the opaque header eats the row. Trim header padding or `min-height` so the desktop layout doesn't scroll at all.
2. **Legend vs true scale.** Keeping rings honest is right, but the legend advertises a swatch for something the user can't see at fit zoom. Either mark the key "schematic — see note" or drop the key and keep the numeric constraint in the note.
3. **Progress hierarchy.** `ACCELERATING · 41 %` at 9 px is the smallest text on a panel where the static DRIVE LIMIT gets 24 px numerals.

### Evidence notes
`evidence.json`: 0 errors, 0 warnings, `heldSceneRenderCount: 0`, `positionHeld: true` — §5's "modal open: scene render skipped" is met outright; prior scene 210 draw calls / 133 k tris is inside the orbit budget. `mapRafCadenceMs: 17.24` is SwiftShader with the scene skipped — still not a perf result; get the §2 frame time on hardware. Phone captures confirm the full-width `#map-return` thumb-zone button and no type below 8 px.
