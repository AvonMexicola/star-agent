# PR #34 — visual/functional review against the 2026-09-06 baseline

Reviewer: Opus (senior game art/UI). Target: `integrate/main-2026-09-06` @ `dd7aeac` (+45 557 / −808).
Baseline of record: `scratchpad/qa/weekly-2026-09-06.md`, **2.6 / 5**, shots in `scratchpad/qa/baseline/`.

Method: production build in `scratchpad/wt-main/dist`, `vite preview` on 127.0.0.1:4320, headless Chromium +
SwiftShader, 1600×900 (map also 390×844), `?intro=0&seed=7291&debug` (`?seed=7291` for the opening).
**Every capture is at `setRenderScale(1)`**, i.e. the same honest resolution as the baseline's `r1-*` frames —
so nothing below is a resolution artefact. fps (0–2) is excluded from scoring, per the baseline's own rule; the
budget column is draw calls / triangles. Fixture poses for Pyre and the station concourse are the PR's own
(`scripts/pyre.spec.js`, `scripts/concourse-review.mjs`, `scripts/station-shop.spec.js`), so the framing is the
authors' choice, not mine.

Captures: `scratchpad/qa/pr34/*.png` (tour scripts `stageA..G.mjs`, logs `stage*.log` in the same folder).

---

## 1. Headline

**Overall 3.1 / 5 on the thirteen baseline viewpoints (was 2.6); ~3.5 counting the eleven new viewpoints.**
Still under the QUALITY.md §2 merge bar of 4.0, and §3's "no item below 3" is violated at coast (info design 1),
polar (silhouette 1, info design 1) and the new Pyre surface.

This is a real quality jump, not just a feature dump. Three of the baseline top-10 are properly fixed (Selene's
surface, the system map, interior lighting), one is mostly fixed (station surfacing), and the new content —
Pyre from orbit, the external ship camera, the station concourse, the equipment UI — is the best-looking work
in the product. But it also **regresses twelve distinct things** that were previously fine or better, and it
blows three §5 budgets the baseline passed. It is mergeable with fixes, not as-is.

---

## 2. Per-viewpoint scores and delta vs baseline

Criteria: **1** silhouette/scale · **2** materials/detail · **3** lighting/integration · **4** cohesion ·
**5** information design / function · **6** motion.

### Baseline viewpoints

| Viewpoint | shot | 1 | 2 | 3 | 4 | 5 | 6 | score | baseline | delta |
|---|---|---|---|---|---|---|---|---|---|---|
| Orbit | `01-orbit.png` | 4 | 3 | 4 | 4 | 4 | 3 | **3.7** | 3.7 | **same** |
| Coast 95 m | `02-coast.png`, `02b-coast-settled.png` | 2 | 2 | 2 | 3 | 1 | 3 | **2.2** | 2.0 | **better (marginal)** |
| Forest 95 m | `03-forest.png`, `03b-forest-settled.png` | 3 | 3 | 2 | 3 | 2 | 2 | **2.5** | 2.3 | **same** |
| Highlands 700 m | `04-highlands.png`, `04b-highlands-settled.png` | 4 | 2 | 2 | 3 | 3 | 3 | **2.8** | 2.7 | **same** |
| Polar 90 m | `05-polar.png` | 1 | 2 | 2 | 2 | 1 | 2 | **1.7** | 1.5 | **same** |
| Station approach | `06-station.png` | 3 | 4 | 4 | 4 | 3 | 4 | **3.7** | 2.8 | **better** |
| Selene 180 m | `07-moon.png` | 4 | 3 | 4 | 4 | 4 | 4 | **3.8** | 1.2 | **much better** |
| Hangar t=10 s | `10-hangar-t10.png` | 3 | 4 | 4 | 3 | 2 | 4 | **3.3** | 3.5 | **worse** |
| Deck, first person | `11-deck-firstperson.png` | 2 | 3 | 4 | 3 | 2 | 3 | **2.8** | 2.3 | **better** |
| Cabin | `20-cabin-in-flight.png` | 4 | 3 | 4 | 5 | 4 | 4 | **4.0** | 3.7 | **better** |
| Cockpit, seated | `13-cockpit.png` | 3 | 3 | 3 | 4 | 5 | 3 | **3.5** | 3.0 | **better** |
| Map, desktop | `08-map-desktop.png`, `08b-…-selene.png` | 2 | 3 | 4 | 4 | 3 | 4 | **3.3** | 2.5 | **better** |
| Map, 390×844 | `09-map-phone.png` | 2 | 3 | 4 | 4 | 2 | 4 | **3.2** | 2.5 | **better** |

