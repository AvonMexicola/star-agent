# Independent Opus review — field materials and base construction

Reviewer: independent Opus session, harness-reported model `claude-opus-5` (Claude
Opus 5). Reviewed 2026-09-07 in `/tmp/star-agent-base-work`, branch
`feat/base-building` on base `6f80fc0`. This reviewer did not author the
implementation, changed no runtime source, no repo fixture and no baseline, and
performed no commit, merge or deployment. The earlier blocked attempt is preserved
separately at [opus-review-attempt.md](opus-review-attempt.md); this file does not
replace it.

The scope scored here is the **implemented slice only**: eight authored modules,
field recipes, shared material inventory, mainframe claims/buffer and Aeon/Pyre
construction outcrops. The progression roadmap in
`docs/design/base-building-plan.md`, including its Miasma proposals, is **not
implemented and is scored as nothing**.

## What I ran myself

GPU handoff was respected: file, code and evidence review ran first, and no
browser was launched until `/tmp/star-agent-base-review-ready` appeared at
00:07:23. All three browser runs were sequential; each browser closed before the
next started.

| # | Command | Result |
|---|---|---|
| 1 | `npm run build` | exit 0 — only the pre-existing >500 kB GLTFLoader chunk advisory. Log `/tmp/star-agent-base-opus-build.txt` |
| 2 | `BASE_SCENE_EVIDENCE=/tmp/star-agent-base-opus-scene npm run test:browser -- -c scripts/base-scene.config.js` | exit 0, 1 passed (35.7 s). Log `/tmp/star-agent-base-opus-scene-run.txt` |
| 3 | `INTEGRATION_URL=http://127.0.0.1:5296 INTEGRATION_EVIDENCE=/tmp/star-agent-base-opus-tour node scripts/integration-tour.mjs` | exit 0, 8 captures, zero page errors / console errors / console warnings |
| 4 | `node /tmp/opus-review-scripts/extra-capture.mjs` (my own script, own `/tmp` output) | exit 0, 11 captures, zero errors, zero warnings |

Backend for every run: Chromium 151.0.7922.173, **ANGLE (AMD, AMD Radeon 860M
Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)** — native ANGLE GL, not
SwiftShader. Viewports 1600×900 (tour), 1440×900 and 390×844.

I did **not** re-run the unit suite; root's log `/tmp/star-agent-base-tests-final.txt`
records 68/68 files passing. Root's referenced `/tmp/star-agent-base-build-final.txt`
does not exist on disk, so I produced my own build log instead (run 1 above).
**No physical Xbox hardware test is claimed by me or by this branch.**

### Honest scope of each evidence route

I checked these claims against the scripts, not just the prose, and they hold:

- `scripts/base-scene.spec.js` writes an **explicit ten-module saved base** to
  localStorage and sets start poses through `navigation`. It is a renderer,
  collision and interaction fixture. It is **not** controller construction, and
  the branch's `integration.md` says so.
- The Aeon/Pyre material journeys in `materials-acceptance.md` use **start-pose
  landing/aiming fixtures** and then mine, craft and place for real.
- The controller route in `controller.md` is **input-only with finite imported
  stock** (22 kg pack / 54–62 kg ship written before load), not the local mining
  economy.
- My own extra captures use the same saved-base and start-pose fixture pattern,
  but the door opening, the palette, the tab switches and the piece selection are
  the real `F`, `B` and real buttons.

## Scores — QUALITY.md §3

| # | Criterion | Score |
|---|---|---:|
| 1 | Silhouette & scale | **4** |
| 2 | Materials & detail | **4** |
| 3 | Lighting & integration | **3** |
| 4 | Cohesion | **4** |
| 5 | Information design / function | **3** |
| 6 | Motion | **3** |
| | **Average** | **3.5** |

**Visual review does not pass.** No item is below 3, but the average is 3.5,
under the 4.0 merge bar. I do not grant a "polish later" waiver; that is Cees's
call, not a reviewer's.

