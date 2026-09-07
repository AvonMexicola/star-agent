I have my own captures and the source. Here is the review.

---

# Visual review — system map (`feat/navigation-map`), HANDOFF 20

**Evidence I took myself:** `node scripts/map-review.mjs http://127.0.0.1:5181 /tmp/star-agent-map-opus` →
`desktop.png` (1440×900), `phone-chart.png`, `phone-details.png` (390×844), `drive-held.png`, `evidence.json`.
Substantiated against `src/system-map.js`, `src/system-map.css`, `src/style.css`, `src/travel-model.js`, `src/celestial.js`, `src/main.js`.

## Scores (§3 rubric, adapted to UI)

| # | Criterion | Score | Why |
|---|---|---|---|
| 1 | Silhouette & scale | **4** | Ship / planet / moon / route read instantly. Scale is genuinely true: Aeon's disc measures ~80 px against a 125 px = 5,000 km bar → ~1,600 km radius, matching `world.js` `RADIUS = 6_371_000/4`. Held back by an unreadable exclusion ring and a chart that only uses half its column. |
| 2 | Materials & detail | **3** | The bodies are flat uniform fills (`.map-surface{fill:var(--line)}`, `system-map.css:6`) — no limb, terminator or texture, on the largest object in the chart. The panel side (rules, eyebrows, condensed numerals) is genuinely crafted, which is why this isn't a 2. |
| 3 | Lighting & integration | **4** | Restrained mint, nothing blown, backdrop blur separates the modal, `--chart-bg` gives the chart its own ground. The travelled-vs-remaining route (grey `#map-full-route` under mint `#map-route`) is a real depth cue and it works. No emissive halo anywhere, unlike the HUD's `box-shadow:0 0 9px #b6efd155` language. |
| 4 | Cohesion | **5** | Base `dialog` chrome, `.eyebrow`, `kbd`, `.primary-button`, Space Mono labels, Barlow Condensed numerals. The diff *promotes* existing hexes into `:root` tokens rather than adding a palette; the two new values (`--chart-bg #071019`, `--warning #e2bf87`) match §1's "warm amber only for warnings". No stray hex in `system-map.css`. |
| 5 | Information design | **4** | Where you are, where you're going, the route, the scale, plus phase/ETA/progress and an *actionable* blocked-route reason. Loses a point for a decorative grid, a floating APPROACH label, and mint spent on every body instead of the selected one. |
| 6 | Motion | **3** | Measured layout jump; no transition on the dialog or the zoom at all. Least screenshot-supported score — see caveats. |

**Mean 3.83.** No item under 3. **Mergeable: no** — it misses the §3 bar of ≥ 4.0. Every fix below is small and local; items 1–4 alone should carry criteria 2, 5 and 6 over the line.

## Fixes, ranked

**1. Light the bodies.** `system-map.js:59` / `system-map.css:6`. Aeon is a uniform `#a4c2ce28` disc — the flattest element on a screen whose own HUD already renders a lit planet (`.planet-dot`, `style.css:3`: `radial-gradient(circle at 30% 30%,#b3f6d1,#244d5b 50%,#071c2a 70%)`). `system-map.js:47` already computes the sun vector and uses it only for the star-distance readout: project it and emit an SVG `radialGradient` + terminator per body. This one change is most of criterion 2.

**2. Stop spending mint on unselected bodies.** `system-map.css:6` strokes `.map-surface` mint for *both* worlds, so in `desktop.png` unselected Aeon has the same accent limb as the plotted destination; selection is carried only by the small underline under "SELENE". Bodies in `--muted`, mint reserved for the selected target, route and ship.

**3. Make the exclusion zone visible.** Aeon's exclusion is radius + 100 km = 1,692.75 km against a 1,592.75 km surface — **~2.5 px of separation at fit zoom**, so the dashed ring is glued to the limb; Selene's 20 km is sub-pixel. It is a hard gameplay constraint (`system-map.js:114` writes a whole "climb above…" message about it) and it is in the legend, but it isn't readable. Enforce a floor: `r = max(exclusion/mpp, surface/mpp + 6)` and fill the annulus faintly, with the note stating it's schematic.

**4. Anchor "APPROACH" and separate it from the moon.** `system-map.js:79-80` places the label at `arrival.x-38, arrival.y-54`; in `desktop.png` that leaves ~36 px of empty space between an 8 px `--muted` label and its marker, with no leader. Worse, the arrival ring (`r=4` at surface + 50 km ≈ 12 px from centre) lands **on Selene's limb** — the two mint rings read as one smudged double-image at both viewports. Add a 1 px leader line and give the waypoint a distinct glyph (chevron/tick on the approach vector) rather than a second circle.

**5. Make the grid mean something, or make it quieter.** `system-map.css:5` paints a fixed `background-size:56px 56px` graticule that is independent of `metersPerPixel` and of zoom. At the captured scale each square is ~2,240 km — an unlabelled, non-round unit on a chart that otherwise takes its accuracy seriously, and it gives no feedback when you zoom. Drive `background-size` from `projection.scaleBar.pixels` in `drawChart`, or drop its contrast so it reads as texture.

