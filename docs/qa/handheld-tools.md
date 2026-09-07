# Handheld Blender and material pass

Candidate in `art/handheld-tool-pass`, based on checked tractor `b1ed035` and live
wildlife `20e9f1b`, reconciled at `93c6291`. This is a builder's quality check and
development candidate, not independent visual acceptance or public deployment.

## Measured exports

| Asset | Triangles | GLB bytes | Draw primitives |
| --- | ---: | ---: | ---: |
| Laser rifle | 9,654 | 887,560 | 3 |
| Sidearm | 2,404 | 285,716 | 3 |
| Mining cutter | 7,916 | 742,504 | 4 |
| Cargo tractor | 5,164 | 516,012 | 3 |

Three authored1024² WebP maps, shared between equipment assets; estimated16MiB
RGBA+mip residency. Exact hashes, bounds, axes, hand/muzzle coordinates and source
paths are in `assets/handheld-tools/manifest.json`. Individual editable Blender
sources and rebuild scripts are retained. The character builder now preserves the
independently authored rifle instead of replacing it with its historical UV-free
stock-fitting output.

## Checks and correction record

- Baseline three props: no UVs, five to seven draws; tractor mode reused cutter.
  Existing rifle stock was already shortened and its fit was preserved.
- First atlas used independent pixel grain and cost818,172 bytes for maps alone.
  A repeated micrograin reduced this to118,830 bytes without enlarging textures;
  no prop budget exception was taken.
- First Blender export dropped contact colours because they were not wired into
  the material node graph. Set explicit active vertex-colour export; the shipped
  GLBs now contain `COLOR_0`, checked in the binary and respected by the loader.
- Export warning about multiple texture nodes applies to the shared ORM sampler;
  all three nodes use the same filtering/wrapping. No missing UV warning remains.
- Initial equipment contract suite correctly flagged the new sixth item and its
  non-firing shot kind. Updated the equipment contract to include the tractor and
  explicitly keep cargo as its beam authority. Subsequent focused42checks pass.
- Shipped GLB/UV/normal/PBR/hash/budget/anchor assertions, texture reuse/vertex AO
  preservation, actual expedition rig fitting and tractor non-firing checks pass.
- Full unit suite:880passed, zero skipped/failures,39.1s. Production build passes;
  inherited large-JS-chunk advisory remains. Repository/whitespace checks pass.
- Repository intake first caught an invalid multi-part task ID and `.blend1`
  backups. Task is SA-ART-001; owned backups removed and builder disables future
  backups. The previous cargo task retains the same owner's mining hook claim.

Browser checks and image inspection follow on a single coordinated GPU window.
Record their actual result before claiming visual or gameplay validation.
