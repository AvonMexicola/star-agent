# Independent follow-up:9aefa1e

Claude Opus, read-only code/author-supplied images,656.711s. No own browser or
continuous-motion capture. All three prior findings closed; new eave support
finding corrected in the subsequent collision commit. Applicable visual score3.6
is below final acceptance. Complete unmodified result follows.

## Scope

Read-only. Inspected `git diff fc6b281..HEAD` (4 files, +29/−6), `tests/build-roofs-lights.test.js`, and the surrounding modules it touches (`collision.js`, `visuals.js`, `mounts.js`, `state.js`, `structure.js`, `polygons.js`, `radial.js`). Ran targeted `node --test` on 16 build/power test files and a few read-only `node -e` probes against `src/build/*`. No browser, no broad suite, no edits.

## Closure of the three functional findings

**#1 roof `support:true` — CLOSED, verified by execution.** `definitions.js:22`. Probed the reachable case (roof-edge on a ceiling at 3.3, adjacent unroofed ceiling at z=4): the player walks off the adjacent deck, climbs the rounded shoulder (3.30 → 3.906) and stays `grounded` the whole way, with a single stalled frame at the transition. Landing from above catches at 3.906 for all three shapes. The `blocked()`-only freeze is gone. `sampleLocalSupport`/`supportAt` use the true transformed polygon (`polygons.js:7`), so the triangle/quarter caps do not gain phantom corners; `support` is not consumed by `validBuild`, `supportedPieces` or `mounts`, so nothing else changed meaning.

**#2 mounted rotation relative to the ceiling — CLOSED, verified by execution.** `system.js:80`. `p.rotation + this.turn*π/2` for non-inheriting shapes: `mountReason` returns `null` for `roof-flat`/`roof-edge`/`roof-corner` at all four turns on a 60° ceiling, and `π/2` is a multiple of `π/6`, so `state.js:24`'s rotation validation still accepts the result (rotation is required-finite there, so no `NaN` path from a legacy save).

**#3 live material power feedback — CLOSED.** `system.js:278–284`. One `powered` per claim per frame now drives both `setBuildPowered` and the point-light fixture list, so emissive and illumination change in the same frame with no store write; the test asserts `build.data` identity is unchanged across the transition. Side benefit: `power.status(c)` went from once per *piece* to once per claim. The material path is per-instance (`setBuildOpacity` clones per root), and `entry.group` stays `null` until the GLB resolves, so there is no shared-material or stale-`userData.powered` cache hazard. The real asset does carry the switched material (`manifest.json` `ceiling-light` → `WarmTaskLight`, 756 tri / 68 KB).

**#4 duplicate snaps + height hint — CLOSED.** Mount candidates now pass through `sort()`'s dedupe, so a same-height ceiling grid yields one lamp candidate instead of nine; `↑ ↓ · Height` and the two touch Height keys are hidden for mounted pieces (`ui.js:152,154`, precedence correct). Residual nit: `LB / T · Next snap` is still advertised for a lamp whose candidate list is now legitimately length 1.

## New code findings

**Medium — the walk on a rounded cap floats above the skin and extends past the eave.** `src/build/collision.js:48`, surfaced by `definitions.js:22`. `supportAt` takes the max box top within the whole 0.28 m capsule disk, and the profile cells are 0.02–0.16 m wide, so the feet track the highest nearby step rather than the surface underfoot. Probe, roof-edge at 3.306, walking +z:

```
z 1.60 feet 3.906 skin 3.872 float 0.034
z 1.80 feet 3.906 skin 3.753 float 0.153
z 1.90 feet 3.886 skin 3.638 float 0.248
z 2.00 feet 3.826 skin 3.306 float 0.520   ← tile edge
z 2.10 feet 3.826 (off tile)               ← standing in mid-air 0.1 m past the eave
```

The player visibly hovers up to ~0.5 m over the curved skin at the shoulder and can stand ~0.2 m beyond the tile before falling. The mechanism is pre-existing (stairs and ramps float too, bounded by their 0.25 m step); the 4 m curved top is the first geometry where the deviation is half a metre. Not a blocker for #1's closure, but it undercuts the "conservative walking steps" rationale the docs and tests give for the stepped colliders.

**Low — the new walk test cannot observe that.** `tests/build-roofs-lights.test.js:45`. The 18-step leg runs z ≈ 0 → 1.8, which is inside the plateau the max-over-disk rule creates, asserts only lateral advance (`point[2] > pos[2]+.09`), never compares feet to `roofProfile`, and never walks uphill. The landing assert `|y − 5.556| < .001` (line 44) is the flat-top height and is identical for all three shapes, so it does not discriminate the rounded profile either. Test 7 also builds a synthetic `Group`/`buildFinish` rather than the real clone path, so the material-name linkage rests on the manifest, not on this test.