### 1 · Silhouette & scale — 4

At [30 m](opus/kit-30m.png) the staircase, deck, wall, glazed wall, doorway and
mainframe are each individually identifiable — this is not a blob. Scale reads
correctly against the 1.80 m reference in the studio sheet and against the
astronaut in-game; the mainframe is convincingly person-height in
[my close view](opus/mainframe-display.png). Held back by three things: the
placement ghost has no silhouette at all (see §5), the staircase's rear face is a
featureless slab when seen through the open doorway, and the 25 mm handrails
alias into hairlines at 30 m.

### 2 · Materials & detail — 4

Close up ([placement-wall-near-base](opus/placement-wall-near-base.png),
[doorway-open-outside](opus/doorway-open-outside.png)) the kit has real
definition: board-cast seams, casting-tie insets, steel edging on the wall tops,
tread nosings, a dark head track and floor track, door handles and a mint-tinted
glazed pane. This is comfortably past whitebox. Held back by: one material for
all eight pieces with no wear, grime or value variation between them; at 30 m the
lit faces collapse to a single flat cream; and the shipped placement preview is
untextured boxes.

### 3 · Lighting & integration — 3

The kit sits in the scene's ACES exposure, casts and receives shadows correctly,
and the mainframe display is legible without blowing out. The reason this is a 3
and not a 4: **the base carries no light source of its own.** Interiors, the
doorway reveal, the stair risers and every shadowed face go to pure black on
Selene ([scene-base-exterior](opus/scene-base-exterior.png)). QUALITY §1 requires
"Night has light sources" and "Hangars are lit by their lights"; a structure the
player walks inside is the same case. The mainframe panel is a
`MeshBasicMaterial` with `toneMapped:false` and spills no light onto its own
bezel or the ground, so a lit console in a dark scene reads as a sticker. The
work light is also on in full daylight, contradicting the documented "night
placement has a forward work light".

### 4 · Cohesion — 4

`src/build/build.css` contains **no raw hex** — every colour is `var(--mint)`,
`var(--line)`, `var(--muted)`, `var(--warning)`, `var(--dialog-bg)`, `var(--mono)`.
The dialog uses the base `dialog` chrome, 44 px targets, mint focus rings and
amber warnings, and reads as the same product as the inventory and map
([palette](opus/palette-desktop.png), [recipes](opus/recipes-desktop.png)). Held
back by: build mode does not suppress `#keyboard-hints` or `#fleet-button`
(finding 4), and the mineral-concrete kit carries no white-armour or mint faction
cue tying it to the ships and station — it is a self-consistent but separate
visual family.

### 5 · Information design / function — 3

Strong: recipe cards state exact consume/produce/reason and disable correctly
("Requires 8 kg aggregate."); the placement HUD names piece, reason, cost and
source container; the mainframe display shows live owner, radius, module count
and buffer state. What holds it to 3 is a stack of concrete defects — the raw
`selene` body id, the interaction chip landing on the mainframe's own status
line, four of six recipes below the fold, a dead "100 batches" preset and a
ghost that shows a footprint but not the piece. See findings 4 and 5.

### 6 · Motion — 3

Two code-verified defects, and I am explicit that I reviewed stills and source,
not a motion capture: the pocket door has no animation at all, and a whole claim
pops at a hard 600 m. Positives: no LOD popping, morphing or pending tiles in any
tour capture (`lod.settled` true everywhere), and the HUD throttles its rerenders
behind a snapshot compare. See finding 2.

## Ranked findings

### 1 — P1 functional: wall / doorway / window facing flip silently stops working

`src/build/system.js:38` (`select()`) and `src/build/system.js:68`.

`rotate()` steps `this.turn` by **2** for wall-category pieces, and the wall
candidate list only applies the 180° flip when `this.turn % 2 === 0`. `select()`
resets `snap` and `height` but **not** `turn`. So once `turn` is odd it stays odd
forever for walls (1↔3), and the documented flip becomes a no-op.

