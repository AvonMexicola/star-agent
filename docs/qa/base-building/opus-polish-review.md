# Independent Opus review — polished base-building kit (PR 41)

Reviewer: independent session, harness-reported model **`claude-opus-5` (Claude Opus 5)**.
Reviewed 2026-09-07 in `/tmp/star-agent-base-work`, branch `feat/base-building`,
working tree on top of `4d934d1`. I did not author the implementation. I changed
no product source, no repo fixture and no baseline; I performed no commit, merge,
push or deployment, and I did not touch any other checkout. My capture scripts
live in `/tmp/opus-polish-scripts/` and write only to `/tmp`.

This file is new. The earlier failed review at
[opus-review.md](opus-review.md) and the blocked attempt at
[opus-review-attempt.md](opus-review-attempt.md) are preserved unchanged.

**Scope scored: the implemented polish pass only** — the rebuilt eight-piece
Blender kit, its COLOR_0 wear and white/mint fixtures, the authored GLTF placement
ghost, per-instance coverage fade, the eased door with shared visual/collision
fraction, the pooled service lights, the dialog scroll container and the console
HUD offset. Roadmap items — power, life support, engineering, survival — are not
implemented and are scored as nothing. No waiver is granted for anything.

---

## GPU handoff and what I ran myself

File, code and evidence review ran first. **No browser was started until
`/tmp/star-agent-base-polish-review-ready` appeared at 06:38:31**; I polled it with
short waits for just under five minutes while continuing source review. All browser
runs were sequential — each browser was closed before the next was launched.

Backend for every run: Chromium 151.0.7922.173,
**ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)** —
native ANGLE GL, not SwiftShader; asserted in-script, not assumed. `renderScale` 1
in every measurement. Viewports 1440x900, 1600x900 (tour) and 390x844 (phone UI).

| # | What | Result |
|---|---|---|
| 1 | `npx vite build --outDir /tmp/star-agent-base-polish-opus-dist` | exit 0, only the pre-existing >500 kB GLTFLoader advisory. Log `/tmp/star-agent-base-polish-opus-build.txt` |
| 2 | Bounded unit check: `node --test` over `build-motion`, `build-finish`, `build-geometry`, `build-state`, `build-anchors`, `build-navigation`, `build-input` | **49/49 pass, 0.76 s** |
| 3 | Own GLB audit — parse all 8 shipped `.glb`, compare to the manifest | 8/8 exact match on triangles, primitives and materials; `DoorLeafLeft`/`DoorLeafRight` wrappers present |
| 4 | Own capture pass, 1440x900 + 390x844, 24 captures | exit 0, **0 page errors, 0 console errors, 0 console warnings** |
| 5 | Own second/third/fourth capture passes (close reads, night, fade crops) | exit 0, 0 errors, 0 warnings each |
| 6 | `INTEGRATION_URL=... node scripts/integration-tour.mjs` | exit 0, 8 captures, 0 page errors / console errors / console warnings |
| 7 | Own A/B: baseline dist vs current dist, identical fixture and poses | exit 0, both sides clean |
| 8 | Own phone chip measurement (`getBoundingClientRect` on `#flight-state`) | reproduces finding 2 |

I did **not** re-run the full unit suite. Root reports 535 tests across 75 files in
23.8 s; I checked the seven bounded build files this pass actually changes and they
pass. I did not re-run the controller journey or the materials journey.
**No physical Xbox or any physical controller was used or claimed by me.**

### The URL I reviewed, and why it is not `:5296`

The production preview on `:5296` serves `dist/`, built at **06:33:45**
(`assets/main-BjwFZjhI.js`). `src/build/ui.js` and `src/controller-ui.js` were
modified at **06:35:53** — after that build. The current tree builds to
`assets/main-8831V1Gh.js`. The difference is not cosmetic: it contains
`data-controller-scroll` (`src/build/ui.js:18`, `src/controller-ui.js:83`), which is
what makes this pass's new user-facing string *"Scroll or use the D-pad to browse"*
true.

