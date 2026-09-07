# Gear maneuvering and flight cues — independent final review

**Candidate:** `3398dce`, production preview on port 5290. **Verdict: bounded functional and visual PASS, 4.0/5.** Separate Codex reviewer session, following AGENTS.md, QUALITY.md and shared HANDOFF TOKEN POLICY v2. No source edits. Scope: gear speed/retraction state, prompt, ordinary space dust and the active-drive tunnel. This does not approve inherited ship assets, the full PR38 scene, or whole-scene performance.

## Functional review and corrected finding

The initial P2 finding was that surface landing assist deployed the gear but bypassed the declared 35 m/s ceiling and assigned up to 800 m/s. Reproduction: fresh Navigation at `(0,1592750+5000,0)`, `landOrLaunch()`, `beginFrame(1/60)`, `update(1/60)` returned speed 800, gear progress 0.0092592593, deployed true and profile limit 35. Builder capped the surface-autoland branch with `GEAR_FLIGHT.speed`. The same independent reproduction now returns **35 m/s**. Finding closed; original and corrected review retained in `/tmp/star-agent-gear-source-review.md`.

Independent targeted tests: **38/38 passed**, covering gear-flight, travel-navigation, ship-power-support, energy-effects, flight-model and travel-model. Log: `/tmp/star-agent-gear-independent-tests.log`. Canonical gear progress and render agreement, manual assisted/inertial limits, occupied-cabin path, pause/power lifecycle, tighter station caps and fully-stowed drive entry were reviewed. No remaining functional blocker identified.

## Independent browser evidence

Chromium **151.0.7922.173**, WebGL 2, **ANGLE / AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2**. Desktop **1600×900**, phone viewport **390×844**, DPR 1. Controls used supported orbital entry, keyboard and an injected standard Gamepad. Debug access was used only to read heading feedback; no ship positioning/state mutation. This is not a claim of physical-controller testing.

The browser asserted and captured deployed gear at **34.964 m/s**, retraction at **34.996 m/s** with gear progress **0.648**, and acceleration after stow at **2268.840 m/s**, with the prompt hidden. Ordinary spaceflight had **60 alive dust particles**, Slipstream intensity zero and no travel tunnel. Active drive had dust zero and a visible tunnel; after abort, the tunnel was invisible. These are state samples taken after each screenshot, so changing speed/HUD values need not be identical to the screenshot's preceding frame. No browser errors or warnings.

Prompt snapshots show 12 px text and an opaque panel. Desktop keyboard/controller widths are approximately 393/444 px. At 390 px viewport width, both wrap to a 358×66 px box at x=16: no clipping or horizontal overflow (`scrollWidth === clientWidth`). The prompt states the 35 m/s limit and actual binding, changes to a retraction status, and disappears after stow. It leaves the central aim point and bottom command legend visible. The important notice covers part of the lower cockpit MFD area temporarily; this is acceptable for the bounded departure cue.

## Bounded QUALITY rubric

| Criterion | Score | Evidence |
|---|---:|---|
| Silhouette & scale | 4 | Prompt reads as one compact notice at desktop and phone size; dust is small and the drive tunnel remains recognizably distinct. No new hull silhouette scored. |
| Materials & detail | 4 | Neutral sparse dust reads as motes/streaks, not an energy shell. Opaque prompt panel provides a clean surface for text. |
| Lighting & integration | 4 | Text remains readable over bright terrain and dark space. Ordinary cues remain restrained; the active-drive effect preserves its dark central opening. |
| Cohesion | 4 | Existing mint/text/dialog tokens and command language match the surrounding HUD. |
| Information design / function | 4 | Correct 35 m/s and contextual G or LB+RB+D-pad-down instructions; distinct retraction state; actual stow releases speed and clears the notice. |
| Motion | 4 | Gear clock remains continuous and shared with rendering. Dust replaces the ordinary tunnel; drive exit removes the tunnel. No popping or flicker specific to the new cues observed in the captured journey. |

**Average 4.0; no criterion below 3.** Mergeable for this bounded change, subject to the parent PR's other gates.

## Evidence paths and limits

Primary prompt/transition evidence in `/tmp/star-agent-gear-independent-evidence/`:

- `desktop-keyboard-gear-prompt.png`
- `desktop-controller-gear-prompt.png`
- `phone-keyboard-gear-prompt.png`
- `phone-controller-gear-prompt.png`
- `desktop-gear-maneuvering.png`
- `desktop-gear-retracting.png`
- `desktop-stowed-accelerating.png`
- `metadata.json`

Capture script: `/tmp/star-agent-gear-review-capture.mjs`; run log `/tmp/star-agent-gear-review-browser.log`. First effect captures are retained: the ordinary-flight image caught the end of preload fade, and the drive image caught a HUD phase update boundary. Their state checks passed; settled replacement images are recorded below.

Observed ordinary desktop frames have approximately **491–521 draw calls** and **338–390k triangles**. The draw-call count exceeds QUALITY's orbit target of 300; this existing whole-scene gate is not certified or waived here. No portable FPS improvement or laptop performance certification is claimed. No new mesh/ship art approval; the complete physical departure journey is builder evidence, separate from this independent orbital visual check.

Settled effect recapture completed on the identical runtime with zero errors/warnings. Primary effect evidence:

- `/tmp/star-agent-gear-independent-effects-settled/desktop-ordinary-space-dust.png` — normal SPACE FLIGHT, approximately 3 km/s, neutral dust streaks, no tunnel.
- `/tmp/star-agent-gear-independent-effects-settled/desktop-relativistic-drive-tunnel.png` — active drive, ACCELERATING HUD, visible colored tunnel, no ordinary dust.
- `/tmp/star-agent-gear-independent-effects-settled/desktop-drive-exit-no-tunnel.png` — returned SPACE FLIGHT HUD, no tunnel.
- `/tmp/star-agent-gear-independent-effects-settled/metadata.json` — actual browser/GPU details and state records; normal sample 2999.325 m/s, 152 dust particles, tunnel false; drive sample 54.990 Mm/s, dust zero, tunnel true; exit speed zero, tunnel false.

Settled capture script `/tmp/star-agent-gear-review-effects-settled.mjs`; log `/tmp/star-agent-gear-review-effects-settled.log`. All three images were visually inspected. The ordinary cue consists of sparse straight neutral streaks across an open view, visibly distinct from the densely structured colored drive tunnel. Final bounded score and approval remain **4.0/5, PASS**. GPU released after these captures.