Mean of the thirteen: **3.12** vs **2.6**.

Fairness note: the coast/forest/highlands rows were re-shot a second time with the PR's *own* tour pose and a
wait on `state.terrainLod.settled` (`02b/03b/04b-*-settled.png`, `stageE.log`), at terrain LOD 16/16/13. The
verdicts below are the same at both settle states; the budget numbers in §3 quote both.

One line each:

* **Orbit** — pixel-for-pixel the baseline frame plus a coloured, ringed Selene. Chunky flat cloud islands and
  the near-empty starfield are unchanged (`src/cloud-volume.js`, `src/atmosphere.js`).
* **Coast** — still an olive plane with no water, no beach, no shoreline, at LOD 16 with the terrain fully
  settled; `findDestinations().coast` in `src/world.js:142` is untouched (still targets 55 m elevation, i.e.
  inland). The stepped horizon and the 4 m crosshatch are gone, but the near ground lost its detail texture
  because `detailFade` was tightened from `smoothstep(120,1600)` to `smoothstep(80,700)`
  (`src/surface-materials.js:137`); the 213 rocks are still bright white beads with no contact shadow; and
  vegetation here went from the baseline's 140 trees to **`trees: 0`, `treeLods:[0,0,0]`, meadow not visible**
  (`stageE.log`). A COASTLAND destination with no coast, no trees and no meadow.
* **Forest** — three tree species with distinct silhouettes now (1996/2234/3206 by species) and the stacked
  bands of identical trees are gone. But at settled LOD 16 the tri-albedo split the baseline filed as defect #4
  is plainly still there — near LOD0 canopy renders near-black, mid olive, far pale sage — and total trees
  dropped from the baseline's ~41 k to **7 436** (97 / 938 / 7 198 per LOD) because `TREE_LODS[2].capacity`
  was halved 48000 → 24000 (`src/tree-lod.js:5`). `TREE_RADIUS 1480` and the `[1200,1400]` far band are
  unchanged, so the cutoff is still a cutoff, just thinner. The new appear-fade uses a screen-door discard
  (`addVegetationFade`, `src/tree-lod.js:45-62`) that is plainly visible as checkerboard stipple on canopies at
  1600×900. Net: different, not clearly better.
* **Highlands** — the rectangular LOD terraces are gone (geomorph works). Snow is still clipped paper white and
  now carries a smeared "melted wax" artefact from `terrainNormalAt(normal, mappedGradient, …)`
  (`src/surface-materials.js:207`) where `mappedGradient` is scaled by `mix(.8,.18,snowCover)`.
* **Polar** — marginally less clipped and the horizon no longer stair-steps, but it is still a featureless white
  field, and the cloud shell still tiles into venetian-blind stripes at grazing angle. The fallback branch that
  causes it survives verbatim at `src/surface-materials.js:199`.
* **Station approach** — transformed: hull tone split, panel divisions, "BERTH 01 / AEON" signage, red/green nav
  lights, a lit bay interior, gold truss accents. Costs a point on silhouette: the new arrival pose
  (`station.transitParams(180,6)`, `src/main.js:232`) puts a truss column and two diagonal struts through the
  frame, so you no longer read the whole station in one glance the way `baseline/06-station.png` let you.
