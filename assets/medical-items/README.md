# Supplied medical assets

Cees supplied the Meshy bandage and injector GLBs; originals remain unchanged in
`source/`, with original filenames and SHA-256 in `intake.json`. The repair-tool
filename is still awaiting clarification; no unknown download is labelled as it.

```sh
python assets/medical-items/prepare-textures.py
node assets/medical-items/pack.mjs
```

Pillow is the only texture-conversion dependency. Geometry and UVs remain intact;
the already small 762/534 triangle meshes do not need decimation. Existing PBR
maps are reduced to 1024² WebP. Bandage longest extent is 11 cm; injector height
is 16 cm. Metres, +Y up, ground origin. Original double-sided material behavior
is retained pending a close-up shell review.

These are catalogued prop-library assets, not new medical gameplay. Existing
bandage/stim inventory effects are unchanged; 3D equip/use animation is not
implemented by this intake. Inspect the shipped models in the native Three.js
prop viewer before using them as close-up hero items.
