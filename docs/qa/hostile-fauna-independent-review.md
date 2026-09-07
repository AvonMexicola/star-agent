# Hostile fauna — independent asset review

**Latest runtime follow-up:** settled-terrain capture with the actual player flashlight resolves the earlier severe Pyrebear corpse burial in the inspected frame. Earlier failed/dark receipts remain below; continuous motion and broader lighting acceptance are not implied.

**Earlier scoped update:** the published dog pose revision below resolves the earlier corpse-readability finding to **4/5**. Full game and motion acceptance remains open. The original review and its 3/5 score are retained as historical evidence.

## Original export review (superseded dog pose)

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


## Published dog pose follow-up — 2026-09-07

Reviewer: GPT-6 Astra, independent of asset authoring. I independently hashed the published `public/models/creatures/suloher-dog.glb`: **`58e0ea69a08c5f49adc76fa546dae794ab7b797c44c223591d4b2a3dbf0f3928`**. Pyrebear remains unchanged at the hash above. This review is tied to the export hash; it does not assert a final integration commit identity.

I first inspected the isolated candidate's side and oblique PNGs, comparing them with the old dog death-side and death-final WebPs. After publication I independently reopened all three following current WebPs. The published final poses visibly match that candidate correction. The original table's dog image paths now resolve to these newer images; its original observations and scores refer to the old `41333568…` export, not the replacement.

| Personally inspected published image | SHA-256 |
| --- | --- |
| [death-mid](../../assets/creatures/suloher-dog/review/death-mid.webp) | `1fa68c7c6fe56863bb586df8f99bea4da4506207ea72f080b4a28f232da3f2b4` |
| [death-final](../../assets/creatures/suloher-dog/review/death-final.webp) | `5bed785eea2b10889fbea1db12af8aa871f148a126fce07d07fe65bc61814937` |
| [death-side](../../assets/creatures/suloher-dog/review/death-side.webp) | `0eae33dde3a5950f514f5737861968a5ea31636d9eb341bea5715fe9ce2029fd` |

**Scoped information/physical-function pose score: 4/5, improved from 3/5.** The head and jaw now drop sideways toward the ground; asymmetric forepaws and broad belly support communicate collapse, particularly in the oblique final view. The side-view tail no longer stands vertically. A bent foreleg and raised curved tail still retain some tension, but these two final views no longer present a blocking death-state ambiguity. The midpoint preserves recognizable anatomy; it cannot prove the transition's timing or weight.

These are author-captured Blender 5.2 Cycles CPU studio renders, 800×600, 12 samples and four threads, not my own captures or game evidence. I used no browser/GPU. The current manifest reports a 121-sample death minimum of **−25.372mm**, within the authored 30mm tolerance, and the motion validation ledger reports continuity and limb-length checks. I read those results but did not independently rerun deformation sampling. This is neither perfect ground contact nor a ragdoll claim.

**Disposition:** accept this bounded final-pose correction. The old corpse-readability finding is resolved for these stills. No complete six-criterion mean is awarded: actual planetary lighting, terrain contact, gait at chase speed, arbitrary-phase death blending and continuous final-export motion remain applicable and unverified. The earlier partial studio scores cannot substitute for that full acceptance gate. No assets or runtime files were changed by this follow-up.


## Actual-terrain corpse follow-up — rejected Pyrebear capture

I personally inspected both species' `motion-start`, `motion-1` and `motion-3.2` PNGs in `test-results/fauna-evidence`, and read their `*-art.json` state receipts. These are root-captured actual-game frames, not my captures. Final GLB hashes independently rechecked: bear `30afc5a9459538fbab2954a38369f42df25ecfde032d7b819f60bf1e1f8639e6`; dog `58e0ea69a08c5f49adc76fa546dae794ab7b797c44c223591d4b2a3dbf0f3928`. The inspected final PNG hashes are bear `ba214d85eb3216a74db11325242426378c10aded8c69be929adcc3f79e70a02d` and dog `58ba840f5d41b3b15c72c28a4807a1d1b8503556e23c661acacf9648ca4c55b6`.

**Blocking finding: the bear corpse is visibly buried through much of its body in the captured Pyre surface.** Its back/plates and parts of the limbs protrude while the terrain hides its low head and underside. Actual lighting/integration for this captured result scores **2/5**, below the acceptance floor. The previous 4/5 studio pose score is retained historically and cannot approve this game result. Dog's settled corpse remains visibly identifiable, with its lowered head and splayed limbs readable against Miasma; scoped corpse integration is **4/5** in this view. Neither sequence of sparse frames earns a complete continuous-motion score.