* **Selene** — the single biggest win in the PR. Craters, crater rims, ray systems, real relief, ring arc in the
  sky, terminator lighting; `moon.lod` is **11** at 180 m where the baseline measured **3**. Still no boulder
  props and no metre-scale grain underfoot.
* **Hangar t=10 s** — the bay is finally lit by its own lights and the surfaces are authored, but the opening's
  staging (the thing the baseline explicitly told us not to break) is damaged: the Nomad is now an unreadable
  pale wedge against the left edge instead of the read-in-one-glance hero, and two gameplay panels — the MINING LASER field-tool card and the
  1/2/3/5/6/7/9/K hotbar — are drawn over the cinematic. Information design 4 → 2.
* **Deck, first person** — proper lighting and a first-person weapon viewmodel are new and welcome; the frame now
  carries six competing UI elements (field-tool card, hotbar, keycap legend, interaction prompt, FLEET·G button,
  NOMAD marker) and the ship is still out of frame after W.
* **Cabin** — the mint ceiling strips now actually light the walls and floor and the geometry casts/receives
  shadows (`src/ship-walkable.js:227,239`). Baseline defect #8 closed for the cabin.
* **Cockpit** — MFD text is legible at 1600×900 now, the bezels have frames, the struts carry mint edge light,
  and standing at the chair there is a real coaming/dash. Seated there is still no stick, seat rim or ship nose.
* **Map desktop** — the CSS-blob chart is gone, replaced by an SVG chart driven by `travel-model.js`
  (`src/system-map.js`): true positions and scale, ship marker with heading crosshair, exclusion-zone rings, a
  scale bar (2.00 M km), zoom/FIT, a legend, and on selection real live numbers (TO APPROACH 27,547 km ·
  EST. DURATION 5.1 s · APPROACH ALTITUDE 50 km · "Route clear · peak 0.12c · 3s spool"). Two things stop it
  scoring 4+: at the default fit that now includes Pyre, **Aeon and Selene project 1 px apart and their labels
  overlap into unreadable glyph soup** ("SEEGENE / PLMOD" in `08-map-desktop.png`), and the `dl` is still all
  "—" on open, exactly the baseline complaint. Aeon Orbital is still not on the map
  (`TRAVEL_TARGETS` in `src/travel-model.js:22-26` is Aeon / Selene / Pyre only); the star is a header chip
  ("STAR / 25.00 M km · OUTSIDE VIEW") rather than a marker, which is a fair call.
* **Map phone** — reflows correctly and the footer is now pinned, but the whole destination `dl` **and** the
  ENGAGE DRIVE button are below the fold with no visible scroll affordance; the label collision is identical.

### New viewpoints (no baseline)

