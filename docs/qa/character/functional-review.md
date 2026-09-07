# Independent Claude Opus functional review — 2026-09-07

Initial review, before fixes listed in production-record.md. Reviewer ran independently through Claude CLI; no source edits or competing browser.

I ran the checks myself, read the changed source and the real binary rig, and inspected the existing evidence captures. I did not start a browser or modify any file.

## What I independently verified

- `npm test` — **501 tests across the 67 listed files, 0 failures** (exit 0). The record's rerun claim holds.
- `npm run build` — passes; only the pre-existing large Three/GLTFLoader chunk warning.
- `public/models/props/player-expedition.glb` = 8,045,096 bytes, sha256 `6296f5ae…d52e`; matches `manifest.json` and `build.json`. All three retained Meshy sources hash-match `build.json`. `rifle-laser.glb` matches its new manifest hash.
- Real rig: 24 joints, one `SkinnedMesh`, canonical `Hips→Spine→Spine1→Spine2`, `Armature` scale 0.01 (socket compensation applies), morphs exactly `GripRight`/`GripLeft`, 26 clips == `CLIPS`.
- Direct execution against the real GLB confirmed: aim settles to `{idle-lower:1, aim:1}`; left palm ↔ foregrip gap **0.00000 m**; a wave is accepted, holds the body, returns to `aim-rifle`, and **the grip and barrel are fully restored afterwards** (`muzzle·aim = 1.000000`). The IK-restore ordering in `main.js` (character.update → placeCameraRelative → miningTool.update/aimHeld → render) is correct, and I could find no path where `aimHeld` runs on a frame `character.update` is skipped, so the corrections do not compound.
- Semi-auto latch is correct: a trigger held for 200 frames produces **exactly one** `fire-rifle` entry, and the recoil one-shot always plays out (19 frames for the 0.3 s clip).
- Third-person mining reach is genuinely physical: `tool.js:53-57` clamps `hit` by `distanceTo(nav.position) ≤ 8` and `inspectTarget(…, nav.position)` reports from the eye; `space-mining.test.js` covers it. Muzzle-obstruction re-check survives (`tool.js:70`). Heat/ammo/inventory are one `Equipment` instance across both cameras; `bindCharacter` re-parents without losing `_heat` or the loadout.

---

## Findings

**1. [Medium-High · proven] In third person the reticle is drawn on top of the player, so you cannot see what you are aiming at.**
`src/mining/tool.js:51-52` now makes the camera centre ray authoritative in third person (`direction` from `camera.quaternion`, `aimOrigin` = `origin`). But gameplay uses `ShipCamera`, whose walking offset is only `(0.6 right, 0.35 up, 3.7 back)` (`src/ship-camera.js:88`) aimed at `(0,-0.8,-2)` (`:100`), while `#reticle` is hard-pinned to screen centre (`index.html:35`, `style.css`). The player's own torso therefore sits over the crosshair.
*Evidence:* `/tmp/star-agent-controller-held-rifle.png`, cropped 400×300 at (520,300) — the reticle circle lands squarely on the suit's right shoulder; the muzzle flash is behind the character's arm.
*Fix:* use the over-the-shoulder rig that already exists for exactly this (`CharacterCamera.offset = {right:0.45, up:1.7, back:3.2}` with the look-target laterally offset by `offset.right`, `src/character.js:851,1006-1009`), or raise/side-shift `ship-camera.js:88`'s walking offset and its look target so the body clears screen centre.

**2. [Medium · missing validation, not a proven bug] Third-person camera in EVA is new behaviour with no browser or controller coverage.**
`ship-camera.js:73,79,81`, `main.js:237,278,371-380,384` newly extend `walk` handling to `eva`: the toggle, the menu item's `enabled`, `character.setVisible`, `setWorldPose(feet, nav.orientation)` with `speed:0, grounded:true`, and `aimHeld` IK all now run while floating. The only coverage is the new CPU unit test in `scripts/ship-camera.test.js`. AGENTS.md §"Controller acceptance is mandatory" requires an actual controller-only journey for a new playable route; the journey in `scripts/opening.spec.js` never enters EVA.
*Fix:* add an EVA leg (enter EVA → chord 15 → assert `mining.tool.attachment==='character-hand'`, `character.visible`, zero errors → chord back), or restrict `playerExternal` to `walk` until that journey exists.

