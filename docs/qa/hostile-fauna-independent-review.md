# Hostile fauna — independent asset review

Reviewer: GPT-6 Astra. Date: 2026-09-07. Scope: the final exported Pyrebear and Suloher dog and eight supplied Blender studio images. This reviewer did not author either asset, death action or runtime renderer. I did author the habitat queries and initial hostile simulation, so this record does **not** claim independent review of those modules. The separate root integration code review and its corrections are recorded below.

**Disposition: retain as development candidates; full visual acceptance is not established.** Pyrebear's final still pose is satisfactory. Suloher's final pose is grounded but retains an aggressive-crouch reading that weakens its death-state communication. Continuous final-export motion and actual game lighting/contact remain unverified for both. Missing applicable evidence is not an N/A exemption from QUALITY.md.

## Exact candidate and evidence

The worktree was based on `4d38827d3c41ecd6250455d6ceace4365c743365`; asset/runtime changes were not committed at inspection time. I independently calculated the on-disk runtime GLB hashes and matched the final manifests:

| Asset | SHA-256 | Runtime size | Triangles | Dimensions W × H × L |
| --- | --- | ---: | ---: | --- |
| Pyrebear | `30afc5a9459538fbab2954a38369f42df25ecfde032d7b819f60bf1e1f8639e6` | 1,044,532 bytes | 14,331 | 2.176 ×1.835 ×3.211 m |
| Suloher dog | `413335683e7f35484637622a4ae203613014f328f46dc7f32eda9071c5ef0f87` | 1,101,672 bytes | 14,806 | 1.060 ×1.094 ×1.882 m |

Both fit the declared individual character download/triangle budgets. Manifests report one material, one1024px WebP albedo, roughness.85, metalness0 and no emission; no normal/roughness texture maps are claimed. Those counts do not establish scene GPU/CPU performance or texture residency.

Read [QUALITY.md](../../QUALITY.md), the [brief](../briefs/hostile-fauna.md), [integration record](hostile-fauna.md) and [asset production record](pyrebear-asset.md). Personally inspected these eight actual image files:

| Pyrebear | Suloher dog |
| --- | --- |
| [walk-025](../../assets/creatures/pyrebear/review/walk-025.webp) | [walk-025](../../assets/creatures/suloher-dog/review/walk-025.webp) |
| [death-mid](../../assets/creatures/pyrebear/review/death-mid.webp) | [death-mid](../../assets/creatures/suloher-dog/review/death-mid.webp) |
| [death-final](../../assets/creatures/pyrebear/review/death-final.webp) | [death-final](../../assets/creatures/suloher-dog/review/death-final.webp) |
| [death-side](../../assets/creatures/pyrebear/review/death-side.webp) | [death-side](../../assets/creatures/suloher-dog/review/death-side.webp) |

These are author-captured renders of the reimported runtime GLBs, stamped **BLENDER STUDIO / NOT GAME EVIDENCE**, not screenshots captured by this reviewer. Recorded renderer: Blender5.2 / Cycles CPU, four threads,12 samples with denoising, AgX, neutral studio area lights, flat ground,800×600. I launched no browser or GPU job. Older `test-results/fauna-evidence/pyrebear*` captures and the root-reported controller pass belong to older assets; they cannot approve these final hashes' appearance or transition.

## Rubric, limited to what the images establish

QUALITY requires mean≥4.0 with no applicable criterion below3 for visual acceptance. Here four dimensions receive **provisional studio-only** scores. Lighting/integration and motion remain applicable but unverified; therefore there is no complete acceptance mean.