| Viewpoint | shot | score | one line |
|---|---|---|---|
| External ship camera (key `4`) | `19-external-camera-key4.png` | **4.5** | Best frame in the build: Nomad on a lit pad, mint landing ring, engine glow, lowered ramp, furnished bays, planet limb in the mouth. |
| Pyre arrival, 1 800 km | `14-pyre-arrival.png` | **4.3** | Glowing lava fields on the night side, hard terminator, mottled basalt/ochre albedo, atmospheric rim. Genuinely striking. |
| Equipment & loadout dialog (`K`) | `18-equipment-dialog.png` | **4.2** | Slot grid with key numerals, mass/health readouts, container tabs, a detail pane with real actions. On-token and information-first. |
| Concourse elevator | `27-concourse-elevator-open.png` | **4.2** | Signage, mint door frame, F/CALL panel with indicator, handrail, panelled car. Reads as a place. |
| Ship main power off (`P`) | `21-ship-power-off.png` | **4.0** | All four MFDs switch to a consistent powered-down state with per-page consequences and a restore hint. |
| Concourse overview | `24-concourse-overview.png` | **3.8** | Wayfinding, two shopfronts, terminals, floor shadows. Top third of frame is near-black. |
| Pyre caldera, 700 m | `17-pyre-caldera-700m.png`, `17b-…-lit.png` | **3.3** | Cracked crust with emissive lava veins and steam wisps — real material authoring; but the fracture motif repeats on a visible grid and the pose has no relief or horizon. |
| Third person on foot (`4`) | `22-onfoot-thirdperson-key4.png` | **3.3** | Character reads well — but the first-person weapon is still drawn, floating unattached at frame right (see R1). |
| Station shop dialog (`F` at the armory) | `30-station-shop-dialog.png` | **4.0** | AVAILABLE CREDIT / DELIVERY-warehouse mass, per-item weight, shop stock, owned and warehouse counts, priced Buy buttons, controller hints, and a candid "combat and equipping are not implemented" line. Scene render skipped while open (0 dc). Two stray empty dividers at the foot; Buy prices use mono rather than the Barlow numerals. |
| Armory / components shops | `25-concourse-armory.png`, `26-concourse-components.png`, `29-armory-counter-firstperson.png` | **3.0** | Counters, racks with hung weapons, cases, a BROWSE STOCK terminal — but the alcoves have **no ceiling**: bare starfield and exterior truss above the back wall (R8), stock is repeated grey canisters, everything is very dark, and the held mining laser blocks the right third of every on-foot frame. |
| Pyre 60 km | `15-pyre-60km.png`, `15b-…-lit.png` | **2.0** | Undifferentiated orange wash with visible texel blocks; no landform, no horizon, at its own `ready` level. |
| Pyre surface 2 m | `16-pyre-surface-2m.png`, `16b-…-lit.png` | **1.6** | At `lod 17, ready:true` the frame is ~95 % black — the night-side landing site has no light source at standing height. The worst frame in the build, and it is a shipped destination. |

---

## 3. Budgets vs QUALITY.md §5

Measured at render scale 1.0, 1600×900.

| Scene | draw calls | budget | triangles | budget | verdict | baseline |
|---|---|---|---|---|---|---|
| Orbit | **491** | ≤ 300 | 338 452 | ≤ 400 k | **FAIL (dc +64 %)** | 477 / 305 k — *worse* |
| Coast 95 m (arrival / settled LOD 16) | 288 / **527** | ≤ 900 | 777 944 / **1 120 602** | ≤ 1.8 M | pass | 346 / 330 k |
| Forest 95 m (arrival / settled LOD 16) | 239 / **666** | ≤ 900 | 680 656 / **1 268 226** | ≤ 1.8 M | pass | 371 / 1.26 M |
| Highlands 700 m (arrival / settled LOD 13) | 241 / **397** | ≤ 900 | 501 268 / **605 498** | ≤ 1.8 M | pass | 261 / 238 k |
| Polar 90 m | 203 | ≤ 900 | 260 626 | ≤ 1.8 M | pass | 295 / 188 k |
| Station approach | 199 | ≤ 300 | 329 908 | ≤ 400 k | pass | 218 / 157 k |
| Selene 180 m | 170 | ≤ 900 | 362 644 | ≤ 1.8 M | pass | 137 / 87 k |
| Pyre arrival 1 800 km | 195 | ≤ 300 | 121 490 | ≤ 400 k | pass | — |
| Pyre 60 km | 94 | ≤ 900 | 165 518 | ≤ 1.8 M | pass | — |
| Pyre surface 2 m | 117 | ≤ 900 | 231 822 | ≤ 1.8 M | pass | — |
| Pyre caldera 700 m | 95 | ≤ 900 | 179 470 | ≤ 1.8 M | pass | — |
| **Hangar, intro t = 10 s** | **608** | ≤ 600 | **933 714** | ≤ 900 k | **FAIL (both)** | 310 / 289 k |
| Deck, first person | 575 | ≤ 600 | 792 786 | ≤ 900 k | pass (5 calls of headroom) | 284 / 253 k |
| Cockpit, seated | 554 | ≤ 600 | 799 556 | ≤ 900 k | pass | 315 / 264 k |
| **External camera (key 4)** | **640** | ≤ 600 | 831 632 | ≤ 900 k | **FAIL (dc)** | — |
| Cabin in flight | 527 | ≤ 600 | 629 532 | ≤ 900 k | pass | — |
| Concourse hub (hub cameras) | 236–348 | ≤ 600 | 484 k–634 k | ≤ 900 k | pass | — |
| Hangar berth, inside | 521 | ≤ 600 | 708 996 | ≤ 900 k | pass | — |
| **Map open (desktop / phone)** | **scene render skipped** | — | — | — | **PASS** | 201 / 128 k — **FAIL fixed** |
| Equipment dialog open | **scene render skipped** | — | — | — | **PASS** | — |
| Station shop dialog open | **scene render skipped** | — | — | — | **PASS** | — |
| Concourse, walked to the armory | 399 | ≤ 600 | 709 600 | ≤ 900 k | pass | — |

