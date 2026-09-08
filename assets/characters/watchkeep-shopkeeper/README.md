# Watchkeep shopkeeper authoring package

User-supplied Crimson Outrider female biped, prepared as a stationary small-arms merchant. The exact original seven-animation archive is retained in `source/source-animation-pack.zip`; `source/intake-inspection.json` records every entry's bytes and SHA-256. Extracted GLBs are reproducible scratch, ignored to avoid duplicating the archive. Running, Walking and falling_down remain available inside that source archive and are not shipped in the merchant runtime.

`blender/finish_watchkeep_shopkeeper.py` is the repeatable export command. Run it from the repository:

```sh
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python blender/finish_watchkeep_shopkeeper.py --
```

`--verify-reproducible --skip-renders` reconstructs the candidate privately and asserts byte equality with the frozen runtime without rewriting it; the resulting `reproducibility.json` records source, exporter and asset hashes.

`--skip-renders` performs geometry/material processing and numerical validation without studio renders. `--render-only` imports the manifest-matched runtime GLB and refreshes only its studio evidence. The script checks the archive hash and extracts missing originals, protects the head and hands during reduction, preserves original skeleton/bind data and 66 source channels per clip while correcting six resting-arm rotation channels, embeds a 1024-pixel WebP, grounds the skin and reimports the final GLB. Blender 5.2, NumPy bundled with Blender, and the existing ImageMagick `magick` executable are used; no service, generation, or new dependency is needed. CPU renders use four threads, 16 samples and 800×900 pixels.

`watchkeep-shopkeeper.blend` contains the final editable optimized skin, packed image, source-derived armature and all four idle actions/NLA tracks. The scene is saved before adding the review floor/lights/camera, so studio furnishings are not part of the asset.

Additional evidence:

- `source/inspection-*.png`: original source appearance with imported material intact; these precede optimization and are not final asset evidence.
- `source/motion-inspection.json`: 31 source phases per idle and original loop/root measurements.
- `optimization.json`: reduction and protected-region surface error.
- `animated-reduction-comparison.json`: original-versus-reduced deformed surface comparison at five identical SOURCE phases in each idle, before arm retargeting; rerun with `ALSOFT_DRIVERS=null blender -b --python-exit-code 1 --python assets/characters/watchkeep-shopkeeper/check-reduction.py` after the main exporter.
- `source-preservation.json`: each original animation input/output buffer hash and exact inverse-bind comparison.
- `deformation-samples.json`: actual final GLB, evaluated at 60 Hz across every idle.
- `crossfade-samples.json`: local translation/rotation/scale blends for the intended four ordered 0.65-second transitions, 40 phases each.
- `review/*.webp`: final runtime GLB reimported in a neutral Blender CPU studio; not game evidence. `review/receipt.json` binds these images to the exported hash.

The runtime manifest and `docs/qa/watchkeep-shopkeeper-asset.md` contain final dimensions, hashes, measurements and limitations. Browser placement, interaction, shader and performance validation belong to the integration work and are not claimed by these Blender receipts.

The original 6360429f candidate and its seven studio images are retained in `history/6360429f-original-arm-posture/`. The user identified rear/outward resting arms, so the current exporter adds an articulated rest correction to Shoulder/Arm/ForeArm rotations on both sides. `arm-correction.json` records target directions and gesture-sensitive strength. Bind transforms and source archive remain exact; preservation receipts explicitly distinguish corrected rotations from 66 unchanged channels per clip.

`animated-reduction-comparison-context.json` binds the topology comparison to the combined original idles and the pre-retarget reduced GLB; both use the same source poses. It must not be interpreted as a difference between original and intentionally corrected arm motion.
