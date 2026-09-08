# Meridian Burrow M-04

Original compact enclosed four-wheel mining vehicle. This is a development
candidate; see the current [concept-upgrade record](../../docs/qa/burrow-concept/production-record.md)
for validation and independent review status.

Current export is concept checkpoint **12e: 24,902 triangles / 2,427,608 bytes**,
SHA-256 `5433c83744a21e6c4022dfd9b840f15069c96f95111b0518fbb851d2f8495bc1`.
It adds fitted cabin liners, recessed storage and warm coves, five flat LCARS-style
instrument faces, fuller tread and manufactured shell details. Physical steering
wheel, column and pedals are removed. The canonical dimensions, pilot eye, clear
windscreen, boarding path, suspension and twin-cutter origins are retained.

Native author inspection, actual-asset geometry checks and complete controller
carrier gameplay pass. The current record distinguishes keyboard/touch validation,
local integration and pending independent visual acceptance. Previous candidate
10 scores and the [candidate 11 windscreen correction](../../docs/qa/mining-rover/windscreen-open/README.md)
are historical; they do not approve this new export.

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
cockpit uses one runtime canvas atlas and material across `RoverDisplay`,
`RoverCuttersDisplay`, `RoverOreDisplay`, `RoverDrivePad` and `RoverMiningPad`.
These fitted faces show actual telemetry and shared input feedback. They are not
ray-click vehicle controls; keyboard, controller and the existing phone controls
continue to operate the rover.
