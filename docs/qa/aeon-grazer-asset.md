# Mallow grazer — source-preserving asset intake

Date: 7 September 2026. Stable asset ID: `aeon-grazer`. This ledger covers the source, Blender asset preparation and CPU validation. Root owns habitat, peaceful/flee behavior, runtime loading and browser checks. Their implementation or acceptance is not inferred from these studio images.

## Provenance and anatomy

Cees supplied the newest `Meshy_AI_model_Animation_Walking_withSkin (4).glb` and requested a **big friendly grazer**. The exact source is retained at [aeon-grazer-walking.glb](../../assets/creatures/aeon-grazer/source/aeon-grazer-walking.glb): **7,555,904 bytes**, SHA256 `8edeacf0cdb52013d50f1ce2210acc996cfa661fc7adc1f2f8631884296576fd`. Original generation prompts/settings and licensing details were not supplied with the file; this record does not invent them. No new generation, downloads or paid service were used.

Actual Blender source inspection found a rounded lavender-and-cream barrel body, four stout legs, broad feet, soft ears, small horns/chin tendrils, dorsal ridges and a curled tail. Its original 27-joint skin is connected. The supplied walk has 81 joint channels and lasts one second. The source is not an aggressive animal remodel: its paint, facial features and body proportions remain intact.

The [source oblique](../../assets/creatures/aeon-grazer/review/source-oblique.webp) and [opposite view](../../assets/creatures/aeon-grazer/review/source-opposite.webp) retain that intake evidence. These two raw-material inspection views were fitted to a three-metre longest dimension for framing; they are not the final two-metre-shoulder scale, matched before/after comparisons or game screenshots. The original emission and metallic defaults make the source look flatter/brighter than the matte runtime treatment.

## Runtime identity and dimensions

Current [runtime GLB](../../public/models/creatures/aeon-grazer.glb): **978,832 bytes**, SHA256 **`78598117a9a47bbc0eebedd708a8248a1a1e4a61b5923e9bb6e7640a16f41bb9`**. The asset has **13,697 triangles, 9,568 vertices, 27 joints, one material and one draw primitive**, within the assigned 20,000-triangle/2MB limits.

Root approved a **2.00m dorsal shoulder**. This anatomical measurement uses phase-zero dorsal skin around the chest joint, relative to that pose's lowest skin vertex. It is not the height of the horns, tail or entire moving silhouette. The 241-phase normalized walk envelope measures:

| Dimension | Metres |
| --- | ---: |
| Width | 1.796768 |
| Overall height | 2.437045 |
| Overall length | 4.090087 |
| Conservative horizontal half-width | 0.898384 |
| Conservative horizontal half-length | 2.045043 |

The earlier 61-phase probe measured 2.422499m overall height; the denser result above supersedes it. Coordinates are metres, glTF Y-up, forward -Z, centered horizontally across the complete sampled walking envelope. These dimensions describe the asset and do not establish runtime collision or slope safety.

The source vertices, topology, normals, UVs, weights, inverse binds and all 81 original walking joint channels remain unchanged. The exporter asserts the original non-image buffer hashes, accessors, meshes and skins. A new wrapper establishes scale/orientation and contributes a sampled vertical grounding track. The source albedo is converted to an embedded maximum-1024px WebP. This preserves the authored paint content, not lossless pixel identity. Material response is explicitly nonemissive, metalness 0 and roughness 0.85, with the source's elevated specular extensions removed.

## Walking and collapse

The original in-place `walk` remains one second long. Measured backward sole motion during low-foot intervals gives a median matching travel estimate of **2.126541m/s** at playback rate 1; the manifest recommends **2.1m/s**. This is an estimate from the supplied gait, not a claim of perfect planted-foot motion. A slower 0.8m/s patrol should play the clip at approximately 0.38 speed. The actual runtime must connect animation phase to movement; changing only world speed would introduce sliding.

A new **2.4-second `death`** clip uses authored joint tracks, with a static final pose and no loop. It settles the barrel onto broad belly support, folds distal leg chains, lowers the neck/head toward the forepaws and relaxes the tail. The sparse source rig has no separate neck bone: the head origin arcs about the chest pivot to retain neck length while lowering the head without rotating the whole chest farther. This changes authored pose transforms, not the source bind skeleton or skin weights.

The lower barrel shares weights with proximal leg roots. Holding those roots stable and solving only the distal elbow/knee chains avoids flattening the body. Central belly support therefore includes those rigid proximal-weight regions as well as Hips/chest. Distal joints use an exact two-segment solution with a continuous bend direction. The broad animal retains its body volume as the legs fold.

## Measured verification and rejected iterations

The builder reimports the actual emitted GLB before validation. [Intake metadata](../../assets/creatures/aeon-grazer/intake.json), the [public manifest](../../public/models/creatures/aeon-grazer-manifest.json) and [deformation samples](../../assets/creatures/aeon-grazer/deformation-samples.json) retain exact identities and measurements.

| Check | Measured result |
| --- | ---: |
| Walking bounds agreement after GLB reimport | Maximum 0.987µm |
| Grounding samples authored / checked | 241 / 481 phases |
| Dense walk lowest-skin range | -1.234mm to +5.016mm |
| Preserved source walk endpoint difference | Maximum 3.985mm per vertex |
| Death samples authored / checked | 61 / 121 phases |
| Dense death lowest skin | -3.060mm |
| Walk-zero to death-zero skin displacement | Maximum 24.49µm |
| Death limb-segment length difference | Maximum 31.93µm |
| Largest adjacent death vertex displacement | 33.95mm per 20ms sample |

