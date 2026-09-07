# Kestrel maintenance roll — independent Astra review

Reviewer: GPT-6 Astra, substituted for Opus by explicit user instruction. QUALITY.md numerical gate remains mean ≥4.0, no score <3. Review date 2026-09-07. Scope is the downloaded, cleaned Kestrel roll only; the jacket is absent.

**Final affected-asset visual disposition: YES, 4.00/5 (six scores of4), after the independently captured correction below.** This is not a whole-PR performance/interaction waiver. The original3.83 failure is preserved as history.

## Initial candidate and disposition — superseded by follow-up below

Candidate `4d2a71a7885dd16923cf7a9346dd141ba419b58a`, production preview port 5263, served `/assets/index-CcuSV6zK.js`, SHA-256 `ca9c874f18660c556cb318d9e196f76eff5f0c9de83673da6061111cacff3445`.

**Mergeable: no, pending bounded correction and fixture evidence. Mean 3.83/5.** The roll is recognisable, textured and correctly sized numerically, but the detached shadow makes it appear to hover above the counter from the player's side. The required human-scale page failed before rendering, so that acceptance evidence is still missing. This is a single-asset finding, not a reversal or waiver of previous shop/world reviews.

| Criterion | Score | Evidence |
|---|---:|---|
| Silhouette & scale | 4 | Readable compact strapped roll beside counter cards; measured 27.87 ×13.00 ×29.07 cm. Human fixture remains unverified. |
| Materials & detail | 4 | Fold layers, uneven textile edges, seams, dark straps and buckles survive cleanup. Close view has some soft sculpted detail but is substantially beyond a primitive or uniform blob. |
| Lighting & integration | 3 | Shop exposure and highlights fit. The broad detached dark shadow reads as hovering in the frontal walk-eye/approach views, despite correct mesh base height. |
| Cohesion | 4 | Ochre cloth and dark straps fit the Kestrel counter and service theme. No new UI palette or conspicuous unrelated accent. |
| Function | 4 | A compact decorative maintenance roll occupies the existing insert without blocking the terminal or care note; one insertion only. No pickup, unfolding or tool-use functionality is claimed. |
| Motion | 4 | Static geometry remains anchored and consistently shaped in five sequential camera offsets. This score covers the static prop only: sampled stills cannot establish continuous flicker, walking, interaction or animation timing. |

## Ranked findings

1. **Acceptance issue — apparent hovering:** `src/station-shop-props.js`, Kestrel caster/contact. In `roll-walk-eye`, `comparison-on` and `approach-1` through `approach-4`, the shadow lies visibly apart from the roll's underside. Runtime minimum Y is −6.908, matching the insert top (`blender/build_station_concourse.py`: centre −6.914, thickness .012). Do not lower the mesh blindly. Use a bounded asset-local contact treatment or caster adjustment and compare the same frontal and reverse views; preserve accepted global shop lighting. Existing shadow bias is a plausible cause, not a proved diagnosis.
2. **Acceptance evidence issue — props viewer cannot render:** port 5262 `/dev/props.html?only=kestrel-maintenance-roll&t=0&clean` reports `Failed to resolve module specifier "three"` and a 404, then times out waiting for `__propsReady`. Fix module resolution and capture the roll beside the 1.80 m silhouette. No human-scale screenshot was produced in this run.
3. **Fixture accuracy issue:** `public/dev/props.js` scales the grid by `top/12` (clamped), while its text says 1 m. For this short prop, the 1.80 m human sets `top`, yielding .15 m grid cells. Correct the label or spacing before treating grid squares as metres; the numerical mesh bounds above are reliable independently.
4. **Minor polish:** the broad front textile panel and buckle corners are softer than the reverse folds. Retain the accepted source silhouette; if revisiting detail, favour sharper strap-edge/buckle definition without increasing the asset budget. This does not independently block acceptance.
5. **Evidence limit:** sequential stills and camera fixtures are not a physical controller/touch walk-up test, continuous video or an uncontended performance run. Those broader claims must remain separate. Existing station/world findings are inherited and were not retested in this bounded intake review.

## Own captures and actual runtime audit

Executed `node scripts/station-shop-props-review.mjs` using host hardware Chromium after the known sandbox crash restriction. Browser Chromium 151.0.7922.173; ANGLE AMD Radeon 860M Graphics, radeonsi krackan1 ACO, OpenGL ES 3.2; WebGL2 with elapsed timer queries. Game screenshots are 1440×900, DPR1, render scale1, seed7291, hub photo mode. Camera coordinates and regeneration are in the review script.

Captured and personally read all eleven images under `/tmp/star-agent-kestrel-game-review`: `roll-close.png`, `roll-reverse.png`, `roll-walk-eye.png`, `whole-shop.png`, `approach-0.png` through `approach-4.png`, `comparison-on.png`, and `comparison-off.png`. The five approach images are discrete controlled camera offsets, not consecutive video frames. The props-page screenshot is absent because the viewer failed. Original failed audit evidence is preserved as `failed-audit-evidence.json`; that first run referenced a nonexistent station group, an error in this review script, corrected to traverse the actual hub/pod groups.

The successfully loaded game produced no console errors/warnings before navigating to the separate props viewer. The complete command fails because of that viewer; the combined evidence retains its two errors and timeout. Both attempts closed their browsers in `finally`.