So I built the current tree myself into `/tmp/star-agent-base-polish-opus-dist`,
served it on the reviewer's isolated port **4288**, and reviewed that. The baseline
dist was served on 4289 for the A/B. `dist/` and `:5296` were left untouched.
**Rebuilding the served dist is a delivery gate (see Mergeable, item 2).**

### Honest scope of each evidence route

- My captures use an **explicit two-claim saved base** (a day site at the lunar
  landing direction, a night site at the anti-solar point) written to
  `localStorage`, plus debug start poses — the same fixture shape as
  `scripts/base-polish.spec.js`. It is a renderer, lighting, collision and
  interaction fixture. **It is not construction, not the local mining economy and
  not a controller journey.** Piece selection, `B`, `Escape`, the recipe tab and the
  `F` door interaction are the real UI and the real key bindings.
- The door trace is a 48-frame RAF sample of `starAgent.state.build.visuals.doors`
  taken while I pressed `F`. It is a numeric motion trace plus stills, **not video**.
- The claim-fade numbers are read from the live per-claim coverage value; at that
  range the structure is ~8 px, so I could not photograph the dither pattern.
- Root's own `scripts/base-polish.spec.js` run is at `/tmp/star-agent-base-polish/`
  and passed with zero errors and warnings. The numbers below are mine, not theirs;
  where they overlap (`lights.active` = 2 day and night, ghost mesh counts, door
  fraction continuity) they agree.

---

## Stage 1 — Functional correctness

### Verified fixed since the previous review

Each of these was a numbered finding in [opus-review.md](opus-review.md). I
re-checked all of them against the current tree, in code **and** in the browser.

| Old finding | Status | How I verified it |
|---|---|---|
| 1 - wall/window/doorway flip becomes a no-op | **fixed** | `src/build/system.js:73` derives the flip from `Math.floor(this.turn/2)*Math.PI`; the `tests/build-state.test.js` regression passes in my run |
| 2a - door teleports 0.8 m in one frame | **fixed** | 48-frame trace: `0.028 -> 0.104 -> 0.175 -> 0.259 -> 0.40 -> 0.45 -> 0.55 -> 0.60 -> 0.74 -> 0.93 -> 0.97 -> 1.0` over ~0.5 s; both leaves visibly translate ([mid](polish-opus/door-mid-motion.png) vs [open](polish-opus/door-fully-open.png)) |
| 2b - whole claim pops at a hard 600 m | **fixed** | coverage measured **1.000 @ 470 m, 0.498 @ 550 m, 0.031 @ 590 m, 0 @ 620 m**; `group.visible` only flips once coverage is already 0 |
| 3a - work light on in full daylight | **fixed** | in build mode I measured `visuals.lights.work` **`false` in daylight, `true` at the night site** |
| 3b - base carries no light of its own | **fixed** | `lights.active` = 2 at the base in **both** day and night; the doorway reveal that used to be black is now lit ([night](polish-opus/night-doorway-8m.png), [open reveal](polish-opus/doorway-open-reveal.png)) |
| 4 - `#keyboard-hints` and `#fleet-button` stay live in build mode | **fixed** | both measured `display: none` at 390x844 in build mode (`src/build/build.css:15`) |
| 5a - raw body id "Body **selene**" | **fixed** | `src/build/ui.js:73` resolves `nav.body?.name` |
| 5b - interaction chip lands on the console's own status line | **fixed** | chip measured at `top: 590` on desktop, clear of the panel ([console](polish-opus/mainframe-console-chip.png)) |
| 5c - recipes clipped mid-card; 4 of 6 below the fold on phone | **fixed** | desktop 4/6 cards fully visible, no clip, Close pinned at y~129, hint pinned at the bottom ([desktop](polish-opus/recipes-desktop.png), [phone](polish-opus/recipes-phone.png)) |
| 5d - dead "100 batches" preset | **fixed** | presets are now `1 / 10 / Max`, and `Max` derives from actual pack contents (`src/build/ui.js:51,56-59`) |
| - placement ghost is collider boxes | **fixed** | all 8 ghosts are the authored mesh; mesh counts 3-10 match the shipped primitive counts exactly ([stairs](polish-opus/ghost-stairs.png), [window](polish-opus/ghost-window.png)) |
| - `build.state` deep-cloned every frame for the HUD | **fixed** | `src/build/ui.js:109` now reads `build.preview` / `build.pieceId` |
| - invalid ghost used ad-hoc `0xffb56b` | **fixed** | `src/build/visuals.js:6` uses the `--warning` value `0xe2bf87` |

