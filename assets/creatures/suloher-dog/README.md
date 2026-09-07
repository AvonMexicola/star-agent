# suloher-dog source pack

User-supplied Meshy quadruped for Miasma; source generation prompt/settings were
not supplied. This task performed no hosted generation or credit spending.

- `source/suloher-dog-walking.glb`: exact supplied walking/skinned GLB.
- `source/albedo.png`: exact embedded source image, extracted for encoding.
- `suloher-dog-albedo.webp`: derived 1024-edge, quality88 runtime albedo.
- `suloher-dog.blend`: editable validated runtime rig with walk/death actions.
- `intake.json`: complete source/runtime identity, transformation and validation.
- `deformation-samples.json`: original walk, normalized runtime walk and authored death samples.
- `motion-validation.json`: final runtime limb-length and motion sampling.
- `review/`: labelled Blender CPU studio evidence from the emitted GLB.

Rebuild from the repository using `blender/finish_pyrebear.py -- --species suloher-dog`
under headless Blender, with `ALSOFT_DRIVERS=null` and `--python-exit-code 1`.
The approved phase-zero grounded withers height is 0.85m.
See `docs/qa/pyrebear-asset.md` for the exact command, failed probes and limitations.

These are development candidates. Studio checks do not establish in-game visual
acceptance, combat behavior, biome placement, controller support or performance.