Two of the baseline's budget items moved in opposite directions:

* **Modal budget — FIXED.** `src/main.js:317` now gates the frame:
  `const drawScene = resizePending || !firstReady || (!systemMap.open && !document.querySelector('dialog[open]'))`.
  Draw calls freeze the moment any dialog opens; the equipment dialog reports 0/0.
* **Orbit draw calls — WORSE, 477 → 491.** The per-patch water mesh is now conditional
  (`src/planet.js:78`, `if(data.heights.some(h=>h<50)||…)`) but the default orbit sits over OPEN OCEAN, so
  virtually every one of the 202 visible patches still pays two meshes. Nothing merges sibling patches.

Three budget failures are **new**: hangar draw calls and triangles, and external-camera draw calls. The station
concourse/berth geometry is now resident in the hangar scene and it is not LODed for the opening.

Asset budgets (§5): the runtime station kit grew from one 1.57 MB `station.glb` to
`station.glb` 3.80 MB + `station-concourse.glb` 2.68 MB + `station-props.glb` 2.56 MB +
`station-elevator.glb` 0.36 MB ≈ **9.4 MB**. §5 has no "station" row, so this is not a formal breach, but it is
the direct cause of R4 and it deserves a budget row of its own. `nomad.glb` 3.78 MB and `atlas.glb` 3.77 MB are
inside the ≤ 4 MB ship budget. Station textures are WebP and small; the >1 MB PNGs under
`public/textures/atlas-mark-ii/` are reachable only from `src/atlas-mark-ii-studio.js`, which the PR explicitly
scopes out.

## 4. Console

**Zero errors and zero warnings** across all seven Playwright runs (`stageA.log`…`stageG.log`; `grep -c
'CONSOLE|PAGEERROR'` = 0 for each). Matches the baseline's clean record. `vite build` is green (the shipped
`dist/` was rebuilt without incident). I did **not** re-run the 442 unit tests; the PR's own claim there is
unverified by me.

---

## 5. (a) Regressions vs the baseline — every one, with file hints

**R1 — The first-person weapon/tool viewmodel is still drawn in third-person and external views.**
`22-onfoot-thirdperson-key4.png`: the laser rifle floats unattached at frame right while the character it
belongs to stands in the middle of frame holding nothing. It is also present in the deck frames.
`src/mining/tool.js:42` computes `active` from `nav.mode`/`insideShip`/`enabled`/`focused`/`document.hidden`
only — it never consults `shipCamera.active`. Same expression drives `mount.visible` and the tool `lamp`
(line 43, 48). *Fix:* AND the visibility with "first-person camera" and hide `mount`/`lamp` whenever
`shipCamera.active`.

**R2 — The opening's staging at t = 10 s is broken, and gameplay HUD is drawn over the cinematic.**
Compare `baseline/10-hangar-t10.png` with `10-hangar-t10.png`. The baseline's composition (ship at frame left,
pilot below centre, planet limb in the aperture, deck stripes leading the eye) was called out in the baseline
report as "genuine cinematography — do not fix this away". The Nomad is now reduced to an unreadable pale wedge against
the left edge — no canopy, no MFD glow, no hull line — and the top-centre third of frame is empty black. On top of it the new loadout bar and the field-tool
card render during the opening. *Fix:* re-aim the opening dolly for the new bay layout
(`src/opening-sequence.js`), and gate the loadout bar + `#mining` panel on `opening.phase !== 'playing'`
(`src/inventory/loadout-ui.js`, `src/mining/tool.js:43` `panel.hidden`).

