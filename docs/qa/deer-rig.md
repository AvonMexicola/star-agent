# Deer rig and walk repair — 7 September 2026

This is a deer asset candidate, with a completed CPU export and deformation audit. The actual Three.js loader/playback/scrub check passed; [independent visual review](deer-independent-review.md) accepts the scoped asset checkpoint, with continuous-motion judgment still open. The deer is not spawned in a biome and has no hostile behavior, death animation or gameplay integration in this scope.

## Source and diagnosis

Cees supplied `Meshy_AI_model_Animation_Walking_withSkin (2).glb` from Downloads and asked for a more elegant deer, suspecting a rig problem. The exact original is retained at [source/deer-walking.glb](../../assets/creatures/deer/source/deer-walking.glb): **4,412,064 bytes**, SHA256 `4dcadf23be2451d7410294c99ff4fdcdad273f28302d5a96b486de46fd7c064c`. No new image generation or paid service was used. Generation prompts and original generation settings were not supplied; do not infer them from the filename.

Source inspection used Blender's actual skinned mesh, the bind pose and multiple phases of the supplied one-second walk. The imported bone-display Icosphere helper was excluded from render and fit measurements. The visible long-necked, antlered fantasy anatomy remained connected. Bone segment translations in the animation matched the bind skeleton within approximately 3e-7 relative error. There was no demonstrated need to move joints or change weights. The supplied Hips scale is a constant approximately **0.668916**, affecting the whole rig, rather than evidence of a broken individual limb.

