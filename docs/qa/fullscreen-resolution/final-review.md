# Independent fullscreen-resolution review

**Decision: scoped functional and visual PASS for 7713a3c. No remaining blocker identified.** This approves the resolution policy, buffer resizing and observed rendering transitions. It does not certify whole-scene asset quality or performance.

Separate Codex reviewer under shared HANDOFF TOKEN POLICY v2, read-only review in `/tmp/star-agent-flight-options`, production preview 5290. No source edits, merge or deployment.

## Verified behavior

Both initial source findings are fixed:

- `RenderResolution.viewport` uses a cumulative `qualityArea` baseline, so many small resize events can reach the quality reset threshold. The independent original reproduction grew a 1000×700 window to 1600×700 in 10 px steps while scale remained 0.55; the final regression test now restores scale 1.
- `RenderResolution.frame` collects complete uninterrupted eligible gameplay intervals. Eligibility changes reset measurement, including the first resumed frame; menu/preload/hidden/map frames cannot be mixed into recovery samples. Main integration also resets measurements on hidden/map early returns.

Independent final policy suite: **7/7 passed**, including those two regressions, automatic recovery/floor behavior, fullscreen geometry detection and fixed percentages.

An independent Chromium run entered the **actual Fullscreen API through a trusted click**, inspected the real canvas dimensions after resize completed, then exited. It repeated this with 60% selected through the real Graphics dialog.

| State | Scale | Pixel-ratio cap in effect | Actual drawing buffer |
|---|---:|---:|---:|
| Windowed Automatic | 1.00 | 1.25 | 1800×1125 |
| Fullscreen Automatic | 1.00 | 2.00 | 2880×1800 |
| Windowed after exit | 1.00 | 1.25 | 1800×1125 |
| Windowed explicit 60% | 0.60 | 1.25 | 1080×675 |
| Fullscreen explicit 60% | 0.60 | 2.00 | 1728×1080 |
| Windowed explicit 60% after exit | 0.60 | 1.25 | 1080×675 |

Every actual canvas buffer matched the policy's reported dimensions. Explicit resolution preference and scale stayed at 0.6 across entry/exit; the fullscreen pixel density still increases as designed. Final captures show the planet, atmosphere and interface rendering at the expected proportions, without a new blank frame, persistent framebuffer artifact, stretched scene or UI layout defect.

**Zero browser errors/warnings.** Builder separately reports the full 478-test suite, build and its fullscreen browser case passing; these are not relabelled as independently rerun full-suite results.

## QUALITY rubric — applicable bounded criteria

| Criterion | Score | Scope of assessment |
|---|---:|---|
| Silhouette and scale | N/A | No authored asset shape or scale changed. Existing world assets are not rescored. |
| Materials and detail | N/A | No material/asset design changed. Buffer density is verified above; existing material quality is not certified. |
| Lighting and integration | 4 | Atmosphere and scene render correctly after framebuffer density changes; no new integration artifact observed. |
| Cohesion | 4 | Existing scene and interface retain their proportions and presentation through the transition. |
| Information design / function | 4 | Fullscreen receives higher buffer density; explicit user scale survives; exit restores window density. |
| Motion | 4 | Entry/exit and subsequent frames render cleanly; adaptive-state and interruption regressions pass. |

Applicable-criterion average **4.00/5**, no applicable criterion below 3. N/A criteria are excluded rather than receiving an invented asset-quality score. Inherited PR34/world/HUD quality and scene-budget limits remain unapproved.

## Evidence and limits

Exact screenshot paths:

- `/tmp/star-agent-fullscreen-independent/windowed-auto.png`
- `/tmp/star-agent-fullscreen-independent/fullscreen-auto.png`
- `/tmp/star-agent-fullscreen-independent/windowed-auto-restored.png`
- `/tmp/star-agent-fullscreen-independent/windowed-manual-60.png`
- `/tmp/star-agent-fullscreen-independent/fullscreen-manual-60.png`
- `/tmp/star-agent-fullscreen-independent/windowed-manual-60-restored.png`

Metadata: `/tmp/star-agent-fullscreen-independent/metadata.json`.
Capture script: `/tmp/star-agent-fullscreen-review-capture.mjs`.

Chromium **151.0.7922.173**, hardware **ANGLE (AMD, AMD Radeon 860M Graphics (radeonsi krackan1 ACO), OpenGL ES 3.2)**. Context DPR 2, CSS viewport 1440×900, emulated screen 1920×1080. Chromium's headless Fullscreen API kept this configured CSS viewport unchanged; the independently verified increase is in actual rendering-buffer density. The browser reports a real fullscreen element in those captures. The harness entry button removes itself before capture and is not a shipped control.

**Actual F11 hardware-key behavior was not exercised.** The F11-like content/outer-window/screen geometry detector is covered by unit tests; that is distinct from a real desktop F11 session. No new phone UI was added by this policy change, so this pass did not repeat the prior phone interface review.

Higher fullscreen density produces 2.56× as many drawing-buffer pixels at the same CSS viewport in this DPR 2 case. These brief transition checks make no sustained-FPS, GPU-budget or portable performance guarantee. The screenshots' incidental HUD FPS readings are not a benchmark. Fixed resolution remains available through Graphics.

GPU lane released after captures. No merge/deployment authorization implied by this bounded report.
