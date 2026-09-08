# Stratum clear forward windscreen

Cees's permanent design preference is an unobstructed main forward pilot or
driver sightline, with no central windshield strut. This bounded correction to
`d77a015d7228e9ced83ac6d5fc462d3f831c30bd` removes only the separately authored
`Windshield centre mullion` from `blender/build_stratum.py` and rebuilds the
editable blend and packed GLB. The full forward pane and outer frame remain.

| Export | Original checkpoint | Clear windscreen |
| --- | --- | --- |
| SHA256 | `7cce466e64bb500fd35f7f559fd28b15a67db79df6e618f604512be5b2229058` | `78e9ffe41bb225a342e5765a504c15ff3ec00a94a9f2ddd0040f5500e137d827` |
| Triangles | 28,688 | 28,652 |
| Bytes | 3,574,792 | 3,573,040 |
| Meshes / primitives / nodes | 62 / 62 / 92 | 62 / 62 / 92 |

The exact decoded triangle comparison passes without coordinate rounding:
36 triangles removed inside the original central rod, zero added, and all
28,652 retained world triangles and position/normal/UV corner attributes
identical. All 324 protective-glazing triangles, three embedded WebP payloads,
material definitions, texture bindings, named hierarchy/TRS/extras, scene
membership and canonical layout are identical. Rest bounds remain exactly
`[-5.9599738121032715,0,-9.399999618530273]` to
`[5.9599738121032715,4.718013763427734,7.71999979019165]`.

Twenty finite rays from the canonical pilot eye to central points along the
windshield previously hit the opaque rod. All twenty are now unobstructed by
opaque triangles while still intersecting the glass. This is actual geometry
evidence; it does not claim structural strength or renderer acceptance.

The measured flight parts and mechanism measurements were regenerated against
the new GLB. Their numeric bounds, muzzle/nozzle frames and API are unchanged;
only their asset identity changes. No gameplay, input, navigation, cargo,
runtime loader, gear, ramp, mining rig or display placement code changes.

## Executed validation

- Blender 5.2.0 LTS rebuild and existing embedded-WebP pack: exit0.
- `node scripts/stratum-measure.mjs`: pass, same 14 separate flight parts.
- `node --test tests/stratum.test.js`: exit0, file-level wrapper receipt.
- `node tests/stratum.test.js`: all **10/10 checks pass**, zero skips,
  575.529385 ms. These cover actual geometry/budgets, gear/boom envelope,
  ramp/aisle/freight clearances, four MFD faces, muzzle precision, independent
  poses and malformed/disposed loading.
- `node node_modules/vite/bin/vite.js build --config scripts/stratum-vite.config.js`:
  pass in946 ms. The existing615.55 kB combined Three/studio chunk warning remains.

Raw logs and the before GLB/layout/source are retained under
`/tmp/star-agent-stratum-windscreen-qa/`. `windscreen-delta.json` records the exact
multiset and sightline proof; `geometry-check.mjs` is its CPU diagnostic, reusing
the previously retained rover-review actual-accessor reader from
`/tmp/star-agent-rover-windscreen-author/scripts/rover-review/asset.mjs`.
The original [checkpoint01](checkpoint-01.md) and its evidence remain unchanged.

No GPU/browser was launched for this correction. The first native Stratum views
must use the clear-windscreen export. Independent silhouette/PBR review and root's
separate physical game integration remain pending; prior CPU checks do not
establish a visual score, complete gameplay journey, performance or deployment.