**Low — the height-hint edit is a brittle serialize/parse round-trip.** `src/build/ui.js:152` re-reads `.build-hints` `innerHTML` and string-replaces the literal `' &nbsp; ↑ ↓ · Height'`. It works only because the HTML serializer re-emits U+00A0 as `&nbsp;` and because the spacing in line 151 matches exactly; a whitespace tweak in the hint silently leaves the Height row visible for mounted pieces. Nothing in `tests/` references `build-hints`, so only the queued browser controller pass would catch it. Composing the string conditionally in one place would be both shorter and safe.

## Tests

`node --test` on `build-roofs-lights` (**7/7**), plus `build-geometry`, `build-state`, `build-removal`, `base-power`, `build-shapes`, `build-motion`, `build-navigation`, `build-finish`, `build-input`, `controller-hints` (**80/80**) and `build-radial`, `base-cloud`, `base-power-database`, `build-sandbox`, `build-anchors` (**23/23**). 110 pass, 0 fail. No browser and no full suite run in this pass.

## Visual assessment (QUALITY.md §3)

Evidence: author-captured Three studio renders (`roofkit`, `roof-corner`, `roof-quarter`, `roof-triangle`, `ceiling-light`), actual controller sandbox pair (`ceiling-light-on/off`, same pose, 1440×900), and one 390×844 UI capture (`roofs-phone`). No self-capture, no FPS or continuous-motion claim.

| Criterion | Score | Observed |
| --- | --- | --- |
| Silhouette and scale | **4** | 1.80 m figure in every studio frame; storey and 4 m module read correctly, and the barrel of two edge caps over the two-module shell reads at distance. Deductions: the quarter cap's outer arc is visibly faceted (chord segments along the curved edge), and the 0.6 m caps read as heavy plinths when viewed alone. |
| Materials and detail | **3** | Pronounced horizontal light/dark striping from the concrete albedo/bump tiling on every piece — strongest on the `roofkit` wall panels and worst in `ceiling-light`, where the raking warm light makes the ceiling read as planking rather than concrete. Caps have no bevel, drip edge, panel joint, wear or accent, unlike the floor deck below them which carries scored joints and mint corner markers; a dark hairline crease sits where the flat top meets the curve (`roof-corner`, `roofkit`), and the two caps in `roofkit` meet in a seam with a small tonal mismatch. The lamp is the best-finished piece (dark polymer frame, brushed inner rim, warm diffuser). |
| Lighting and integration | **3** | Contact shadows and a plausible key in the studio set; in game the lamp pools warm light on the ceiling with believable falloff. Deductions: the diffuser core clips to flat white in both the studio and the in-game "on" frame, taking the surrounding ceiling with it, and the held tool is blown with a white rim; the "off" frame is near-black, with the room legible only through HUD — against §1 "night scenes must remain intentionally legible". `ceiling-light.png` also shows a thin aliased sliver where the diffuser meets the housing on the near edges. |
| Cohesion | **4** | Reads as one concrete system; the lamp uses the matte-polymer/brushed-metal/warm-emissive language; the wheel uses mint tokens, the standard eyebrow/type hierarchy and dialog chrome. Deductions: the wheel segment reads "Curved roof tile" while the same piece's label — shown in the wheel centre and the placement HUD — is "Quarter-circle roof tile" (`radial.js:40` shortening), and "Floor / roof" vs "Floor / flat roof"; the caps carry none of the mint marking language the deck has. |
| Information / physical function | **4** | Wheel communicates cost, supply source, tab set and controller mapping truthfully; the interact prompt names the exact action and the notify confirms the new state; studio captions carry draws/triangles/module scale. Deductions: `Rounded roof edge` and `Rounded roof corner` icons are near-indistinguishable at 390 px, "Ceiling light · 50 W" wraps to a lone "W", "Triangle floor / roof" wraps to three lines crowding the ring, and segment labels are small low-contrast gray on dark; plus the walking-clearance defect above (code-derived, not visible in any provided capture). |
| Motion | **N/A** | No moving parts in this increment and no motion evidence provided; the only time-varying behaviour (emissive/point-light coherence on a power flip) is covered by a unit test, not by capture. |

**Average of applicable criteria: 3.6** (5 scored). Nothing below 3, but this is under the §2 threshold of ≥4.0, so on this evidence the increment does not clear the visual bar without further work or Cees's explicit scoped exception. Budgets are comfortable: `ceiling-light` 756 tri / 68 KB, `roof-flat` 156 tri, `roof-corner` 1,874 tri, all far inside the ≤10 k / 1 MB prop target (the captions' draw/triangle numbers are studio-scene totals, not per-piece).

## Pending — not established by this pass

- Final controller recheck is **queued, not run**; I ran no browser.
- Roof caps have **no game-rendered evidence in my set**: `rounded-roof-built.png`, `roofs-desktop.png`, `roof-flat.png` and `roof-edge.png` are in the folder but were outside the requested list, so §1's "game-rendered review" for the roof geometry is not asserted here — my roof scores rest on studio renders. Only the lamp has game-capture evidence in this pass.
- The medium finding above is from a code probe, not from a capture; it has not been observed in the running game.