Trigger: enter build → select **Concrete foundation** → press **Q** or **E**
once (`turn = 1`) → select **Concrete wall** → press **E**. Reproduced headlessly:

```text
turn 0 -> wall candidate rotations [ 3.1416, 1.5708, -1.5708, 0 ]
turn 1 -> wall candidate rotations [ 3.1416, 1.5708, -1.5708, 0 ]   <- identical to 0
turn 2 -> wall candidate rotations [ 6.2832, 4.7124, 1.5708, 3.1416 ]
turn 3 -> wall candidate rotations [ 3.1416, 1.5708, -1.5708, 0 ]   <- identical to 0
after one Q/E on a foundation, turn = 1
wall E presses from there: [ 3, 1, 3, 1 ]                            <- never even again
```

This breaks a control that `docs/base-building.md`, `docs/controller-contract.md`
and `controller.md` all promise ("Rotate / flip wall facing · Q / E · LB / RB"),
on keyboard, controller and touch alike, with no feedback that it did nothing.

**Fix:** add `this.turn = 0;` to `select()` beside the existing `snap`/`height`
resets, or clear the low bit when the incoming piece is wall-category.

**Addendum, same session:** while this report was being written, root changed
`src/build/system.js:68` to `rotation: p.rotation + Math.floor(this.turn/2)*Math.PI`
and added a `tests/build-state.test.js` regression covering wall, window and
doorway against every carried turn and both rotation directions. I re-ran my own
reproduction against that working tree: turn 3 now yields the flipped rotations,
so 1↔3 alternates 0 and π as intended, and root's new regression passes (1/1).
The finding stands as found at the reviewed branch content; I verified only this
one fix, and it does not change the score, which was taken before it landed.

### 2 — P2 motion: the door teleports, and a whole base pops at 600 m

`src/build/system.js:166` and `:208`; `src/build/visuals.js:27`;
`src/build/system.js:190`.

`interact()` flips a boolean and `sync()` calls `setDoorOpen(model, doorOpen?1:0)`.
`setDoorOpen` already takes a 0–1 fraction and moves each leaf by `fraction*0.8`,
but nothing ever drives it between the endpoints — so a "manual sliding pocket
door" jumps 0.8 m per leaf in a single frame. `docs/base-building.md` says the
leaves "slide into their own jambs".

Separately, `update()` does `group.visible = distanceTo(nav.position) < 600` with
no hysteresis and no fade. A ten-module base is roughly 10 px tall at 600 m at the
game's 52° vertical field of view on a 900-px-high viewport, so the entire structure appears and disappears as one object
at a fixed radius. QUALITY §1 names popping as a defect by itself.

**Fix:** store a per-piece `doorFraction`, ease it in `update(dt)` over ~0.5 s
and feed `setDoorOpen`; the collider already accepts the same fraction. For
visibility, add hysteresis (show at 600 m, hide at 660 m) or a short opacity
fade.

### 3 — P2 lighting: the base has no light of its own

`src/build/system.js:28` and `:192`; `src/build/mainframe-display.js:42`.

The only light the construction system owns is the placement work light, and it
is enabled whenever build mode is active regardless of sun elevation
(`workLight.visible = this.active && nav.enabled && nav.focused`) — the opposite
of the documented night-only behaviour. Once the player leaves build mode there
is nothing: no threshold light at the doorway, no interior fixture, no emissive
strip. The mainframe's mint panel is unlit geometry with `toneMapped:false` and
casts no spill.

**Fix:** gate the work light on the sun/ambient term already available to
`lighting.update`, and give the mainframe a small mint `PointLight` (or an
emissive bezel) so a powered console reads as a light source. A cheap threshold
light on the doorway would also fix the black reveal in
[doorway-open-outside](opus/doorway-open-outside.png).

### 4 — P2 UI conflict: build mode leaves two foreign controls live