**R3 — Orbit draw calls got worse (477 → 491) against a ≤ 300 budget.** `src/planet.js:78`. Baseline defect
#9a is not fixed for the viewpoint that fails it.

**R4 — Hangar and external-camera views are now over §5 budget** (608 dc / 934 k tris, and 640 dc). The
concourse/berth kit is resident and un-LODed in the opening scene. `src/station-complex.js`,
`src/station-concourse.js`, `src/station.js` `attachLod`.

**R5 — Pyre looks superb from orbit and falls apart on the way down.** Not a streaming artefact: re-shot with
the PR's own lit epoch and waited to full resolution (`stageF.log`).
*(a)* `16b-pyre-surface-2m-lit.png` at 2 m, **`lod 17, ready:true`**, 472 dc / 619 k tris — and the frame is
**~95 % black**. The landing site is `NIGHT SIDE · NIGHTFIRE PLAIN`; a lava ridge glows in the top-right corner
and gives off no bounce at all, so at standing height there is no ground, no rock, no relief, nothing to walk
on visually. §1 is explicit: "Night has light sources."
*(b)* `15b-pyre-60km-lit.png` at 60 km, `lod 7, ready:true` — an undifferentiated orange wash with visible
texel blocks and no landform or horizon; the mid-altitude band renders a magnified low-resolution emissive map.
*(c)* `17b-pyre-caldera-700m-lit.png` — good crust material, but the fracture pattern is a **visibly repeating
tile** on a regular grid, with rows of identical dark dashes.
`src/pyre-terrain.js` (`requiredLevel` at 10–100 km), `src/pyre-world.js` (surface relief terms), and the
night-side lighting/emissive bounce in `src/pyre.js`. The 1 800 km arrival the app actually gives the player
(`PYRE_ARRIVAL_ALTITUDE`, `src/pyre-world.js:144`) is genuinely excellent — everything below it is not.

**R5b — The coast destination lost its vegetation entirely.** `stageE.log`: at the settled coast viewpoint
`vegetation.trees` is **0** (baseline: 140), `species [0,0,0]`, meadow not visible. The forest streamer
(`src/forest-stream.js` / `src/forest-distribution.js`) publishes nothing for this biome.

**R6 — Near-ground material now dies at 700 m instead of 1.6 km.** `detailFade = 1-smoothstep(80,700,range)`
(`src/surface-materials.js:137`, was `smoothstep(120,1600)`). The terrain-map path picks this up on Aeon where
maps are ready, but the coast frame shows the cost directly: `02-coast.png` has visibly less near-ground
material than `baseline/r1-02-coast.png`, and the rock scatter has all but vanished.

**R7 — The system-map labels collide into unreadable text at the default fit.** `08-map-desktop.png`,
`09-map-phone.png`: AEON and SELENE project ~1 px apart once Pyre is included in the fit, so both
`.map-body` buttons and both labels stack ("SEEGENE"/"PLMOD"). The baseline map was ugly but legible; this one
is legible only after zooming. `src/system-map.js` `drawChart` (`button.style.left/top`, `--label-offset`) and
`src/map-projection.js`. *Fix:* collision-resolve the labels, or default the fit to Aeon+Selene and treat Pyre
as an off-chart bearing chip.

**R8 — Shop alcoves have no ceiling.** `25-concourse-armory.png`, `26-concourse-components.png` and the
physically-walked `29-armory-counter-firstperson.png`: from standing eye height inside a pressurised station you
see bare starfield and the station's exterior truss beams above the shop's back wall.
`src/station-concourse.js` / `src/station-complex.js` — the alcove volumes need a roof plane (or glazing that
reads as glazing).