### Contract checks that hold

- **Costs, bounds and collision names are untouched.** `src/build/definitions.js` is
  not in the diff, so `PIECES[*].cost`, the colliders, `support` and
  `AUTHORED_BOUNDS` are byte-identical. I parsed all eight shipped GLBs myself:
  every piece stays inside its `AUTHORED_BOUNDS`, and the `DoorPanel` /
  `DoorLeafLeft` / `DoorLeafRight` wrapper hierarchy survives the new material
  batching.
- **The manifest is truthful.** My own parse matches it exactly on triangles, draw
  primitives and material lists for all eight pieces.
- **Asset budgets hold per asset.** Largest is `stairs.glb` at **5,616 tris /
  478 kB** — inside the 10 k tris / 1 MB prop budget. Textures unchanged at
  1024-squared WebP or below.
- **Visual and collision door fractions are the same number on every frame I
  sampled** (48/48 `colliderFraction === fraction`), and `constrainWalker`
  (`system.js:254`) and `raycast` (`:272`) both consume the live fraction.
- **The safe pause is genuinely safe.** `canCloseDoor` (`system.js:184`) sweeps the
  **union** of the previous and next leaf boxes, so a long frame cannot tunnel a
  leaf through a person; the blocked branch withholds `elapsed`, so motion resumes
  from where it paused rather than restarting.
- **Persistence stores the target, not the fraction.** After a reload the saved
  endpoint is restored instantly with no replay (`target: true, fraction: 1`), and
  the full claim payload round-trips identically.
- **The coverage shader is real, and it compiles.** `customProgramCacheKey`
  returning a constant is safe here: Three appends it to the full parameter key and
  keeps a **per-material** program map, so each faded instance still receives its own
  `buildVisibility` uniform. Confirmed empirically — zero shader errors across five
  browser sessions, and the fade measurably works.
- **Disposal isolates instances.** `disposeBuildVisual` frees only the per-instance
  material clones plus the console's own canvas texture and plane; the shared GLTF
  geometry, the cached template and the concrete textures survive
  (`tests/build-finish.test.js`, re-run by me).

### New functional findings

**F1 — P2 - the base interaction chip runs off a phone screen.**
`src/build/build.css:34-35`.
The new `#flight-state.base-target` rule adds `max-width:calc(100vw - 32px)` but the
element inherits `white-space:nowrap` from `src/style.css:4`
(`.exploring #flight-state`). With the label this pass itself introduces —
`F / X - Closing paused - step clear - Open base door` (`src/build/system.js:240`) —
at 390x844 I measured the box clamped to **358 px (x 16 -> 374)** while the text runs
from **x 43.8 to x 402.4**: 28 px past the chip background and 12 px past the
viewport. The word "door" is cut off ([capture](polish-opus/chip-phone-clipped.png)).
The existing `documentElement.scrollWidth <= innerWidth` assertion in
`scripts/base-polish.spec.js` cannot catch this, because the HUD is fixed-position
and never extends the document scroll width.
**Fix:** add `white-space:normal;text-align:center` (or
`overflow:hidden;text-overflow:ellipsis`) to `#flight-state.base-target`, or shorten
the blocked label to `Closing paused - Open base door`.

