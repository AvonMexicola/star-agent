# Archived hangar review: provenance and scope

Archived on 2026-09-06, Europe/Amsterdam. The report below is reproduced verbatim
from `/tmp/star-agent-hangar-opus-report.md`, extracted from the completed reviewer
stream `/tmp/star-agent-hangar-opus-review.jsonl`. Its reviewer identity, commands,
self-captured evidence, scores and findings are recorded in the report itself.

This review applies to HEAD `4da1a5d1a1acac00b3034fed8f06457a682f6852`
(runtime `7a73ecf`, base `029cae8`) in `/tmp/star-agent-hangar-merge`.
Its score was **3.67; mergeable: no**. It is not approval of the later integration
against `85aa836` (including `7e7194a`) in `/tmp/star-agent-hangar-current`. The
[production record](hangar-production-record.md#resumed-integration-after-the-completed-review)
records subsequent source findings and work; those do not modify this historical
review. In particular, the source audit distinguishes the observed missing
character shadow from the reviewer's proposed cause.

Original report SHA-256: `c256e10a9eab45768ad6278f606acdc9f38e7480893d536ad16038ad89c5bc39`.

---

I've completed the review. Here is my report.

---

# Independent visual review — Star Agent PR #20 (hangar stack integration)

**Reviewer model:** Claude Opus 5 (`claude-opus-5`), acting as senior game art/UI reviewer under `QUALITY.md` §3.
**Candidate:** worktree `/tmp/star-agent-hangar-merge`, branch `integrate/hangar-finish`, HEAD `4da1a5d1a1acac00b3034fed8f06457a682f6852` (runtime `7a73ecf`), base `feat/visual-fidelity` @ `029cae8`. Verified via `git rev-parse`; tree clean.
**Artifact identity spot-check:** `sha256sum` of `station.glb`, `station-props.glb`, `poster-selene.webp` matches the production record exactly.

## 1. Captures I personally generated and inspected

| Capture | How produced | Notes |
|---|---|---|
| `01-orbit` … `08-gallery` + `evidence.json` | **My own run** of `node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5239 --out /tmp/star-agent-hangar-opus-review --extras --perf1440` | 5 isolated Chromium sessions, 1600×900, seed 7291, Chromium 151.0.7922.173, ANGLE Vulkan SwiftShader. **0 errors, 0 warnings, 0 failed requests, 0 unexpected lifecycle events, `failure: null`.** All eight PNGs read with the Read tool. |
| `/tmp/star-agent-player-ui-menu.png` (1440×900), `/tmp/star-agent-player-ui-mobile-menu.png` (390×844) | **My own run** of `npm run test:browser -- -c scripts/hangar-merge.config.js scripts/player-interface.spec.js -g 'W dismisses launcher'` — 1 passed (27.7 s), fresh production build served on :5238 | Both inspected. |
| `/tmp/aeon-exterior.png` | **My own run** of `... scripts/hangar.spec.js -g 'enormous rings rotate'` — 1 passed (20.7 s) | Dynamic ring evidence + exterior view. I inspected the pre-existing file first (a **historical root capture**) and then my regenerated one; they are visually identical at this commit. |
| `docs/images/atlas-exterior.png`, `docs/images/nomad-pilot-chair.png` | **Historical repo captures from `/dev` studio pages — not mine, not production lighting** | Consulted only to judge Atlas/chair, which my tour does not reach (tour runs the default Nomad). |

My 1440×900 measurements reproduce the recorded ones **exactly**: opening 412 draws/645,481 tris; cockpit 435/637,740; corner 357/523,940; gallery 344/516,064. Orbit 477/304,642. Two independent servers (:5239 pre-served, and my own build on :5238) agree, which is my basis for saying the served build is the candidate — I could not read the served bundle hash directly from this session.

## 2. Rubric scores (`QUALITY.md` §3)

| # | Criterion | Score | Concrete evidence |
|---|---|---|---|
| 1 | Silhouette & scale | **4** | Corner reads instantly (`07-corner`): elevator vestibule, freight terminal, ribbed warehouse shutter, benches, gallery band. Scale verifiable: eye at local y −6.25 over deck −8 → 1.75 m; 3.1 m elevator leaves; 1.12×1.68 m posters; the 1.80 m astronaut in `05-hangar-t10` sits correctly against deck stripes and gallery rail. Exterior (`aeon-exterior`) reads as twin counter-rotating rings + spine at distance. Deduction: the 20-pod bank reads as a flat lattice with no volume, and `08-gallery` shows the upper bay is still undifferentiated big boxes. |
| 2 | Materials & detail | **3.5** | Strong: 9 shared PBR finishes with brushed/powdercoat microrelief and generated metre UVs (`station-finish-materials.js:91-116`); mirrored 2 m deck map; recessed posters with real 5 cm metal surrounds (`station-finish-graphics.js:153-167`). Weak: the new 1,450 m rings are flat `dark` `0x182b33` boxes + a `steel` torus with no maps, panel lines or wear (`station-architecture.js:9-12,47-64`) — whitebox by §1, and it is in frame in both hero views; the elevator doors and the tan storage block at right of `07-corner` are uniform slabs; gallery glazing reads as an opaque dark band. |
| 3 | Lighting & integration | **3** | Good: practical warm task lights + one shadow-casting cool spot give real contact shadows under the bench/dolly/terminal in `07-corner` (`station-finish-lighting.js:43-46`); sign/glass shadow policy prevents opaque text cards; MFDs correctly `toneMapped:false`. Bad: ceiling panels use `HangarLight` at emissive strength **4.0** (`blender/build_station.py:84`, new ceiling loop) and clip to flat white cards in `08-gallery` — the rubric names "no blown emissives" explicitly. In `05-hangar-t10` the mid-bay is very dark and the hero character shows no cast shadow: `lighting.js:47` disables sun shadows above 1.5 km (station is at ~98 km) and the only shadow caster is the 42 m corner spot. The ring reads as an unlit black cut-out over the planet limb. |
| 4 | Cohesion | **4** | Physical palette is sourced from CSS tokens (`--station-*` added to `style.css`; `station-finish-palette.js`), prints use `--mono`/`--station-display`, warm amber reserved for hangar interiors per §1. Desktop and 390×844 menus use base `dialog` chrome and mint/Space Mono tokens consistently. Deductions: new `fleet.css` and `station-interior.css` hard-code ~20 hex values and `font:12px monospace` outside `style.css` — an automatic review item under §6.4; `station-architecture.js:21-23` hard-codes `#10252e`/`#d7b374`/`#d8eee8` and generic `sans-serif` while the finish graphics correctly read tokens, so two sign systems in one room disagree on type and colour. |
| 5 | Information design / Function | **4** | Function is genuinely delivered: 20 berths with independent door mixers and colliders, hub/lift/cargo services, capacity-aware Take-all with persistence, Atlas layout driving spawn/dock/camera clearance (`navigation.js` diff), travel keep-out on the fixed complex centre, help text updated for keyboard **and** controller. MFD hierarchy is correct (row 0 bold 27 px white vs 23 px mint). Deductions: at 512×320 (`ship-mfd.js:15`) the screens under-sample at seated distance — in my own `06-cockpit` capture "0.0 m/s" reads as "8.0 m/s"; and the new wayfinding text (`SERVICE nn`, `CENTRAL HUB`, `WAREHOUSE / 10T`) is extruded `MintPaint` at emissive 0.35 with no backing plate, so it is barely separable from the wall. |
| 6 | Motion | **3.5** | Based on **dynamic** evidence, not a still: I ran the ring case myself — it asserts `after[0] > before[0]` and `after[1] < before[1]` across 1000 ms and passed. My own tour independently recorded two ring samples in one session, `0.023392 → 0.029174` rad, monotonic and consistent with `RING_SPEED 0.00045` rad/s (≈3.9 h/rev, 0.65 m/s rim speed — believable for a 1,450 m ring). Eased/timed transitions verified in code and by the passing UI case: 5.04 s door clip, 1.1 s⁻¹ elevator leaves, 0.45 s transfer fade. **Not verified:** rendered smoothness. My own RAF intervals were 310–1,694 ms at 1600×900 and 998–1,336 ms at 1440×900 on SwiftShader; no frame-rate, popping or LOD-hysteresis judgement is possible from that. The 600 km exterior visibility switch is a hard boolean, but at that range the 2.9 km structure is ~0.01 px, so it is not a visible pop. |

**Arithmetic mean: (4 + 3.5 + 3 + 4 + 4 + 3.5) / 6 = 3.67.**
**Any item below 3: no** (lowest is 3).

## 3. Top 5 findings

| # | File · element | Problem | Suggested fix | Class |
|---|---|---|---|---|
| 1 | `src/station-architecture.js:9-12, 45-64` — ring `panels` InstancedMesh (`dark` `0x182b33`), `torus` (`steel`, metalness .65) | The ring band crosses the hangar aperture in `05-hangar-t10` and sits dead-centre of the windscreen in `06-cockpit` as a near-black cut-out over the planet limb. Metals get almost no fill at 98 km (`lighting.js:44` → environmentIntensity ≈ .04–.18) and the panels carry no maps. This is **new in this PR**: the old small hull `HABITAT RING` was deleted from `build_station.py` and replaced by these 1,450 m rings. | Lift panel base to ~`0x2c3d45`, drop torus metalness to ~.35 and raise `envMapIntensity`, add per-instance value variation plus an ochre rib every N segments so the band reads as structure; consider shifting ring X so it does not bisect the berth-01 aperture. | **Blocker** |
| 2 | `blender/build_station.py:84` `HangarLight` (emissive 4.0), used by the new ceiling coffer loop and elevator vestibule strips | Ceiling luminaires clip to flat pure-white rectangles with no falloff or bezel in `08-gallery`; §3 criterion 3 calls out blown emissives explicitly. | Reduce strength to ~1.2–1.6 warm (as `AmberSoft` already does), wrap each strip in a thin diffuser/bezel box so it has an edge, and let the two bay point lights carry illumination. | **Blocker** |
| 3 | `blender/build_station.py:81` `MintPaint` (emissive .35) on `Sign_Service_*`, `Sign_Hub`, `Sign_Transit`, `Sign_Warehouse_*`, `Sign_Wayfinding_*` | New wayfinding is grey-green extruded text with no backing plate: "SERVICE 07" in `05-hangar-t10` and "CENTRAL HUB / ELEVATOR / CONCOURSE" and "WAREHOUSE / 10T" in `07-corner` are barely legible, while the runtime canvas signs ("BERTH 01") read perfectly in the same frame. Wayfinding that cannot be read fails its only job. | Either give each text a dark teal backing plate with the ochre edge bar and raise emissive to ~1.2, or convert them to the existing runtime `sign()` canvas kit so both systems match. | **Blocker** |
| 4 | `src/lighting.js:47` (`sun.castShadow = altitude < 1500`), `src/station-finish-lighting.js:43-46`, `src/station.js:199-202` | Outside the service corner the bay has two non-shadowing point lights and 0.055 ambient fill; the hero character in the opening beat casts no discernible shadow onto the deck, so it floats. §1 requires "hangars are lit by their lights". | Re-enable the sun shadow (or promote one bay point light to a shadow-casting spot over the pad) while `station.location === 'hangar'` and the player is docked; `updateStationFinishSun` already narrows the frustum to ±45 m for exactly this case, but is inert at station altitude. | Follow-up |
| 5 | `src/ship-mfd.js:15` (512×320 canvas), `:51` (font sizes, generic `monospace`) | Under-sampled at seated distance: in my own `06-cockpit` capture "0.0 m/s" and "0.0 m/s" read as "8.0"/"8.8" — 0 and 8 are confusable on the most important numbers. Also generic `monospace` rather than the §1 Space Mono / Barlow Condensed pairing. | 1024×640 canvas, primary row to ~34 px, use the `--mono` family for labels and a condensed face for numerals. | Follow-up |

Also noted, below the top 5: `fleet.css`/`station-interior.css` raw hex + font-family outside `style.css` (§6.4 automatic review item); gallery glazing reads opaque; the tan storage block at right of `07-corner` is untextured.

Not counted against this PR (pre-existing baseline, confirmed in my own captures): `02-coast` is a flat plane with no relief, violating §1 "no flat plane views"; `03-forest` shows LOD colour banding; `04-highlands` shows faceting.

## 4. Merge disposition

**MERGEABLE: NO** — under `QUALITY.md` §3 as written, which requires mean ≥ 4.0. Mean is **3.67**.

Reasons, stated plainly: the service corner is genuinely finished work and decisively answers Cees's "whiteboxy" complaint *for that corner*; the integration is careful and the functional record is strong. But the two frames the player actually sees most — the opening at t = 10 and the seated cockpit — are dominated by a black, untextured ring band, a dark unshadowed bay, and wayfinding text that cannot be read; and the gallery's ceiling emissives are blown. Those are the specific things the rubric scores, and the PR's own record already admits most of them as unfinished.

The three blockers are cheap: one material tweak, one emissive strength, one signage treatment. My expectation is that fixing them moves criteria 2 and 3 to ~4.5 and 4, giving a mean around 4.2. Alternatively §2 allows an explicit "polish later" decision from Cees, which does not currently exist.

I have not merged, deployed, edited runtime, switched branches or waived anything.

## 5. Remaining acceptance limits after this review

Non-rubric gates that are **still open** and are not waived by anything I did:

1. **Hardware frame budget (§5, ≤10 ms hangar/cockpit): NOT ESTABLISHED.** My own timings are SwiftShader RAF intervals (310–1,694 ms), which prove nothing about a laptop GPU. Draw/triangle budgets *do* pass on my own measurements (412–435 draws, 637 k–645 k tris vs ≤600 / ≤900 k).
2. **Orbit draw budget: 477 > 300.** Inherited — my orbit count matches the recorded base exactly (477 / 304,642), so the exterior cull fully removed this PR's 93-draw delta. Still an open gate on the branch.
3. **Asset byte budgets (§5): exceeded.** `nomad.glb` 4.71 MB and `atlas.glb` 5.65 MB against a 4 MB ship budget; `station-props.glb` 2.56 MB aggregate against a 1 MB per-prop budget with per-assembly bytes still unmeasured. Recorded as exceptions in the production record; **no one has approved them**.
4. **§4 pixel-diff regression not performed.** Baselines were not replaced and no masked pixelmatch comparison exists; all tour evidence including mine is manual inspection.
5. **Atlas is outside my captures.** My tour runs the default Nomad; my Atlas judgement rests on historical `/dev` studio images, not production lighting.
6. Build retains the pre-existing >500 kB chunk advisory; no console errors or warnings in any run I performed.

This review satisfies the §3 "Independent visual review" line item of the acceptance record — as a **completed review with a failing score**, not as a pass. Root's fixes and any merge decision follow.