**R9 — Blown emissive signage.** `28-hangar-berth.png`: the "CENTRAL HUB" sign is clipped to white and
"ELEVATOR / CONCOURSE" is illegible inside its own glow. §3 criterion 3 forbids blown emissives.
`src/station-finish-materials.js` / the ×2 emissive doubling in `Station.prepareMaterials`.

**R9b — On phone the map's primary action is below the fold.** `09-map-phone.png` / `09b-…-full.png` (the
page does not scroll; only the dialog body does, with no visible affordance): the footer is now correctly
pinned, but the whole `dl` (TO APPROACH / EST. DURATION / APPROACH ALTITUDE / DRIVE LIMIT) **and the
ENGAGE DRIVE button** are cut off below the description. The baseline cut a note under the button; this cuts
the button. `src/system-map.css` phone reflow — the chart panel needs a max-height so the destination panel
keeps its action above the fold.

**R10 — New raw hex colours outside the token set.** `src/style.css` adds `#f0b35a`, `#ff7a3c`, `#ffaf89`,
`#ffc09f`, `#ed8d65`, `#bd8964`, `#ddc3a9`, `#bc916b` for `#heat-warning`, `#crash-panel` and `#pyre-survey`
rather than tokens; `src/station-shop.css` / `src/inventory/loadout.css` hard-code `#b6efd1` instead of
`var(--mint)`. QUALITY.md §6.4 makes this an automatic review item (minor).

Not a regression but worth recording: **five of the six "second, better build" modules the baseline flagged are
still orphans** — `src/ocean.js`, `src/lighting-csm.js`, `src/clouds.js`, `src/ship-mk2.js` and
`src/terrain-material.js` are imported only by `public/dev/*`. Only `src/equipment.js` was adopted (by
`src/mining/tool.js`). The shipped `src/lighting.js` is still a single ±110 m shadow box.

## 6. (b) Which baseline top-10 defects this PR fixes

| # | Baseline defect | Status |
|---|---|---|
| 1 | Selene's surface is an untextured plane | **FIXED for the shipped route** — `moon.lod 11` at 180 m (was 3), craters/rims/ray systems/real relief, 363 k tris (was 87 k). But it was fixed in the *transit*, not the terrain: `src/main.js:238` now holds the transit until `moon.terrain.maxLevel>=14`, while `src/moon-terrain.js:96` still reads `get ready(){return this.maxLevel>=2;}` with `budget=8` — the exact root cause the baseline named. Fly to Selene manually instead of quick-transiting and the loading gate still passes on a six-quad blob. Boulder props and metre-scale grain still missing. |
| 2 | Snow has no material | **PARTIAL** — a real snow/ice path exists when terrain maps are ready (`surface-materials.js:173-185`), but the layer-bypassing fallback survives at line 199, snow albedo is unchanged, and `05-polar.png` is still a whiteout. |
| 3 | The "coast" viewpoint has no coast | **NOT FIXED** — `findDestinations().coast` (`src/world.js:142`) untouched; `02-coast.png` still has no water in frame. |
| 4 | The forest is three forests with a hard edge | **NOT FIXED** — at settled LOD 16 the near-black / olive / pale-sage tri-albedo split is still visible, `alphaTest` is still .32/.27/.2 and the impostor still lifted by `mix(.68,.93,vMapUv.y)` (`src/vegetation.js:76-93`), `TREE_RADIUS 1480` / far band `[1200,1400]` unchanged. Only the species variety improved; density fell 41 k → 7.4 k. |
| 5 | The cockpit is a whitebox | **PARTIAL** — MFD resolution and bezels fixed, coaming present from standing; seated still has no console, stick, seat or nose. |
| 6 | Station hull is one grey | **MOSTLY FIXED** — token-driven physical palette, manufacturing bump/roughness maps, deck texture, signage, nav lights, lit bay (`src/station-finish-*.js`). Still effectively no mint on the exterior. |
| 7 | The system map does not map | **FIXED** — SVG chart on `travel-model.js`, ship marker + heading, true positions and scale, scale bar, exclusion rings, live distance/ETA/approach on selection, zoom, controller hints. Legibility regression R7 and the "—"-on-open complaint remain. |
| 8 | Hangars and cabins are not lit by their lights | **FIXED** — `src/station.js:213-217` (300 W point lights, decay 2), `src/station-finish-lighting.js` (sun refocus + shadow hygiene inside the bay), `src/ship-walkable.js:227,239` (cabin light + cast/receive shadows). `19-external-camera-key4.png` and `20-cabin-in-flight.png` are the evidence. |
| 9 | Two §5 budget failures | **HALF** — the modal now skips the scene render (`src/main.js:317`) ✅; orbit draw calls got worse ❌, and three new failures appeared. |
| 10 | Distant terrain goes flat, horizon steps | **PARTIAL** — geomorph works, the stair-stepped horizon is gone from every surface frame; but the material band moved *inward* (R6) and distance is now carried by the terrain-map path only. |

