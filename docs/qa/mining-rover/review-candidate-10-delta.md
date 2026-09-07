# Burrow M-04 — strict candidate 09 to 10 geometry closure

**PASS: functional asset geometry, hierarchy and canonical mechanism layout are unchanged.** This is a CPU identity check, not a new visual score or a re-run of every contact sample.

Reviewer `/root/kestrel_reviewer`; frozen inputs:

- 09: `0ce536332a9e1b29d89d29981e510739c975cd739514cfe1e9e0b810120617fb`, 2,178,492 bytes.
- 10: `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`, 2,177,260 bytes.

The strict probe uses the portable GLB reader and compares winding-preserving triangle multisets with exact round-trip JavaScript double coordinates, **without rounding or geometric tolerance**. It retains duplicate counts and each triangle's node, primitive and material association. It checks local geometry as well as world geometry, so moving the same shape into a different articulated node would not pass.

| Check | Result |
| --- | --- |
| World triangles | All **21,570** identical; zero added/removed |
| Per-node local triangles | All **21,570** identical; zero added/removed |
| UVs and every triangle-corner attribute except NORMAL | All **21,570** decorated triangles identical |
| Node hierarchy, TRS, extras and world matrices | All **97** node records/matrices identical |
| Named mechanism nodes | **75** wheel, suspension, axle, link, door, step, cutter, muzzle and yoke nodes retained identically |
| Triangle primitive/semantic/material association | All **34** records identical |
| Packed vertex count | **35,342** in both exports |
| Embedded animation / skin data | Identical; **zero clips and zero skins** in both exports; rover articulation is runtime-driven |
| Canonical layout | Byte-identical; SHA256 `2d3912564b0cd16d212ae47fa528d475cc93a2941dcbdce10cbbad3b1e231a38` |
| Rest bounds | Exactly identical: min [−1.7200000286, 0.00000816265, −2.5499999523], max [1.3000042745, 2.5000147766, 2.0999999046] |

The actual changes are shading data: **3,616 triangles** have different normal-decorated corner records; 17,954 retain their old normals. The embedded **ORM image alone** changes, from 544,248 to 544,076 bytes. Base-color, normal-map and approved-emblem payload hashes are identical, as are glTF material records, texture bindings and samplers. This agrees with the proposed radial-side/flat-cap normal correction and packed steel roughness/metalness adjustment. It does not establish the appearance of those changes.

Identical per-node local triangles, transforms, hierarchy and canonical anchors imply the same geometry for the same runtime articulation. The prior sampled wheel/link, cutter, cabin-side and corrected camera-route results therefore remain applicable to the **asset geometry** within their original finite scope. This does not newly certify arbitrary runtime code changes, full-body boarding, continuous sweeps, pressure simulation, visual motion, transparency rendering, gameplay, saves or performance.

At the time of this check, the live source diff against `643a7d358fa3340c2cf3956277375b8159b416d5` also changes default cutter/camera aim pitch from −0.06 to −0.20 rad and interpolates camera orientation during closing-in, in addition to the transparent-glazing shadow policy. These separate preview changes are outside this geometry-identity result. No claim that the complete runtime is unchanged is made.

The probe checks the exact 09 and 10 SHA before comparing and rechecks the live 10 file afterward. It completed with **zero failures**, exit 0. No browser/GPU was launched and no production source was changed.

Reproduction after copying the portable directory into the repository:

```bash
export ROVER_REVIEW_OUT=/absolute/external/rover-review/candidate-10-delta
export ROVER_BEFORE_GLB=/absolute/archive/candidate-09.glb
export ROVER_BEFORE_LAYOUT=/absolute/archive/layout-09.json
node scripts/rover-review/delta-09-10.mjs
```

Prepared source: `/tmp/rover-review-portable/scripts/rover-review/delta-09-10.mjs`. Executed JSON: `/tmp/rover-review-portable-checks/delta-09-10.json`. The default input after copying is the repository's `public/models/mining-rover.glb` and canonical layout. The 09-to-10 probe asserts its own two fixed asset hashes; it intentionally fails on a later candidate until a new scoped comparison is authored.