Runtime audit: one placement group in the hub, zero in pods, one mesh, 4000 triangles, cast/receive shadow enabled. Bounds in hub coordinates are `[11.9006328666,-6.908,-.3953488916]` to `[12.1793671334,-6.7780000048,-.1046511084]`, consistent with base-centred origin and placement `[12.04,-6.908,-.25]`. One MeshStandardMaterial uses three unique 1024² textures: sRGB base colour, linear normal, shared linear roughness/metalness map. Scalar roughness and metalness are both1, multiplied by their packed map; these scalars alone do not imply metallic cloth.

The intake receipt records source4145 triangles/5,253,528 bytes and cleaned4000 triangles/268,872 bytes, cleaned SHA-256 `76d741972c05ddffe76d1c51f6607109cfd3dc265510b9f62876105e4d2357d7`. Runtime geometry/maps agree with the receipt. This is comfortably within the individual prop size/triangle/texture budgets.

## Same-view rendering cost and limits

At walk-eye `[10.9,-6.25,-.25]`, after settling, four alternating on/off pairs each requested60 measured frames after30 warm-up frames. Actual valid samples were61–62 per block; zero discarded queries. The visible mesh adds **3 draw submissions and12,000 submitted triangles** across main/shadow passes: on292/506,218 versus off289/494,218, stable in every block. This is one4000-triangle mesh, not three inserted copies.

| Pair | GPU on/off median ms | GPU on/off p95 ms | CPU on/off median ms |
|---|---|---|---|
| 1 | 8.794 /8.132 | 9.146 /8.499 | 11.05 /9.60 |
| 2 | 8.658 /8.556 | 9.138 /8.937 | 10.35 /9.65 |
| 3 | 9.475 /8.953 | 9.995 /10.996 | 9.55 /9.20 |
| 4 | 8.736 /9.135 | 9.322 /11.286 | 10.10 /9.55 |

CPU p95 ranges11.4–14.0 ms; RAF medians16.7 ms, p95 usually33.2–33.4 ms (one16.8). Outside-team browser jobs were reported active on this host, so these samples are **potentially contended**. The negative fourth GPU delta demonstrates why this is not a causal latency estimate or a frame-budget pass. Instrumentation measures WebGL work and JS callback time separately, excludes browser composition/input-to-display latency, and adds overhead. Raw samples, timing errors, diagnostics and bundle identity remain in `/tmp/star-agent-kestrel-game-review/evidence.json`.

Root separately reports186 unit tests and build passing; this reviewer did not rerun those. Physical/controller/touch checks remain root-owned. GPU lane released after this capture run.

## Final independent follow-up

Reviewed rebuilt working tree based on `4d2a71a7885dd16923cf7a9346dd141ba419b58a`, with the contact treatment and props-viewer fixes not yet committed at capture time. Exact served bundle `/assets/index-CoFnp-fX.js`, SHA-256 `363bf688666e94b55d7bf460e887732e57e4e45917c168c48b893312fb8b8081`. Runtime GLB and its three1024² maps are unchanged.

Executed `node scripts/station-shop-props-review.mjs /tmp/star-agent-kestrel-game-review-final --quick`. Command passed and browser closed. Personally read all twelve final images: the same eleven game filenames listed above, plus `props-human-scale.png`, in `/tmp/star-agent-kestrel-game-review-final`. Browser/backend/resolution/render scale match the first run. Game and dev viewer both recorded **zero console errors, zero warnings**. Raw final evidence is `evidence.json` in that directory.

The prior dark displaced shadow is gone in frontal, close, reverse and all five approach views. A subtle local feathered contact darkening replaces it; the correct base alignment remains unchanged. It is a reasonable approximation for this static counter prop. It is not a physically projected shadow and would need reconsideration if the roll became movable or the light arrangement changed. Final lighting/integration rises from3 to4. Materials, silhouette, placement, cohesion and static sample stability remain4. **Final rubric: silhouette/scale4, materials/detail4, lighting/integration4, cohesion4, function4, motion4; mean4.00, no item below3.** Motion retains the original sampled-stills limitation; no continuous-motion pass is invented.

The repaired viewer renders the roll beside its1.80 m human with actual1 m grid squares. The roll reads as a small portable bundle, roughly foot-length, consistent with the measured27.87 ×13 ×29.07 cm. Viewer stats independently report4000 triangles, minY0, no animations, one textured mesh; no failed assets. The mannequin is dark, but its silhouette and feet are visible enough to assess relative scale. This closes the missing-scale and misleading-grid findings; dev-viewer repair is not a claim that this source-import page works from a production preview.

Runtime now has one4000-triangle roll (casts no shadow, receives shadows) plus one2-triangle `ContactAO_Kestrel` plane, with a shared64² generated alpha texture, no cast/receive shadows. It sits .00075 m above the insert and stays within the roll footprint. One placement, zero pod placements, same bounds. This deliberately static contact treatment removes two4000-triangle shadow submissions.

Final controlled visibility pair gives **+2 draws/+4002 submitted triangles**: visible291/498,220, hidden289/494,218, stable over61 valid queries per block. GPU median/p95 on8.478/9.188 ms, off8.045/8.638; CPU median/p95 on9.10/11.20 ms, off8.50/10.10; RAF median/p95 approximately16.7 ms both. No discarded queries. Potential outside-load contention remains; one quick pair is not a causal cost estimate or whole-scene latency acceptance. Individual asset and exact submission budgets pass; CPU tails above10 ms remain explicitly recorded.

Final ranked disposition of the original findings: (1) detached shadow resolved by bounded static contact approximation, (2) viewer import failure resolved, (3) metre grid corrected, (4) soft close-detail remains minor optional polish, (5) continuous motion, physical controls, whole-world regressions and uncontended latency remain outside this asset-only visual approval. Root owns those remaining functional/PR checks. Browser/GPU lane released immediately after capture completion.