Net: **3 fixed, 1 mostly, 3 partial, 2 not fixed, 1 half** — plus the 12 regressions/defects in §5.

## 7. (c) Verdict

**YES WITH FIXES.** This is clearly the better build and I would not send it back wholesale — at the fixed
viewpoints it beats the baseline on 8 of 13, ties on 4 and loses on 1. But it is **not** a 4.0 release candidate, it breaks
things the baseline explicitly asked us to protect, and it ships three budget failures. Deploying it as the new
`main` build without the blockers below would trade one set of embarrassments for another.

**Blocking (must be fixed before this becomes the deployed build):**

1. **R1** — hide the first-person weapon/tool viewmodel in third-person and external cameras
   (`src/mining/tool.js:42-48`). A floating rifle in the marquee external shot is a shipped-bug-level defect.
2. **R2** — restore the opening's t≈10 s composition (ship readable in frame) and suppress the loadout bar and
   field-tool card while `opening.phase === 'playing'`.
3. **R4** — bring the hangar/opening frame back inside §5 (608 dc / 934 k tris vs 600 / 900 k) and the external
   camera under 600 dc; LOD or cull the concourse kit from the berth scene.
4. **R5** — light Pyre's night-side landing site (lava emissive bounce / a low fill keyed to `pyreHeat`) and
   raise the required detail level in the 10–100 km band, or move the shipped landing site to the terminator.
   As it stands the player quick-transits to a destination and, on landing, sees a black screen at `lod 17,
   ready:true` — a shipped destination that shows nothing, which is exactly the failure the baseline filed as
   top-10 #1.
5. **R8** — put a ceiling on the shop alcoves; you can currently see space from inside the station.
6. **R7** — resolve the AEON/SELENE label collision at the default map fit. The map is the defect of record and
   its headline text is currently unreadable.

**Should fix in the same pass (not blocking):** R3/orbit draw calls, R6 near-ground `detailFade`, R9 blown
signage emissives, R10 tokens, the halved forest density and the vegetation screen-door dither, and populating
the map `dl` on open.

**Do not "fix" away:** the external ship camera, the Pyre arrival frame, the equipment dialog, the concourse
signage and elevator, the new cockpit MFDs, the Selene surface, and the modal render skip.

---

## 8. Files

* Screenshots + tour scripts + logs: `/tmp/claude-1000/-home-cees/e503766e-02ad-41ad-b864-2bfc764aa6cb/scratchpad/qa/pr34/`
* Baseline: `/tmp/claude-1000/-home-cees/e503766e-02ad-41ad-b864-2bfc764aa6cb/scratchpad/qa/baseline/`, report `../weekly-2026-09-06.md`
* Checkout under review (untouched): `/tmp/claude-1000/-home-cees/e503766e-02ad-41ad-b864-2bfc764aa6cb/scratchpad/wt-main` @ `dd7aeac`