`src/build/build.css:15` — `.building #loadout-bar,.building #controller-hints{display:none!important}`.

Two elements are missed:

- `#keyboard-hints` (rendered from `src/main.js:279`) stays on screen and still
  reads `T / MOUSE · MINE` and `F · INTERACT` while, in build mode, **T** is
  "next snap" and **F** does nothing. Visible in
  [placement-foundation-desktop](opus/placement-foundation-desktop.png). Note the
  asymmetry: a controller player *does* lose their hint bar, a keyboard player
  keeps a wrong one.
- `#fleet-button` (`src/fleet.css:1`, `bottom:100px; z-index:8`) sits **on top of**
  the placement touch row on phone, overlapping the "Height +" button — see
  [placement-foundation-phone](opus/placement-foundation-phone.png). `#build-hud`
  is `z-index:6`, so the fleet shortcut wins. This is a touch-reachability
  regression the focused UI fixture could not see, because that fixture page has
  no fleet button.

**Fix:** one line — extend the rule to
`.building #loadout-bar,.building #controller-hints,.building #keyboard-hints,.building #fleet-button{display:none!important}`.

### 5 — P3 information design: four concrete defects in the new UI

- **`src/build/ui.js:65`** — the Mainframe overview prints the raw body id:
  "Body **selene**", lowercase, in a player-facing panel. Every other screen in
  the game says "Selene". Fix: resolve through `BODIES` and show `body.name`.
- **`src/build/mainframe-display.js:43`** (`mesh.position.set(0,1.25,-.392)`) —
  at the pose where you actually press F, the centre interaction chip
  "◇ F / X · Base mainframe" lands directly on the display's own
  "SUPPLY LINK OFF" line: [mainframe-display](opus/mainframe-display.png). Fix:
  raise the display panel on the cabinet face, or offset the chip when the target
  is a mainframe.
- **`src/build/build.css:1`** — the dialog inherits `max-height:88vh; overflow:auto`,
  so Recipes *does* scroll, but with no affordance and a hard mid-card clip:
  **the last 2 of 6 recipes are cut mid-card at 1440×900, and 4 of 6 are below the
  fold on a 390×844 phone**
  ([desktop](opus/recipes-desktop.png), [phone](opus/recipes-phone.png)). Fix: a
  sticky tab row plus a bottom fade, or a denser card at ≥3 columns.
- **`src/build/ui.js:50`** — the `100 batches` preset can never validate: 100
  batches of any recipe needs 100 kg of input against a 24 kg two-box backpack,
  and `10 batches` of "Press dry concrete" needs 80 kg aggregate. Fix: derive the
  presets from `store.free`/`limits('pack')`, or replace 100 with "max".

Also worth doing, below the top five:

- **Placement ghost is collider boxes, not the piece.** `src/build/system.js:179`
  builds the preview from `getLocalColliders()` as translucent `BoxGeometry`, so
  a foundation preview is a flat mint slab and an invalid one is a flat amber slab
  ([valid](opus/placement-foundation-desktop.png),
  [invalid](opus/placement-wall-near-base.png)). The GLTF template is already
  loaded and cached in `src/build/visuals.js`; cloning it with a translucent mint
  material would show the player what they are actually placing. QUALITY §5 rule 5
  treats whitebox as a label, not a shipped state, and this is the surface the
  player looks at for the entire construction loop.
- **`src/build/ui.js:99`** reads `build.state` every frame, and
  `src/build/system.js:35` does `structuredClone(this.claims)` inside that getter.
  With the documented 8 claims × 64 pieces cap that is ~500 objects deep-cloned
  per frame for a HUD that is `hidden` when not building. Use `build.preview` and
  `build.pieceId` directly, or add a clone-free preview getter.
- **`src/build/system.js:186`** uses `0xffb56b` for the invalid ghost, while the
  documented warning token is `--warning:#e2bf87`. Minor, but it is a second amber.