| Criterion | Pyrebear | Suloher | Evidence and limits |
| --- | ---: | ---: | --- |
| Silhouette and scale | 4 | 4 | Distinct broad, heavy bear versus smaller armored canine; limbs, heads and tails remain identifiable in walk/mid-fall. Measured dimensions are plausible. No human or game-distance comparison is present in these eight images. |
| Materials and detail | 4 | 4 | Bear skin folds, plates and dark claws separate; dog has readable sulphur plates, darker limbs and teeth. Some surfaces are soft and albedo-driven, but neither is a uniform primitive/blob. Studio appearance only. |
| Lighting and integration | Unverified | Unverified | Neutral images show contact and readable volume. They do not show Pyre/Miasma exposure, cast/contact shadows, actual terrain slopes, corpse intersection or runtime shader behavior. |
| Cohesion | 4 | 4 | Both share an organic armored-predator treatment while retaining different silhouettes and palettes. Dog's ochre/green plates suit the intended sulphur setting. Their actual planetary composition is still unseen. |
| Information or physical function | 4 | 3 | Bear's final lowered head and broad collapse communicate incapacitation. Dog's low stance, high curved tail, open jaw and planted foreclaws can still read as an active threat; see finding1. These are pose/function scores, not independent simulation or weapon-validation scores. |
| Motion | Unverified | Unverified | One walk phase, one mid-fall and two final views cannot establish timing, weight transfer, blending from arbitrary walk phases, gait speed, sliding, interpolation or final stillness over time. |

The four scored dimensions average **4.00 for Pyrebear and3.75 for Suloher**. These partial means are not replacements for the full six-criterion acceptance gate. The earlier reviewer's4/5 final-pose assessment is recorded in the author ledger; my dog readability finding is a narrower independent disagreement, not a claim that the export failed its numerical contact checks.

## Ranked findings

1. **Suloher corpse readability — needs a clearer passive final state.** In `death-final.webp`, the raised curved tail and wide-open mouth preserve the walking pose's threat language. In `death-side.webp`, the head remains forward and the forefeet appear braced. The belly is lowered and the legs splay, but the total image remains ambiguous between death and an attack crouch. A bounded correction would relax the tail toward the ground and let head/neck weight settle more passively, reducing the braced look without returning to the rejected overturned pose. Recheck the whole transition and ground tolerance after such a change. Alternatively, actual final-export motion may provide context that resolves the ambiguity; that evidence has not been supplied here.
2. **Final-export game and motion evidence is still required.** Capture both current hashes walking and dying through the actual renderer, including a lateral view, arbitrary walk-phase-to-death blend, continued corpse hold and canonical uneven terrain. Inspect consecutive motion evidence; a test pass or a mid-fall still cannot establish credible animation. The bear midpoint has a plausible lowering of its front body; the dog's midpoint preserves limb continuity, but neither proves the path between poses.
3. **Contact is an explicit tolerance, not perfect support.** Final author measurements report121-phase death minima of−25.646mm for bear and−12.599mm for dog, inside the author's30mm rejection limit. This includes skin contact, not only claw/armor tips. I have read those results but have not repeated the deformation sampling. The stills show substantially better support than the rejected floating/overturned description, but a flat plane does not establish slope or obstacle contact. No physically simulated ragdoll is claimed.
4. **Walk-only motion at chase speed remains a runtime visual risk.** Source review confirmed manifest gait-speed scaling and removal of the old rate cap. At requested travel speeds this implies approximately2.2× the bear's1.5m/s walk and4× the dog's1.0m/s walk. Foot-travel matching corrects one form of sliding; it does not prove a four-times-fast walk looks like a credible run. No attack/idle/run clips are supplied. Judge the actual result before awarding motion4.
5. **Scale and performance still need the affected game view.** The numerical footprints are plausible and assets are individually below budget, but these isolated studio frames have no human reference, aiming UI, habitat silhouette distance or full-scene cost. They are not evidence of physical-controller/touch support or uncontended FPS.

## Separate integration code review

I independently read the root-authored renderer/targeting/main/tool changes. The six findings were corrected and checked in source: radial directions for habitat starts; disposal of unique cloned skeleton textures; manifest gait-speed scaling without the2× cap; aimed-HUD obstruction checks; periodic high-altitude unloading; and disposal after failed manifest/missing-clip loads. `node --test tests/fauna-target.test.js` passed on recheck. Ammo authorization precedes the one-frame shot pulse; the actual muzzle query resolves nearer world obstructions before damage. A successful downing bite disables the later tool update in the same frame.

That source signoff is not a browser, visual or performance pass. Cosmetic HUD visibility could evaluate up to319 canonical terrain samples each frame at160m; I recommended a bounded target/visibility cadence while leaving weapon-hit and bite-impact validation fresh. Audio forwarding was seen reaching the gameplay event adapter; synthesis and audibility were outside that inspection. Subsequent edits must be verified against their own final build.

No runtime/assets were modified for this review. Only this review record was written. Final game art/motion acceptance remains open.