> **Addendum, same session — fixed and verified.** While I was writing this report
> root changed `src/build/build.css` (07:02:02) to add
> `.exploring #flight-state.base-target{white-space:normal;align-items:center;line-height:1.6}`
> and `#flight-state.base-target #state-text{min-width:0;overflow-wrap:break-word}`,
> and added a phone-viewport regression to `scripts/build-ui.spec.js`. I rebuilt the
> tree, served it on port 4290 and re-ran my own measurement: the same label now
> measures **x 125.3 -> 279.5 inside a 195 px box on a 390 px viewport**, wrapping to
> three lines with nothing clipped ([after](polish-opus/chip-phone-blocked-after.png)).
> The finding stands as found at the reviewed content. I verified only this one fix,
> and it does not change the scores, which were taken before it landed. One cosmetic
> residue: the diamond icon is a flex sibling, so it centres against the three-line
> block rather than sitting on the first line.

**F2 — P3 - the console offset fires for doorways and crates too.**
`src/main.js:316` toggles `base-target` on `Boolean(build.nearbyInteraction())`,
which is true for `mainframe`, `crate` **and** `doorway`. The 140 px (desktop) /
110 px (phone) drop exists purely to clear the mainframe's display panel
(`src/build/mainframe-display.js:11`, panel centre at y = 1.25 m). At a doorway or
crate it just pushes the prompt 140 px away from the reticle for no reason.
**Fix:** `build.nearbyInteraction()?.p.type === 'mainframe'`.

**F3 — P3 - `nearbyInteraction()` runs at least twice per frame and allocates.**
`src/main.js:316` calls it, then `nav.interaction` (`src/navigation.js:212` ->
`src/main.js:131` -> `src/build/system.js:240`) calls it again in the same HUD tick.
Each call does a `claims.flatMap` building a `{c,p,d,f}` object and two `Vector3`
per interactable piece, then sorts. At the documented 8 claims x 64 pieces cap that
is up to ~1,000 short-lived objects per frame while merely walking near bases.
**Fix:** resolve it once per frame in `main.js` and pass the hit to both consumers,
or memoise on `revision` plus camera position.

**F4 — P3 - a forced synchronous layout every frame while the dialog is open.**
`src/build/ui.js:107` reads `content.scrollHeight`, `clientHeight` and `scrollTop`
on every `update()`, which runs from the RAF loop (`src/main.js:375`). Reading
`scrollHeight` flushes style and layout each frame. The scene draw is skipped while
a dialog is open, so it does not show in the frame budget, but it is an avoidable
per-frame reflow. **Fix:** recompute in `render()` plus a `scroll` listener and a
`ResizeObserver`.

**F5 — P4 - the prompt reports the persisted target, not the live leaf.**
`src/build/system.js:240` reads `hit.p.doorOpen`, so the chip flips to "Close base
door" the instant you press `F`, while the leaves are still 0.5 s from open.
Verified in my run. Cosmetic, but it is the one place the new live fraction is not
used.

---

## Stage 2 — QUALITY.md section 3 visual rubric

All scores come from **my own captures**, at the poses listed, 1440x900 desktop and
390x844 phone, on native ANGLE GL at `renderScale` 1.

| # | Criterion | Score |
|---|---|---:|
| 1 | Silhouette & scale | **4** |
| 2 | Materials & detail | **4** |
| 3 | Lighting & integration | **4** |
| 4 | Cohesion | **4** |
| 5 | Information design / function | **4** |
| 6 | Motion | **4** |
| | **Average** | **4.0** |

**The visual rubric passes, at exactly the minimum, with no item below 3.** It does
not on its own make the PR mergeable — see the closing section.

### 1 - Silhouette & scale — 4

At [16 m](polish-opus/kit-16m.png) and [43 m](polish-opus/kit-43m.png) the
staircase, deck, glazed wall, doorway, crate and mainframe are each individually
identifiable, and scale reads correctly against the 1.8 m eye height and the door
aperture. The placement ghost now has a real silhouette for every piece — mesh
counts 3-10, matching the export primitive counts exactly — which closes the biggest
hole in the old score. Held back by A2 (no readable silhouette at 30 m at night), A4
(blank roof slab and far elevation at 40 m), and 25 mm handrails still aliasing to
hairlines at that range.

### 2 - Materials & detail — 4

