# Tideback / Aeon amphibian source pack

User-supplied Meshy skinned walking creature for Aeon beaches. No new generation,
credit spending or hosted dependency was used during intake. Source generation
prompt/settings were not supplied.

- `source/aeon-amphibian-walking.glb`: exact original download.
- `source/albedo.png`: exact embedded source PNG.
- `aeon-amphibian-albedo.webp`: derived1024², quality88 runtime map.
- `aeon-amphibian.blend`: editable reimported runtime rig with walk/death actions.
- `intake.json`: source/runtime identities, transforms, budgets and validation.
- `deformation-samples.json`: original walk, normalized walk and authored death.
- `motion-validation.json`: sampled shell continuity, limb lengths and continuity.
- `review/`: nine actual-export Blender CPU studio views, explicitly not game evidence.
- `source/rejected-*.png`: failed collapse views retained to explain corrections.

Rebuild from the repository:

```bash
ALSOFT_DRIVERS=null blender -b --python-exit-code 1 \
  --python blender/finish_aeon_amphibian.py -- --shell-height .8
```
The anatomical size landmark is the dorsal shell crown, not a shoulder joint.

Development candidate: independent/game review remains separate from numerical
validation. See `docs/qa/aeon-amphibian-asset.md` for current findings and limits.