The conspicuous problem was the supplied generic gait: large fore/aft reach, crossing limbs, strong head/tail motion and uneven hoof contact. The raw material also used an albedo-driven emissive term, omitted explicit metalness (glTF's default is metallic), and had elevated specular settings. The repair therefore changes the gait, global normalization and material response while preserving the source anatomy and paint.

## Delivered asset and repair

The [runtime GLB](../../public/models/creatures/deer.glb) is **1,195,536 bytes**, SHA256 **`83addc21751d295043c11f754dcd7e9a3ac7ebc77ec1f216b870be7a465e0f77`**. It contains **15,187 triangles, 14,303 exported vertices, 27 joints and one draw primitive**. The albedo is converted to a maximum-1024px WebP; geometry, indices, normals, UVs, joint weights and inverse bind matrices retain their original bytes. Lossy WebP conversion preserves the authored image content but is not a claim of pixel identity. The new material is nonemissive, metalness 0 and roughness 0.84.

A wrapper establishes metres, glTF Y-up and front -Z. The **1.30m dorsal shoulder** is measured in the bind-proportion reference pose, behind the chest joint, excluding neck and antlers. It is not the overall height or a promise that the moving shoulder stays at exactly 1.30m. The sampled animated envelope is approximately 0.551m wide, 2.098m high and 2.291m long, including antlers and tail.

The new animation `walk` lasts **1.6 seconds**. Length-preserving leg solves place the hooves beneath their supporting shoulder/hip regions. The four-beat sequence is left hind, left fore, right hind, right fore, with **76% stance duty**, at least three supporting hooves and a **0.56m stance stride**. The authored swing lift is 7.5cm. The pelvis has restrained bob and lateral movement; the neck stays raised and the tail relaxed. Hoof orientation follows the bind sole, with weighted skin contact correction rather than a joint-height shortcut.

This is an in-place animation. During stance, the hoof travels backward in model space. A future locomotion system must advance the root at **0.4605263157894737m/s** at playback rate 1 to cancel that motion. Freezing hooves in model coordinates would cause sliding once the character moves. Terrain adaptation, turns, variable speeds and slope contact remain outside this asset-only work.

The [editable Blender file](../../assets/creatures/deer/deer.blend) retains the repaired action and a fake-user action named `Source walk (preserved)`. Source keyframes were retimed to preserve their one-second duration in the 30fps authoring scene. The runtime exposes only the repaired walk. Old source animation buffer data remain in the GLB for byte-preservation simplicity; this fits the 2MB limit. Blender save backups are disabled; no `.blend1` is part of the deliverable.

## Rebuild and numerical checks

Use Blender 5.2 and ImageMagick `magick`, from the repository root:

```sh
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_deer.py
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_deer.py -- --verify-only
```

`-- --skip-studio` rebuilds the export and numerical records without images. `-- --after-only` rebuilds and refreshes only the repaired studio images, retaining the unchanged source comparison. The builder imports existing `creature_motion.py` and `finish_pyrebear.py` helpers without modifying them. It uses CPU rendering, four threads and no downloads. Temporary raster files are created in the owned deer folder and removed after conversion. The original run encountered a shared temporary-storage quota failure during PNG output; relocating owned temporary images and removing them promptly resolved the evidence-generation failure. It was not a model or game defect.

The [intake manifest](../../assets/creatures/deer/intake.json), [97-phase deformation samples](../../assets/creatures/deer/deformation-samples.json) and [193-phase reimport verification](../../assets/creatures/deer/verification.json) retain the measurements and runtime identity. The public manifest mirrors the intake record. Python syntax parsing passed. Export assertions cover size, triangles, unchanged source buffer hashes, leg reach, hoof support, contact and reimport agreement.

| Check | Measured result |
| --- | --- |
| Largest authored IK target error | 0.000000681m |
| Maximum Blender reimport bounds difference | 0.000004530m |
| Authored stance sole range | +0.00199947 to +0.00200180m |
| Maximum backward stance speed error | 0.000026854m/s |
| Lowest interpolated skin vertex, 193 phases | +0.001688885m |
| Maximum first/last-phase vertex difference | 0.0m |
| Minimum supporting hooves | 3 |

The dense reimport test samples halfway between the 97 authored keys as well as the keys themselves. It evaluates every skinned vertex at those 193 phases on flat ground. It does not establish every possible subframe, terrain contact or browser performance. The original-source raw buffer hash assertions establish unchanged skin data independently of visual judgment.

Rejected working iterations included a shoulder estimator contaminated by backward-reaching antlers, stride centers too far behind the hips causing unreachable IK targets, and a shorter stance duty that left undesirable same-side support intervals. The final shoulder region, anatomically centered stride and 76% duty resolve those measured issues. None was evidence that the original skin weights required editing.

## Before/after visual and sampled-motion evidence

These are **Blender CPU studio captures**, not screenshots of the game. Both comparison sets use the same 800×700 camera, neutral lighting, AgX exposure 0 and matte material treatment. The source walk is independently normalized to a 1.30m dorsal shoulder so scale and emissive glare do not dominate the gait comparison. Thus the before set preserves the source gait but is not an untouched raw-material rendering.

| View | Original supplied gait | Repaired gait |
| --- | --- | --- |
| Side, phase 0 | [Before side](../../assets/creatures/deer/review/before-side.webp) | [After side](../../assets/creatures/deer/review/after-side.webp) |
| Oblique, phase 0 | [Before oblique](../../assets/creatures/deer/review/before-00.webp) | [After oblique](../../assets/creatures/deer/review/after-00.webp) |
| Eight consecutive sampled phases | [Before strip](../../assets/creatures/deer/review/before-strip.webp) | [After strip](../../assets/creatures/deer/review/after-strip.webp) |
| Looping sampled-pose animation | [Before GIF](../../assets/creatures/deer/review/before-walk.gif) | [After GIF](../../assets/creatures/deer/review/after-walk.gif) |

Individual frames `00` through `07` correspond to phases 0, .125, .25, .375, .5, .625, .75 and .875. Before timestamps are 0 through .875 seconds at .125s intervals; after timestamps are 0 through 1.4 seconds at .2s intervals. GIF delays total exactly 1.0s before and 1.6s after; the source alternates 12/13-centisecond delays because GIF cannot represent 12.5 centiseconds. These eight-pose loops expose stride changes and gross deformation, but they are not continuous high-cadence motion recordings. Do not infer a universal no-flicker or perfectly smooth-motion claim from them.

Author inspection finds a calmer, narrower stride, clearer long-neck carriage and coherent connected limbs in the corrected side and oblique images. This is an author assessment, not independent acceptance. Astra's [scoped review](deer-independent-review.md) and root's actual Three.js skinning check are recorded below/separately; continuous-motion aesthetic acceptance remains open. Cees retains product acceptance.

## Browser export review

`npm run test:browser -- -c scripts/creature-rig.config.js` passed one case in
9.8 seconds against the dedicated Vite5515 preview. Chromium151.0.7922.173 used
AMD Radeon860M / ANGLE GLES3.2. The exact83addc export loaded and skinned, played
continuously, paused and scrubbed five phases at1280×800, then rendered at390×844.
No page, console or shader errors remained. Root inspected the desktop and mobile
screenshots: connected limbs, complete antlers/tail framing and visible hoof
contact. This is neutral Three.js studio evidence, not a spawned game encounter,
terrain adaptation, controller journey or FPS benchmark.

The first viewer run completed its animation checks but failed the strict console
assertion on one404. Adding an explicit empty data favicon removed the request;
the identical animation rerun passed. No model or game runtime change was needed.
The failed trial is recorded above; final raw screenshots/video/JSON are
in ignored `test-results/creature-rig` and `test-results/fauna-evidence`. Reproduction:
start Vite on5515 and open `/scripts/fixtures/creature-rig.html?model=deer`.