Verified in the shipped binaries, not just claimed: every mesh in all eight GLBs
carries `COLOR_0`, `MineralConcrete` uses vertex colours, and each module now ships
five materials (mineral concrete / white armour / dark polymer / edge steel / mint
status). At 2-4 m ([doorway face](polish-opus/doorway-face-4m.png)) the board-cast
seams, form-tie caps, cast joints, tread nosings, `FactionMount` shoes, mint status
dashes, head track, jambs and pull handles all read, and the stair's rear elevation —
previously a featureless slab — now carries armour strips, service bands, an
inspection plate and vents, visible through
[the open reveal](polish-opus/doorway-open-reveal.png). Held back by A4: the added
wear is high-frequency only, so by 40 m the whole kit collapses to one flat cream.

### 3 - Lighting & integration — 4

This is the row that moved most, and the row with the most left to do.

Fixed and measured: the placement work light is now night-gated (`work:false` in
daylight build mode, `work:true` at the night site), four pooled service
`PointLight`s spill in **both** day and night (`lights.active` = 2 at the base in
each), and the doorway threshold pool makes the reveal legible where it used to be
pure black. [At night](polish-opus/night-kit-26m.png) the outpost reads as a lit
structure in the dark, restrained rather than gaudy. The kit sits in the scene's ACES
exposure and casts and receives shadows correctly.

Held back by **A1** — the rubric's 5 explicitly says "no blown emissives", and the
mainframe console's own bezel clips to white at the standard interaction pose
([console](polish-opus/mainframe-console-chip.png)) — and by **A2**. Two tuning
defects at opposite ends of the range keep this off a 5. It is no longer the
*absence* of lighting that earned the previous 3.

### 4 - Cohesion — 4

`src/build/build.css` still contains **zero raw hex**; every colour in the new rules
is `var(--mint)`, `var(--line)`, `var(--muted)`, `var(--warning)` or `var(--mono)`.
The invalid ghost moved off its ad-hoc amber onto the `--warning` token. Build mode
now suppresses `#keyboard-hints` and `#fleet-button`, so a keyboard player no longer
keeps a wrong hint bar and the fleet shortcut no longer sits on the phone touch row.
The kit gained a real faction tie — `WhiteArmour` mounting shoes, corner armour and
railing posts, `MintStatus` dashes — so it now reads as the same product as the ships
and station rather than a separate concrete family. Held back by A1 (the mint spill
washes the console's white armour green, introducing a third colour family on the one
module every base must have) and by F1/F2.

### 5 - Information design / function — 4

The dialog is now a proper flex column: Close and tabs pinned, the list scrolling in
its own container, a persistent "More below - Scroll or use the D-pad to browse"
affordance, no mid-card clipping. Desktop shows 4 of 6 recipe cards fully;
`scrollHeight 667 / clientHeight 468`. The D-pad claim in that string is true in the
current source — focus movement calls `scrollIntoView({block:'nearest'})`
(`src/controller-ui.js:39`) and the right stick now targets
`[data-controller-scroll]` (`:83`) — **but that fix is not in the dist on `:5296`.**
"Body" resolves to "Selene", the dead 100-batch preset is gone, `Max` derives from
real pack contents, and the placement HUD names piece, reason, cost, source container
and ship-cargo reachability
([placement, phone](polish-opus/placement-hud-phone.png)). Held back by F1 (a
reachable label clips off a phone screen), A3 (2 of 6 recipes on phone) and F2.

### 6 - Motion — 4

Both defects that made this a 3 are gone, and I measured both rather than reading
them. The door eases over ~0.5 s on a smoothstep, both leaves physically translate on
screen, and the collider follows the visible leaf on every sampled frame. The 600 m
hard pop is replaced by a continuous 500-600 m coverage ramp. Held back by three
things: at 550 m the base subtends ~8 px
([crop](polish-opus/fade-550m-crop.png)), so the fade removes the pop but nobody can
see the craft in it; the shadow depth material is not faded, so a fading claim keeps
a full-strength shadow; and the service lights have no easing of their own at the
claim-fade boundary. I reviewed a 48-frame numeric trace and stills, **not video**.

---

## Top 5 findings — file, element, fix

