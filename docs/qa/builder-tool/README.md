# Handheld builder production record

2026-09-08, Europe/Amsterdam. [Brief](../../briefs/handheld-builder.md).
Author implementation and browser04 validation complete on the pre-phone-adjustment
checkpoint from `5f8f018`. A narrow portrait mount refinement awaits the final
combined handheld run. Independent, physical-device and performance acceptance
remain pending. Local integration is not yet claimed.

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

## Browser04 receipt

Both complete tests passed in 3.9 minutes on Chromium 151.0.7922.173 / ANGLE
OpenGL ES 3.2 / AMD Radeon 860M, 1440×900 and native-touch 390×844. No application
errors, warnings or failed requests. Real controller menu entry, 8 metal / 3
conductor / 2 glass debit, actual floodlight placement, occupied-space refusal,
result inventory, held-A modal/focus/device gates, camera change and equipment
restoration pass. Keyboard and native CDP touch placement/exit also pass. No pose
or action callback was injected; physical-device testing is not claimed.

Retained failures: qa01 lost its own stdout when Playwright removed the output
root; the evidence and runner output directories are now separate, and both
servers have explicit cwd. qa02's held A selected the Comms tab and correctly
suspended UI input; the test now holds A on the real Resume control. qa03 passed
the complete controller path but its recorder omitted the avatarStudio state
fallback. That recorder correction is present in the passing qa04.

Author image review verified native finish, actual in-game projection and grip.
The phone controls work, but the original desktop mount falls outside the narrow
frustum; a portrait-only builder mount adjustment is pending the next browser
receipt. The third-person screenshot caught a transient jump from the shared
bumper camera chord; the final capture will wait for the physical landing.
The same native model is registered in the existing avatar studio for grip review.

Raw receipts: ignored `assets/builder-tool/.staging/qa-01` through `qa-04`, including
logs, source hashes, game states and videos. Curated native and real-game images
here retain distinct labels. Independent art/hardware review and FPS remain pending.