The small source walk seam is retained and reported. An initial stricter 2mm seam gate rejected it; the documented intake ceiling is 5mm at this scale, preserving the supplied animation rather than silently editing its joint curves. It is **not an exactly closed loop**.

Rejected collapse iterations are part of the record:

- The first generic full-leg fold pulled torso-weighted vertices into a flattened barrel and sank the curled tail roughly 40cm. It was rejected from actual side/oblique images and skin-region probes.
- Freezing proximal roots exposed an incorrect support selection: the lowest belly includes those roots' weights. A Hips/chest-only selection measured the upper body and lowered the barrel too far. Including the actual central belly regions corrected the support calculation.
- The first supported pose still held its head and tail like an alert resting animal. The neck/head and distal tail were relaxed while retaining the barrel and folded limbs.
- A stronger neck/chest pose exposed an iterative right-foreleg solve flip near 26% collapse: approximately 19cm between adjacent 20ms samples. Exact distal IK with a continuous bend direction removed that measured defect. The final maximum is approximately 3.4cm.

Contact and continuity results are finite flat-ground samples, not proof for every subframe or terrain slope. The small measured skin intersections are stated explicitly. Browser shading, locomotion, mixed-clip transitions and independent visual acceptance require separate checks.

## Editable source and reproduction

The [editable Blender file](../../assets/creatures/aeon-grazer/aeon-grazer.blend) contains the normalized skinned mesh and both runtime clips. The raw supplied GLB remains separate. The [builder](../../blender/finish_aeon_grazer.py) owns grazer-specific collapse logic and imports the existing GLB/skin utilities from `finish_pyrebear.py` and `creature_motion.py` without editing either helper.

From the repository root, with Blender 5.2 and ImageMagick installed:

```sh
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_aeon_grazer.py --
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_aeon_grazer.py -- --skip-renders
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_aeon_grazer.py -- --render-only
```

The full command exports, validates, saves the editable file and creates CPU studios. `--skip-renders` runs the export/validation without images; `--render-only` verifies the manifest matches the existing GLB and refreshes studios without changing that GLB. CPU rendering is limited to four threads. Blender backup saves are disabled. Temporary PNGs are removed after WebP conversion; generated execution logs remain outside the repository. This machine printed a Blender extension-registration startup warning, but the final numerical process completed successfully; it was not a model-validation failure.

A second separate `--skip-renders` invocation reran all numerical and source-preservation assertions and produced the **same complete GLB SHA256**. The [rebuild receipt](../../assets/creatures/aeon-grazer/rebuild-verification.json) records this result. The editable Blender file is 1,330,399 bytes; byte-identical `.blend` files or stochastic studio renders are not claimed. Python syntax parsing passed, the two manifests match, and no `.blend1`, generated logs or temporary review PNGs remain in the owned asset folder.

## Completed studio evidence

The final runtime was reimported for nine **Blender 5.2 Cycles CPU** views: 800×600, 12 samples, denoising, four threads, AgX exposure 0 and a neutral studio floor. The stamped images explicitly identify themselves as studio evidence. They are not game captures, and their lighting is not a claim about the grassland scene.

- [Standing side](../../assets/creatures/aeon-grazer/review/side.webp) and [front](../../assets/creatures/aeon-grazer/review/front.webp).
- [Walking strip](../../assets/creatures/aeon-grazer/review/walk-strip.webp), with phases 0, .25, .5 and .75, corresponding to 0, .25, .5 and .75 seconds of the original one-second clip.
- [Sampled walking GIF](../../assets/creatures/aeon-grazer/review/walk-sampled.gif): four sampled poses, 250ms each, looping over one second. It is a coarse pose preview, not a continuous recording or smooth-motion proof.
- [Collapse strip](../../assets/creatures/aeon-grazer/review/death-strip.webp): start, 1.2s midpoint and 2.4s final pose. The start uses walk phase zero, whose measured difference from death zero is approximately 24.49µm.
- [Collapse midpoint](../../assets/creatures/aeon-grazer/review/death-mid.webp), [final oblique](../../assets/creatures/aeon-grazer/review/death-final.webp) and [final side](../../assets/creatures/aeon-grazer/review/death-side.webp).

Author inspection of these actual export views found the barrel volume retained, connected folded limbs, and a low supported final pose. Dense numerical sampling complements the three illustrated collapse phases; neither substitutes for actual browser motion and terrain testing.

## Review status

The final numerical candidate above passes its builder assertions. Astra independently read the final side/oblique prototypes stamped 20:15 and both source intake views, scoring **corpse passivity 4/5**. The reviewer found the lowered jaw resolved the alert posture, the broad belly/barrel remained intact and the legs read as folded/splayed. The remaining lifted tail tip was nonblocking. This is a scoped static-pose result: the reviewer did not observe motion or the game. The completed studio set has been sent for a final independent read; root's Three.js/game checks remain separate gates at this checkpoint. No overall art or gameplay acceptance is claimed here. Cees retains product acceptance.