**1 — Art/P2 - service PointLights blow out their own housings and green the white armour.**
`src/build/system.js:219` (offsets) and `:229` (intensities). The mainframe light
sits at local `[0,1.50,-.44]` — 5 cm off the console face, 25 cm above the display —
and the doorway light at `[0,2.36,-.30]`, ~7 cm off the threshold housing. With
`light.distance` 4 / 6 and inverse-square falloff, the surface directly behind each
light clips to white, so a fixture that should read as a housing with a diffuser reads
as a bare bloom, and the `WhiteArmour` bezel turns saturated mint
([console](polish-opus/mainframe-console-chip.png),
[night](polish-opus/night-kit-26m.png)).
**Fix:** pull each light 0.25-0.35 m off its face (mainframe ~ `[0,1.62,-.62]`,
doorway ~ `[0,2.36,-.55]`), drop the peaks to ~4 / 5, and let the authored
`MintStatus` emissive carry the fixture read.

**2 — Functional/P2 - the interaction chip clips off a 390 px screen.**
`src/build/build.css:34` — `#flight-state.base-target` adds `max-width` but inherits
`white-space:nowrap` from `src/style.css:4`. Measured text extent x 43.8 -> 402.4 on a
390 px viewport with the blocked-door label
([capture](polish-opus/chip-phone-clipped.png)).
**Fix:** `white-space:normal;text-align:center` on the `.base-target` rule, or shorten
the label in `src/build/system.js:240`.
**Status: fixed by root at 07:02:02 and re-verified by me** — see the addendum under
F1. Ranked here because it was live in the content I scored.

**3 — Art/P2 - the outpost is unfindable at 30 m at night.**
`src/build/motion.js:6` (`serviceLightFade` reaches 0 at 28 m) and `:24`
(`nearestServiceLights` filters `distance < 28`). At 31 m only the mainframe's canvas
display registers and the module silhouette is gone
([night at 31 m](polish-opus/night-kit-31m.png) versus
[26 m](polish-opus/night-kit-26m.png)). The authored emissive strips
(`ThresholdLightDiffuser` 1.16 x 0.026 m, `ConsoleLightDiffuser` 0.018 x 0.56 m)
subtend well under a pixel at that range.
**Fix:** extend the doorway pool to ~45 m at low intensity, or widen the `MintStatus`
band on the door head and the deck `SurveyStatus` corners so an outpost is a
navigational landmark at night.

**4 — Art/P3 - the placement ghost has no depth relationship with the scene.**
`src/build/visuals.js:301` sets `transparent` and `depthWrite:false` on every ghost
material, so the preview paints over geometry **in front of** it as well as behind. In
[ghost-window](polish-opus/ghost-window.png) the far side of the base shows through
the near ghost face as a stack of pale rectangles.
**Fix:** keep `depthWrite:false` for the colour pass but add a thin `depthWrite:true`
pre-pass, or render the ghost in a second sorted pass, so it self-sorts against the
world.

**5 — Art/P3 - the kit collapses to a single flat value by 40 m.**
`blender/build_base.py:52` — the `broad` term is
`sin(v.x*1.7+seed)*sin(v.y*.8+v.z*1.3)*.10`, a high-frequency plus/minus 0.10 wobble.
It reads beautifully at 10 m or nearer and is gone by 40 m, where the mint dashes, the
`FactionMount` shoes and the form ties are all sub-pixel and the flat roof slab and far
elevation carry nothing ([43 m](polish-opus/kit-43m.png)).
**Fix:** add one large-scale value break per module — a wider `DarkPolymer` band at the
parapet, or a low-frequency (~0.15-0.3 cycles per module) term in `broad`.

Below the top five: **A3** — the phone recipe list shows 2 of 6 cards
(`scrollHeight 1235 / clientHeight 444`); each card is ~200 px for four short lines, so
collapsing Consume/Produce onto one line would roughly double the visible density. Plus
**F2**, **F3**, **F4** and **F5** above.

---

## Performance — measured, and what it does and does not establish

**Fixed-viewpoint tour**, my own run, seed 7291, 1600x900, `renderScale` 1, native
ANGLE GL. Evidence `/tmp/star-agent-base-polish-opus-tour/record.json`.

