# Handheld builder production record

2026-09-08, Europe/Amsterdam. [Brief](../../briefs/handheld-builder.md).
Author implementation in progress, based on local `5f8f018`. No independent,
hardware or performance acceptance is claimed. Runtime and verification evidence
will be recorded before local delivery.

The new model uses the existing original handheld atlas and Blender geometry,
UV and contact-AO helpers. Other held assets are not rebuilt. Editable source:
`assets/builder-tool/builder-tool.blend`; builder and packer in the same directory.
Native GLB, fixture and actual game views will be labelled separately.

## Author checkpoint

Current GLB `ff62545afa3a7ed57b018eccf1f307f3861f706be1ce4a0c998a2b55c58e3f27`:
4,700 triangles, 513,804 bytes, three material batches / three shared 1024² WebP
maps, plus one live 256×128 screen. Bounds: 0.275 × 0.2277 × 0.104 m.
The successful action projection adds one eight-triangle draw for 0.65 seconds.
It cannot consume ammunition, extract material or approve placement.

All seven affected test files pass (`/tmp/builder-focused02.log`); all 154 normal
test files pass (`/tmp/builder-all-unit01.log`). The first combined command used
`--test-isolation=none` and exposed pre-existing cross-file loader-cache coupling;
the normal isolated runner is retained. A real screen-anchor failure also occurred:
glTF rebases empty local axes, so the plane's normal disagreed with its physical
backing. Correcting the authored empty basis closed all nine backing/clearance
samples; all nine aperture rays pass. Original first GLB retained in ignored
`assets/builder-tool/.staging/screen01-builder-tool.glb`.

Blender01 completed source/export, then hung in sandbox audio shutdown with
`pa_write ... Operation not permitted`. Only its owned process was terminated.
Corrected Blender02 exited 0 outside the sandbox. Blender's inherited multi-image
sampler warning remains in `/tmp/builder-author02.log`; actual game material
inspection is pending. Full production build passes in 6.36 s at the preceding
viewer version (`/tmp/builder-production01.log`); the final viewer build is
`/tmp/builder-production02.log`. Repository check passes; the suggested check plan
is `/tmp/builder-check-plan01.log` and is not a test result.

Browser evidence, local integration and independent acceptance remain pending.
The same native model is registered in the existing avatar studio for grip review.