**6. Let the chart have the space.** `.system-chart{height:310px}` is fixed while the panel column is ~640 px tall; `desktop.png` shows ~110 px of dead chart-panel background below the projection note. Make `.map-chart-panel` a column flex container and `.system-chart{flex:1;min-height:310px}`.

**7. Reserve the drive row; give the dialog a transition.** `#map-drive` is `hidden` (`system-map.js:36`), so the dialog grows ~34 px and re-centres when travel state appears: the header baseline sits at y≈84 in `desktop.png` and y≈67 in `drive-held.png` — the entire chart jumps ~17 px. The same shift fires in-session at arrival when the block re-hides. Reserve the height (`visibility`/`opacity`, or a min-height on the block). Separately, `dialog` in `style.css:3` has no open/close transition and the zoom buttons redraw instantly — the game's largest modal hard-cuts in.

**8. Put a close target in the phone thumb zone.** On 390×844 the only touch dismissal is the ✕ in the top-right corner: `M`/`ESC` don't exist on touch, and the dialog is `min(1160px,94vw)` = ~366 px wide, leaving ~10 px backdrop strips either side. Meanwhile `system-map.css:14` hides the footer's hint span on phones, leaving a sticky full-width bar carrying the text "FLIGHT HELD · CLOSE TO RESUME" and no control. Make that footer text a full-width close button.

**Minor:** 7 px type (`#map-ship-label small`, `.map-legend` on phone) is below the 8 px floor used everywhere else and is barely legible in `phone-chart.png`. In `phone-details.png` a line of the projection note is sliced mid-x-height under the sticky header at y≈115 — needs a scrim. The close control's right edge (x≈1256) doesn't align with the right panel's content edge (x≈1271). The ship triangle (`system-map.js:24`, translate-only at `:68`) never rotates, so during flight it points "up" while travelling right.

## Against your specific questions

- **Positions / route / ship / scale legible — yes.** Verified to scale, not just plausible: ship marker at ~3,520 km from Aeon's centre against an actual 3,592,750 m position. The scale bar, the "true positions and scale · small body markers enlarged" note and the "Ship offset from plane: 0 km" readout are honest and I'd keep all three.
- **Phase / ETA / progress meaningful — yes.** `drive-held.png`: REMAINING TO APPROACH 11,854 km (40 px), TIME REMAINING 1.3 s, ACCELERATING 40% with the bar tracking it, ENGAGE DRIVE correctly disabled, footer flipping to "DRIVE HELD". The one hierarchy complaint: the phase name is 9 px on a 3 px bar — the smallest thing on the panel — while the static DRIVE LIMIT gets 24 px numerals.
- **Close reachable — desktop yes, phone marginal.** Desktop has ✕, `M`, `ESC` and a backdrop click with a sensible drag-guard (`system-map.js:138-142`). Phone meets the 44 px size minimum but sits in the worst corner with no alternative; see fix 8.
- **Faction tokens coherent — yes, best-scoring aspect.** Nothing here would look foreign in the rest of the HUD.
- **No giant decorative blobs — confirmed.** Two bodies, both at true scale, one screen-appropriate planet disc and a ~22 px moon. This is a direct, verifiable answer to the "three giant blobs" complaint. My criterion-2 objection is that the disc is *unlit*, not that it's oversized.

## Screenshot judgement vs automated evidence

- **From my screenshots:** everything about layout, type size, contrast, the flat planet fill, the APPROACH/arrival collision, the 17 px header shift, the dead chart-panel space, the sliced phone text, the grid-vs-scale-bar mismatch.
- **From `evidence.json` only (behaviour, not visuals):** zero console errors and zero warnings; `heldSceneRenderCount: 0` and `positionHeld: true` — the scene render is genuinely skipped and flight frozen while the map is open, which satisfies §5's "modal open: scene render skipped" line outright; prior scene 145 draw calls / 92 k tris. The phone ✕ tap succeeded under automation, so it *works* — my objection is ergonomic.
- **From code, not observed:** the absent dialog transition, the instantaneous zoom, the ship marker's fixed orientation.
- **Not a finding:** `mapRafCadenceMs: 40.8` is measured under ANGLE/SwiftShader software rendering with the scene skipped, so it says nothing about frame time on a real GPU. Don't read it as a perf pass or fail; get the number on hardware for the §2 perf line.

**Evidence gap worth closing:** the harness places the ship at `(-.1,0,-1).normalize() × 3,592,750` — exactly on the Aeon–Selene axis. Every capture is therefore a degenerate, perfectly horizontal, fully collinear route, and none of these screenshots exercises the projection's off-axis behaviour, label collision avoidance, or the non-zero "ship offset from plane" readout. Add a second off-axis position to `scripts/map-review.mjs` before the next round.

**Files:** `/tmp/star-agent-map-opus/desktop.png`, `phone-chart.png`, `phone-details.png`, `drive-held.png`, `evidence.json`.