- **Evidence gap, not a code defect:** `in-game/doorway-open.png` is captured
  *after* the fixture walks through the doorway, so it shows an interior wall, not
  an open door. My run reproduces the same framing. I captured
  [the doorway from outside](opus/doorway-open-outside.png) instead; it does show
  both leaves retracted and a clear aperture. Worth swapping in.

## Performance — measured, and what it does and does not establish

Fixed-viewpoint tour, my own run, seed 7291, 1600×900, render scale 1:

| View | Draw calls | Triangles | RAF median | §5 budget |
|---|---:|---:|---:|---|
| Orbit | 491 | 338,450 | 16.7 ms | **draws over 300** ✗ · tris ok |
| Coast, 95 m | 530 | 1,167,404 | 16.7 ms | ok |
| Forest, 95 m | 669 | 1,308,846 | 16.7 ms | ok |
| Highlands, 700 m | 326 | 658,838 | 16.7 ms | ok |
| Hangar opening | 614 | 932,546 | 16.7 ms | **draws over 600** ✗ · **tris over 900 k** ✗ |
| Cockpit, seated | 554 | 799,556 | 16.7 ms | ok |

These reproduce root's `tour.md` numbers to within four triangles, so the counts
are independently confirmed. **Orbit and hangar fail the §5 numeric budgets.**
Both are inherited from the integration base rather than introduced by this
branch, but per the review brief existing integration scene budget failures
cannot be waived, so they stay open.

One difference from root's run: I measured **16.7 ms RAF at all six viewpoints**,
including hangar and cockpit where `tour.md` records 33.3–33.4 ms. Root's higher
figures were most likely machine contention. Either way this is display-refresh
cadence, **not** GPU execution time, and **no 8 / 12 / 10 ms frame gate is
established by anything in this branch.**

Saved full-kit base scene (my run, `/tmp/star-agent-base-opus-scene/scene.json`):
**182 draws / 991,174 triangles at render scale 1, mean RAF 22.1 ms**, zero page
errors, console errors or console warnings. Root reported 179 / 989,254 at scale
0.85 — consistent. Selene surface is not a listed §5 row; the count is recorded
as an observation. My own extra captures at the base measured **33.3 ms median
RAF at render scale 1** at several Selene surface poses (418–457 draws,
1.15–1.25 M triangles) — again cadence, not GPU time. The authored kit itself is
small (47 draws / 20,690 triangles in the studio sheet); it is not the cost
driver, and that does not waive the whole-scene budget.

**Modal budget:** root's claim that the map captures carry stale counters is
correct — `src/main.js:339` returns before the counter reset when the map is
open, and `:347` skips the scene draw whenever any dialog is open. My dialog
captures independently report **0 draws / 0 triangles**, so §5's modal row is
satisfied by construction. It is not a measured modal cost.

**Coast viewpoint:** as flagged in the brief, the fixed coast camera does not
face the sea on this seed. [My capture](opus/tour-coast.png) is low-relief
yellow-green terrain with a flat horizon and no sea — it does not satisfy
QUALITY §1's "no flat plane views" requirement. This is pre-existing world
framing, not attributable to base-building.

**Hangar opening:** the `Build · B` shortcut is now correctly gated during the
opening — [my capture](opus/tour-hangar.png) no longer shows it, confirming the
fix root described. The floating mining-tool viewmodel ahead of the third-person
astronaut is still present; root verified it exists on baseline `6f80fc0`, so it
is inherited, not a construction regression.

## Things I checked and found sound

- Placement is one atomic `MiningStore` write: cost, piece, claim and backing
  container commit or roll back together (`src/build/system.js:140–150`).
- `validBuild` guards null/array claims and pieces before dereference and uses
  `Object.hasOwn` for the piece type, so `constructor` is rejected — the P1 that
  the earlier independent functional review found is genuinely fixed.
