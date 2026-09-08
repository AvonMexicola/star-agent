# K-17 Mk1 source

Reference: Cees's supplied PNG in `source/`, unmodified with its intake hash.
Geometry, UV mapping, material atlas variant and contact AO are authored in this
repository. `mining-tool-mk1.blend` retains named editable parts. No hosted model
service is required to rebuild or play.

```sh
python assets/field-cutter/textures.py
blender -b -t 4 --python assets/field-cutter/build.py
node assets/field-cutter/pack.mjs
```

Texture generation requires Pillow and the JetBrains Mono font. Blender uses
the existing `assets/handheld-tools/build.py` and `blender/build_gear.py` helpers.
The packer checks the real binary before replacing the shipped model and updates
both handheld and prop manifests. The original handheld builder remains a
historical source; use this directory to rebuild the current cutter.

Metres, glTF +Y up, bore -X. Fixed muzzle `[-.6,.14,0]`, support grip
`[-.3,.01,0]`, palm origin `[0,0,0]`. `CutterRotor` pivots at `[-.52,.14,0]`
about X. `HeadMount` at `[-.44,.14,0]` identifies the common K17-M30 datum.
Future cartridges must keep the central 27 mm shaft clear and the rear axial
clearance intact. Only Mk1 is implemented; no tier-selection UI is claimed.

The runtime asset has five draws: three fixed body finishes and two rotor
finishes. The glass and core emitter remain fixed while the amber pods revolve.