| View | Draw calls | Triangles | RAF median | Section 5 budget |
|---|---:|---:|---:|---|
| Orbit | 491 | 338,450 | 16.7 ms | **draws over 300 - FAIL** - tris ok |
| Coast, 95 m | 530 | 1,167,404 | 16.7 ms | ok |
| Forest, 95 m | 669 | 1,308,848 | 16.7 ms | ok |
| Highlands, 700 m | 326 | 658,836 | 16.7 ms | ok |
| Hangar opening | 614 | 932,546 | 16.7 ms | **draws over 600 - FAIL** - **tris over 900 k - FAIL** |
| Cockpit, seated | 554 | 799,556 | 16.7 ms | ok |

These reproduce the previous review's numbers **exactly** (491 / 338,450 and
614 / 932,546). **Orbit and hangar fail the section 5 numeric budgets.** Both are
inherited from the integration base rather than introduced by this pass, but per the
review brief whole-world inherited budget failures cannot be waived here, so they stay
open.

**Modal row:** the map captures report 490 draws / 338,446 triangles, which are stale
counters — `src/main.js` returns before the counter reset while the map is open and
skips the scene draw whenever a dialog is open. Satisfied by construction, not measured.

**Selene base scene** (my captures, 1440x900, `renderScale` 1): **150-576 draw calls,
874 k - 1.37 M triangles**, RAF median 16.7-49.9 ms. Selene surface is not a section 5
row; the closest analogue (Surface, 900 draws / 1.8 M tris) is not exceeded.

**Cost of the polish, measured A/B** — same 10-module fixture, same poses, baseline dist
(`/tmp/star-agent-base-polish-baseline-dist`) versus the current build:

| Pose | Baseline | Polished | Delta |
|---|---|---|---|
| Kit at 15.7 m | 161 draws / 946,118 tris | **198 / 961,470** | **+37 draws (+23%)** |
| Kit at 31 m | 173 draws / 969,838 tris | **205 / 979,654** | **+32 draws (+18%)** |

Kit asset totals moved from 14,976 to **21,228 triangles** (+42%), 28 to **41 draw
primitives** (+46%) and 1,071,916 to **1,869,528 bytes** (+74%). The measured draw
delta is roughly twice the primitive delta because shadow-casting meshes are drawn in
both the shadow and colour passes. The cost is real and worth knowing, but it does not
breach any section 5 row.

**No frame-time gate is established by anything here.** Every timing number in this
branch and in my runs is a `requestAnimationFrame` interval — 16.7 / 33.3 / 49.9 ms,
i.e. display-refresh quantisation — not isolated GPU execution time. The section 2
"ms/frame within budget" checkbox is **unmet, not passed**.

---

## Mergeable

**No** — despite the rubric passing at exactly 4.0. Four gates remain open (1, 2, 4, 5
below); gate 3 closed during the review.

1. **Section 5 budget failures stand**, independently reproduced at orbit (491 draws)
   and hangar (614 draws / 932,546 triangles). Inherited, but not waivable here.
2. **The delivered artefact is not the reviewed source.** `dist/`, and therefore the
   production preview on `:5296`, was built before `src/build/ui.js` and
   `src/controller-ui.js` changed, and is missing the `data-controller-scroll` fix that
   makes this pass's own user-facing D-pad string true. Rebuild and re-verify before
   delivery.
3. ~~**Finding 2 is a live UI clipping defect** on a phone.~~ **Closed** — root landed
   the CSS fix and a phone regression test at 07:02:02, and I re-measured it clean on
   a fresh build. Noted because it was open in the content I scored, and because it
   means the reviewed tree moved during the review: `src/build/build.css`,
   `scripts/build-ui.spec.js` and `scripts/capture-base-kit.mjs` all changed after my
   captures, on top of commit `9ea6b32`.
