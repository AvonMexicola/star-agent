# Meridian Burrow M-04

Original compact enclosed four-wheel mining vehicle. This is a development
candidate; see the current [production record](../../docs/qa/mining-rover/production-record.md)
for validation and independent review status.

Current export is candidate 10: **21,570 triangles / 2,177,260 bytes**, SHA-256
`88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`.
The [strict 09→10 delta](../../docs/qa/mining-rover/review-candidate-10-delta.md)
retains geometry, UVs, hierarchy and mechanism layout; only rod/cap normals and
the ORM payload change. Native static review is 4.04/5; keyboard motion is 3.8/5,
with an explicitly mixed-evidence mean of 4.00/5. Recorded controller, keyboard
and native touch journeys pass at the checkpoints in the production record.
The adjusted physical MFD footer still needs a settled desktop visual check;
the phone controls obscure it. Performance and Cees's final acceptance are not
implied by these scoped results. The manifest's generation-stage text is historical;
the production record carries the current review/delivery status.

The asset uses the Kestrel/Meridian manufacturing language: ivory ceramic panels,
graphite polymer, steel, petrol cassette housings and mint work lights. Geometry
and seeded PBR swatches are authored in this repository. No external model,
photograph, paid account or hosted generation service is required.

## Reproduce

With Blender and Python/Pillow installed, from the repository root:

```sh
python3 blender/rover_textures.py
ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio --python-exit-code 1 --python blender/build_mining_rover.py
python3 blender/pack_mining_rover.py
```

`mining-rover.blend` is the editable source. `layout.json` owns runtime dimensions,
mechanism names, mounting axes, cutter origins, pilot eye, boarding route and the
Atlas parking pose. `manifest.json` measures the packed GLB. The final pack step
quantizes rigid geometry within 1 mm and embeds three 1024² lossless WebP maps plus the approved
512² Meridian emblem with its alpha channel.
Texture provenance includes file hashes and seed7291.

Metres, +Y up, -Z forward, resting tyre contact atY0. Fixed port steps are part of
the 3.02m straight-wheel width; steering extends the starboard tyre and gives a
3.232m conservative swept width. Capsule/collision and cargo fit must include the
steps. Suspension travel is ±.22m, not .22m total. Each named arm/damper follows
its actual wheel carrier; hub clevises do not rotate with the tyre.

The cabin is a closed geometric shell with a working door. Pressure, life support,
seated hand IK and multiplayer vehicle authority are not simulated. The live
cockpit screen is a runtime canvas at `RoverDisplay`.