**3. [Medium · proven by execution] `take-damage` locks the whole body for 1.67 s, cannot be cancelled by movement, and re-triggers indefinitely.**
`src/character.js:626` deliberately bypasses the speed test for `'hit'` (`this._gestureActive === 'hit' || speed <= SPEED.idle`), and `:616` restarts the gesture on every health decrease. I measured **100 frames (1.67 s) stuck in `{take-damage: 1}` while `speed: 4` m/s**, and with a damage tick every 0.5 s the character never leaves it — legs frozen while the player runs, and `aimHeld` suppressed throughout (`equipment.js:834`). `wave` is correctly cancellable; `hit` is not.
*Fix:* let locomotion cancel `hit` the same way it cancels `wave`, or build `take-damage` as an upper-body overlay like the aim/fire layer, and rate-limit re-entry.

**4. [Medium · doc accuracy] "health-driven hit/limp" is not reachable in the shipped game.**
`Loadout.injure()` (`src/inventory/loadout.js:88`) has **no production caller** — only `tests/loadout.test.js`. Health only ever rises (medical items), so `hit`, `wounded` and `dead` never occur in play; the input is wired and unit-tested, but the behaviour is not gameplay-reachable. `docs/qa/character/production-record.md:30` states it as delivered gameplay, which AGENTS.md forbids.
*Fix:* qualify it the same way ladders/seats/reload already are: "injury input wired and unit-tested; no gameplay damage source exists yet."

**5. [Medium · proven latent] `_lastHealth` is seeded to 1, so a saved sub-100 health plays a phantom `take-damage` on the first on-foot frame.**
`character.js:339` sets `_lastHealth = 1`; `OpeningSequence.syncCharacter` (`opening-sequence.js:93`) passes no `health`, so it is still 1 when `main.js:380` first supplies `loadout.state.health/100`. `health` is persisted through the MiningStore/localStorage. Currently masked only by finding 4 — it becomes a real bug the moment injury is wired.
*Fix:* `this._lastHealth = null` in the constructor, and in `update()`: `if (this._lastHealth === null) this._lastHealth = health;` before the comparison.

**6. [Medium · process] Review evidence is not in the repo and the HANDOFF line is missing.**
QUALITY.md §2 requires the §4 tour in `docs/qa/pr-N/` (or attached to the PR) plus before/after at 1440×900 **and** 390×844, §6.3 requires a props-page render, and the reference hangar/Atlas records commit their PNGs (`docs/qa/atlas-mark-ii/*.png`). `docs/qa/character/` contains only two `.md` files; every capture lives in `/tmp`. There is no `READY FOR REVIEW:` entry in `HANDOFF.md` for this change, and `docs/qa/character-fidelity/` is an empty stray directory.

**7. [Low-Medium] The 20k character budget was superseded in prose but not in the two places that enforce it.**
`public/dev/props.js:217` hard-codes `e.category === 'character' ? 20000 : 10000`, so the props contact sheet — the §6.3 intake render — will label `player-expedition` **OVER TRIS**. `QUALITY.md:66` still reads "characters ≤ 20 k / ≤ 2 MB, textures ≤ 1024²" with no recorded exception.
*Fix:* record Cees's exception in QUALITY.md §5 and read the per-entry budget from the manifest (or allow a documented per-asset override) in `props.js`.