4. **Controller acceptance is unchanged by this pass and remains incomplete** by the
   branch's own record. `controller.md` states the full controller runner has not passed
   for the full-kit route; this pass's controller use is an injected Gamepad tap and
   stick walk, explicitly labelled in `scripts/base-polish.spec.js` as not a construction
   journey. AGENTS.md makes a complete controller journey mandatory. The pass also *adds*
   a user-facing D-pad browse instruction with no controller test covering it.
   **Physical Xbox hardware: untested by anyone.**
5. **No frame-time gate is established**, as above.

The rubric score is a genuine pass and the work behind it is real: eleven of the
previous review's numbered defects are fixed, and I verified each one in the browser
rather than accepting the claim. Findings 1-5 above are all bounded tuning or
one-to-few-line changes; none requires a rebuild of the kit. I did **not** verify any
fix to my own findings, and re-scoring after fixes needs a fresh pass.

**I grant no "polish later" waiver and no budget waiver. That is Cees's call, not a
reviewer's.**

---

## Limitations of this review

- No physical controller and no physical Xbox hardware was used or claimed.
- I reviewed stills, a 48-frame numeric door trace and source. The motion findings are
  measured, not video-captured.
- The claim-fade evidence at 500-600 m is numeric; at that distance the structure is
  ~8 px, so I could not photograph the coverage dither.
- My close-range captures contain a large blown highlight from the **equipped mining
  tool's own lamp** (`src/mining/tool.js:18`, a `SpotLight` at intensity 4 / range 12).
  That is inherited behaviour, present on baseline, and **not** a base-building defect —
  I flag it so nobody mistakes it for one. It persisted through `R` and through EVA mode
  in my runs, which is itself worth a look by whoever owns that module.
- I did not re-run the full unit suite, the controller journey, the materials journey or
  the build-UI fixture. Their status is as recorded by their owners.
- I reviewed my own build of the current tree on port 4288, not the stale dist on
  `:5296`. See gate 2.
- I edited no product source, no fixture and no baseline, and neither committed, pushed,
  merged nor deployed.

---

## Evidence

**In the repo** — [kit at 43 m](polish-opus/kit-43m.png) -
[kit at 16 m](polish-opus/kit-16m.png) -
[doorway face at 4 m](polish-opus/doorway-face-4m.png) -
[open doorway reveal and stair rear](polish-opus/doorway-open-reveal.png) -
[mainframe console and chip offset](polish-opus/mainframe-console-chip.png) -
[door mid-motion](polish-opus/door-mid-motion.png) -
[door fully open](polish-opus/door-fully-open.png) -
[authored stairs ghost](polish-opus/ghost-stairs.png) -
[authored window ghost](polish-opus/ghost-window.png) -
[night doorway fixture at 8 m](polish-opus/night-doorway-8m.png) -
[night kit at 26 m](polish-opus/night-kit-26m.png) -
[night kit at 31 m](polish-opus/night-kit-31m.png) -
[recipes desktop](polish-opus/recipes-desktop.png) -
[recipes phone](polish-opus/recipes-phone.png) -
[placement HUD, phone](polish-opus/placement-hud-phone.png) -
[clipped chip, phone](polish-opus/chip-phone-clipped.png) -
[claim at 550 m, cropped](polish-opus/fade-550m-crop.png) -
[chip after root's fix](polish-opus/chip-phone-blocked-after.png).

**Outside the repo** — `/tmp/star-agent-base-polish-opus/` (`record.json`,
`record-2.json`, `holstered/record-3.json`, `eva/record-4.json`, `ab-cost.json`,
`chip-check.json` and all raw captures) - `/tmp/star-agent-base-polish-opus-tour/`
(`record.json`) - `/tmp/star-agent-base-polish-opus-build.txt` -
`/tmp/star-agent-base-polish-opus-dist/` (my build of the reviewed tree) -
`/tmp/opus-polish-scripts/` (`polish-capture.mjs`, `polish-capture-2.mjs`,
`polish-capture-3.mjs`, `polish-capture-4.mjs`, `ab-cost.mjs`, `chip-check.mjs`).

READY FOR REVIEW: docs/qa/base-building/opus-polish-review.md, docs/qa/base-building/polish-opus/