- Anchors: claims store a body-fixed frame and materialise in the current Pyre
  frame; unknown historical Pyre coordinates are retained and paused rather than
  guessed (`src/build/anchors.js:127–146`).
- Processed materials share the mineral mass budget through `MATERIAL_IDS`
  (`src/inventory/containers.js`, `src/mining/store.js`), so no free capacity
  appears; `craft()` checks ingredients *and* output capacity before one write.
- The doorway's pocket sweep stays inside ±1.54 m, well within the 4 m module, so
  an inline neighbouring wall at ±4 m does not collide with the reservation.
- `src/build/build.css` uses design tokens only — no new palette, no new
  font-family.

## Mergeable

**No.**

1. **Visual rubric 3.5 < 4.0** (QUALITY §2 and §3). No item below 3, so this is a
   polish gap rather than a rebuild, and findings 1–5 are the shortest route to
   4.0+.
2. **QUALITY §5 budget failures stand** at orbit (491 draws) and hangar
   (614 draws / 932,546 triangles), independently reproduced. Inherited, but per
   the brief not waivable here.
3. **Controller acceptance is incomplete by the branch's own record.**
   `controller.md` states "The full controller runner has not yet passed" for the
   full-kit route. AGENTS.md makes a complete controller journey mandatory for a
   new playable feature, and finding 1 shows the wall-flip binding in that journey
   is currently a no-op.
4. **No frame-time gate is established anywhere.** Every number in this branch and
   in my runs is a RAF interval, not isolated GPU time. The §2 "ms/frame within
   budget" checkbox is unmet, not passed.

Findings 1–5 are all actionable by root without design changes; four of them are
one-to-few-line fixes. I did not verify any fix, and re-scoring after fixes needs
a fresh review pass.

## Limitations of this review

- No physical controller or physical Xbox hardware was used or claimed.
- I reviewed still captures and source. The door-teleport and 600 m pop findings
  are code-verified, not motion-captured; I did not record video.
- I did not re-run the unit suite, the controller gameplay journey, the materials
  journey or the build-UI fixture. Their status is as recorded by their owners.
- `scripts/base-scene.config.js` hard-codes `outputDir:'/tmp/star-agent-base-scene/results'`
  while its screenshot directory is env-driven, so Playwright artefacts from my
  run share root's directory. My screenshots are cleanly separated under
  `/tmp/star-agent-base-opus-*` and `docs/qa/base-building/opus/`.
- I neither merged, committed, pushed, deployed nor edited product source, and I
  granted no polish-later waiver.

## Evidence

Mine, copied into the repo — [kit at 30 m](opus/kit-30m.png) ·
[open doorway from outside](opus/doorway-open-outside.png) ·
[mainframe display](opus/mainframe-display.png) ·
[placement ghost, desktop](opus/placement-foundation-desktop.png) ·
[placement HUD, phone](opus/placement-foundation-phone.png) ·
[invalid ghost and close material read](opus/placement-wall-near-base.png) ·
[recipes desktop](opus/recipes-desktop.png) · [recipes phone](opus/recipes-phone.png) ·
[pieces palette](opus/palette-desktop.png) · [saved kit exterior](opus/scene-base-exterior.png) ·
[tour hangar](opus/tour-hangar.png) · [tour coast](opus/tour-coast.png).

Raw, outside the repo — `/tmp/star-agent-base-opus-scene/` (saved-kit run,
`scene.json`), `/tmp/star-agent-base-opus-tour/` (fixed tour, `record.json`),
`/tmp/star-agent-base-opus-extra/` (my own captures, `record.json`),
`/tmp/star-agent-base-opus-build.txt`, `/tmp/star-agent-base-opus-scene-run.txt`,
`/tmp/star-agent-base-opus-tour-run.txt`, `/tmp/opus-review-scripts/extra-capture.mjs`,
`/tmp/opus-wall-turn2.mjs` (finding 1 reproduction).

READY FOR REVIEW: docs/qa/base-building/opus-review.md, docs/qa/base-building/opus/