I wrote and ran an isolated Node CPU diagnostic, `test-results/fauna-ground-diagnostic.mjs` (results: `fauna-ground-diagnostic.jsonl`). It parses the exact runtime GLBs with Three.js GLTFLoader, replaces materials only to avoid browser image decoding, evaluates the final death animation, updates skeleton matrices and transforms every skinned vertex with the runtime `faunaOrientation` and recorded entity world position. Canonical clearance is radial world distance minus body radius minus `pyreSurfaceBody(toPyreBody(direction))` or `miasmaSurface(direction)`. Positions remain JavaScript doubles. This is an independent replay of final-pose grounding, not a claim that I independently authored or reviewed my own habitat implementation.

| CPU result | Pyrebear | Suloher |
| --- | ---: | ---: |
| Evaluated skinned vertices | 9,853 | 10,947 |
| Final local minimum Y | −25.638mm | −25.373mm |
| Recorded origin clearance above canonical terrain | −0.00068mm | −0.00136mm |
| Worst skinned-vertex canonical clearance | −19.725mm | −25.395mm |
| Vertices below canonical terrain | 6 | 97 |
| Vertices more than 30mm below canonical terrain | 0 | 0 |
| Median canonical clearance | 310.402mm | 173.801mm |

**The replay rules out substantial final-pose burial against the canonical terrain at these recorded anchors.** It does not justify lifting the asset or inventing another floor. The source pose's small measured contact intersections agree with the earlier authored tolerance; they cannot explain the broad visible occlusion.

A concrete distinguishing state is terrain convergence: Pyre's receipt reports `ready=false`, LOD13, 63 pending patches and 28 morphing patches. Miasma reports `ready=true`, LOD17, zero pending and zero morphing. A mismatch between the rendered coarse/morphing Pyre surface and canonical terrain is therefore the leading explanation. This remains an inference: the recorded data do not contain the exact drawn triangle beneath each vertex, and I did not independently capture or raycast that rendered surface.

**Required bounded follow-up:** preserve this failed art receipt, let terrain settle at the staged camera/target before killing and capturing, then repeat the actual-terrain view. If visible burial persists after convergence, compare the rendered triangle surface with canonical terrain directly. Do not add an arbitrary model offset to conceal the failed render. A passing scripted kill test is functional evidence, not art acceptance. This reviewer ran no browser, GPU or Blender job and changed no runtime/asset/helper files for this diagnosis.


## Independent settled-terrain and flashlight resolution

I operated the final two bounded bear recaptures against the restored exact older5516 preview, without changing terrain, asset or placement code. The first settled capture passed its functional script in1.3minutes, with LOD17/ready=true/zero pending/zero morphing, but was too dark to judge ground contact confidently. That dark receipt remains in `test-results/fauna-evidence/settled2-c8162`. An earlier unavailable-preview attempt failed before application load and is separately retained; it was not an art failure.

The final capture passed in1.4minutes using the actual **L-key player flashlight**. The fixture asserts `navigation.flashlightOn===true`; its JSON records flashlightOn=true and errors[]. Pre-action and final Pyre receipts both show ready=true,LOD17,pending0,morphing0. Browser Chromium151.0.7922.173; AMD Radeon860M / ANGLE OpenGL ES3.2; final1280×800 viewport/drawing buffer at renderScale1. UI checks additionally capture1440×900 and390×844; these are different viewport captures, not a1440×900 performance baseline.

I personally inspected `test-results/fauna-evidence/settled-flashlight/pyrebear-motion-3.2.png`, SHA256 **`908e4e9739f6fa759f5df0c2b34b33c533d216bddd2d82763e1af2412713db06`**. The lowered head, forelimbs and claws are now visibly above the settled terrain; the previous broad clipping through the head/body is absent. **Scoped corpse integration/contact in this flashlight-lit frame:4/5**, resolving the earlier severe-burial finding for this bounded result. No arbitrary ground offset or asset deformation was needed. This agrees with the earlier CPU result that the exact final corpse was already within small authored contact tolerance against canonical terrain.

The earlier coarse/morphing screenshot remains a real failed visual receipt; it is not retrospectively relabeled a pass. The new evidence supports waiting for terrain convergence in this art fixture, not a claim that moving/streaming terrain can never occlude animals. The surrounding night terrain remains very dark and the weapon is brightly lit; broader exposure/lighting behavior is not approved by this contact score. No continuous-video judgment, perfect terrain adaptation, ragdoll physics or six-criterion whole-feature mean is claimed. See [browser verification ledger](aeon-fauna-browser.md) for exact trials, identities and GPU release.