**8. [Low] Barrel and bolt diverge at range in third person.**
`tool.js:64` aims the weapon at a hard-coded `aimOrigin + direction*100` for guns, while `:77-79` fires the bolt at the real `weaponTarget` result out to 1200 m. With the muzzle ~0.5 m off the camera axis the two directions differ by ~0.26°, so the tracer visibly leaves off-axis from the barrel at distance.
*Fix:* reuse the same `weaponTarget(...)`/range endpoint for `handAim` instead of the 100 m constant.

**9. [Low] The missing-clip diagnostic is gated on a positional index.**
`character.js:502`: `this.missingClips.some(name => CLIPS.indexOf(name) < 14)`. This is what keeps `player-male` quiet in the studio, but it also means a rig silently losing `aim-pistol`, `use-tool` or `wave` produces no warning — and `scripts/character.spec.js:51`'s `expect(warnings).toEqual([])` would still pass. Any future reordering of `CLIPS` silently changes which clips warn.
*Fix:* key it off a named `REQUIRED_CLIPS` set rather than `indexOf(...) < 14`.

**10. [Low] The stated equipment↔character contract is broken.**
`equipment.js:8` says it "reads character.js through its public surface… and never edits it", but `equipment.js:834`, `mining/tool.js:60` and `avatar-studio.js:96,99` all read the private `character._gestureActive`.
*Fix:* add a `get gestureActive()` (or `get busy()`) to `Character` and use it in all three places.

**11. [Low] Self-hosted fonts ship as ~690 KB of unsubsetted TTF.**
`public/fonts/*.ttf` (10 faces) replaces the Google Fonts WOFF2 the CSS previously pulled. The stated motive was startup stall, but TTF is roughly 2× the wire size of WOFF2 even gzipped, and there is no `unicode-range` subsetting. Licence retention and `sources.json` provenance are correct.
*Fix:* convert to WOFF2 (and optionally latin-subset) before merge; `src/fonts.css` needs only the `format('woff2')` change.

**12. [Low · pre-existing, but the evidence cannot rule it out] The mining HUD and the floating first-person weapon are live during the 10 s opening cinematic.**
`nav.enabled` is true throughout the cinematic (it is what lets `opening.update` advance), so `tool.js:44` sets `active = true`, `:45` shows `#mining-panel`, and `:49` sets `mount.visible = true` — a cutter floats at the character's chest and the survey panel sits top-right. This is unchanged from HEAD, but no opening screenshot can show it, because `scripts/opening.spec.js:32-37`'s `shot()` sets `navigation.enabled = false` before every capture — exactly the flag that suppresses it. Worth one live look during the pending rerun; the fix (gate `active` on `!nav.openingActive`) is one condition.

**13. [Info]** `Character._set` (`character.js:716-719`) has two branches that assign the same thing; the second is unreachable. And ~49 MB of retained Meshy source GLBs enter git — correct per `docs/asset-production-standard.md:153` (sources outside `public/`), but worth a deliberate decision on repo weight.

---

## Readiness verdict

**Functionally ready for the visual (Opus) review; not ready to merge.**

The engineering underneath is genuinely sound and the evidence I could re-derive all checked out — hashes, clip contract, skeleton canonicalisation, glove morph locality, the `setRenderOrigin` fix, the layered aim/fire model, one-shot and latch semantics, gesture interruption with full IK restoration, and shared inventory/heat/ammo across cameras. The new real-GLB tests are substantive, not decorative, and the whole suite and build are green under my own run. Nothing here is a crash or a data-loss risk.

Before merge I would want, in order: **finding 1** (third-person aiming is the headline new affordance and the crosshair is currently unusable), **finding 2** (either EVA journey coverage or gate EVA out), **finding 5** (one-line correctness fix), **finding 4** (record wording), and **findings 6 and 7** (QUALITY.md checklist: evidence in `docs/qa/character/`, the HANDOFF line, and the budget exception recorded where it is actually enforced). Findings 3 and 8–13 are safe to schedule.

Findings 2, 6 and 7 are missing validation or process gaps. Findings 1, 3, 5, 8, 9, 10 and 12 are defects I reproduced from source or from committed evidence.
