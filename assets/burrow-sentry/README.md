# Burrow Sentry S-04 source

Original Meridian Shipworks geometry, derived from the project's Burrow chassis.
The aft mineral cassettes and front cutters are replaced by a sealed second
operator pod, four external treads, pressure hatch and twin-barrel laser turret.
The uninterrupted forward window and flat cabin controls are retained. No
steering wheel, central display divider or proprietary third-party model is added.

Source is `burrow-sentry.blend`; authoring scripts are
`blender/build_mining_rover.py` and `blender/build_burrow_sentry.py`. Original
procedural PBR swatches and the approved Meridian emblem are reused from
`assets/mining-rover`; the concept references there inform the design. UVs belong
to this authoring pipeline. Reproduce from the repository root with Blender and
Python/Pillow:

```sh
blender -b -t 4 --python blender/build_mining_rover.py -- --sentry
python3 blender/pack_mining_rover.py --sentry
```

The checked export used Blender 5.2.0 LTS. The explicit `--sentry` switch writes
only Sentry source/export/manifest; the normal Burrow path remains the default.
Geometry is quantized within 1 mm and maps are lossless WebP. The manifest's
`packing` sizes describe the geometry-packing stage before texture replacement;
`bytes` and `sha256` describe the final GLB.

`public/models/burrow-sentry.glb` is **2,469,344 bytes**, **25,998 triangles**, 46
mesh primitives, nine materials and four embedded textures (three 1024² PBR maps
and the 512² RGBA emblem), below the 30,000-triangle/4 MB vehicle budget. SHA-256:
`db8b8d07afd7ad8507b746eefc077553f6996e6189cf623d2dbe60ca7ac48387`.

Metres, +Y up, -Z forward, origin at chassis ground reference. Measured rest
bounds are [-1.72000003, -0.00011554, -1.97300005] to
[1.30000428, 3.21499639, 2.60999990]. Layout bounds cover the complete moving
turret at [-1.72, 0, -2.01] to [1.30, 4.02, 2.62]; canonical wheel steering and
suspension extend the final collision envelope. Atlas fits; Gannet does not.

Required articulation and sockets are CabinDoor, GunnerDoor, SentryYaw,
SentryPitch, SentrySight, SentryMuzzle_Port/Starboard and the original independent
wheel/suspension hierarchy. The named muzzle transforms match the actual shared
fire rays across the tested yaw/pitch extrema. The screen and both physical eye
routes have mesh ray/sphere clearance checks. Doors and turret are rigid
hierarchy animation. There is no pressure simulation or hand IK.

The runtime loads through the shared GLTF/model-revision manager. Each vehicle
owns cloned materials and live screen textures; cached source geometry/maps stay
shared. Pulse beams retain logarithmic depth. Asset production and gameplay
acceptance, including failed attempts, are recorded in
[the QA record](../../docs/qa/burrow-sentry/README.md). The author verified the
actual game renderer and complete gameplay journeys;
the QA record preserves the original sampling failure and its checked analysis.
Independent scored art review remains pending.
