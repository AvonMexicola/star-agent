# Blender mesh scan and basic-shape cleanup

Use this baseline before changing an inherited or generated model. The scanner
opens `.blend`, `.glb` and `.gltf` inputs in memory and writes JSON plus Markdown
reports. It never saves or repairs a model. Agents should agree one part to clean,
preserve the source and fix its builder as well as any editable model.

Read the [asset standard](asset-production-standard.md),
[quality bar](../QUALITY.md), relevant pipeline memory and current HANDOFF first.
Geometry findings are inspection candidates. They do not establish visible
Z-fighting, finished art, independent approval or safe removal of a functional part.

## Run a baseline

From the repository root, with Blender available:

```sh
blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1 \
  --python blender/mesh_scan.py -- \
  assets/ship/nomad.blend public/models/nomad.glb \
  --output /tmp/nomad-mesh-scan

# All runtime models, including subdirectories.
blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1 \
  --python blender/mesh_scan.py -- public/models --recursive \
  --output /tmp/star-agent-model-scan

# Bound the task to named parts and supply known intent when useful.
blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1 \
  --python blender/mesh_scan.py -- /path/to/model.blend \
  --object 'Roof*' --expect 'RoofTip=pyramid' --output /tmp/roof-mesh-scan
```

`--object` accepts repeated case-sensitive globs; `--expect` needs an exact
object name in the scanned scope. Use `--current-scene --selected` instead of
input files when running the script inside an already open Blender scene.
For example, in the Python Console (replace the absolute repository path):

```python
import sys
sys.path.insert(0, '/absolute/path/to/star-agent/blender')
import mesh_scan
sys.argv = ['mesh_scan', '--', '--current-scene', '--selected', '--output', '/tmp/selected-scan']
mesh_scan.main()
```

Add the repository's `blender` directory to `sys.path` before importing it.
Scan in Object Mode. Start from a saved review copy, with the intended frame and
pose. Default source mode measures editable topology without applying modifiers.
Run again with `--evaluated` to measure the viewport modifier/pose result at the
loaded frame. That snapshot is not the glTF export: scan the exported GLB too.
Render-only modifiers and animation at other frames need separate checks.

Read `index.md` / `index.json`, then an asset's `.md` summary and `.json` details. Each report
records file/geometry hashes, Blender version, frame, scope, unit scale, polygon
IDs, counts and limits. Source and exported polygon IDs are different. Reports
may cap samples while retaining full counts. Raise `--max-samples` for a larger
selection; do not treat the sample as the full defect set.

An incomplete scan raises an error **after writing reports**. Always include
`--python-exit-code 1` so Blender returns a failing process status. Split a large
scan by object, or raise `--max-candidates` after reviewing its size. Optional
`--fail-on-overlap` fails on exact overlap candidates; it is a review gate and
needs intentional surfaces to be classified before becoming a release gate.
Batch imports continue after a failed asset and record it as an error in the
inventory; any input failure makes the overall command fail.

## What the scanner checks

| Finding | Interpretation and first action |
| --- | --- |
| `coplanar_overlap` | Distinct triangles overlap with positive area, within the weld tolerance; inspect both surfaces and choose the intended owner. |
| `near_coplanar_overlap` | Near-parallel triangles overlap within the configured gap; inspect decals, thin shells and panel clearance in motion. |
| `dense_planar_patch` | A connected flat region has more triangles than its simplified boundary requires; inspect for unnecessary subdivisions. |
| `overbuilt_simple_shape` | A closed face island fits a pyramid, box-like solid or triangular prism/wedge but uses at least twice the ideal unbeveled triangle count. |
| `shape_expectation_mismatch` | Explicit expected shape cannot be fitted; inspect noise, bevels, extra islands, holes or incorrect topology before rebuilding. |
| `degenerate_faces` | A tessellated triangle has near-zero area; inspect the listed source polygon for collapsed geometry. |
| `sliver_faces` | Very thin triangles; inspect whether they serve a bevel/detail or cause unstable shading. |
| boundary/non-manifold/winding counts | Inspect the topology samples against intended open surfaces, shells and normal direction. |
| loose vertices/edges | Inspect leftovers, helper geometry and intentional wires before deletion. |

The overlap pass uses a bounding-box hierarchy followed by plane checks and
projected triangle clipping. It catches partial overlaps and different
tessellations, including overlaps between separate objects. Shared edges and
vertices alone are excluded. Counts are **triangle pairs**, not unique defects;
one polygon pair can contribute multiple hits. Opposed normals are recorded,
since a thin shell may be intentional.

Raw and virtually welded topology are both reported. Virtual welding helps
distinguish glTF UV/normal/material splits from actual geometric holes. It uses
distance checks across spatial buckets and never edits source data. Welded edge
samples refer to virtual vertex indices, **not selectable source edge IDs**;
raw edge samples are source vertex pairs. Intentional coincident vertices may
be needed for seams, shading or rigging.

Flat regions are anchored to one plane to avoid accumulating curvature through
successive tiny angles. Shape hints fit closed connected islands from their
planar regions and corner connectivity. They cannot infer that arbitrary noisy
art ought to be a pyramid. Use explicit intent, or isolate the intended part in
a review copy. Patches with holes or branching boundaries have no simple-boundary
estimate. Dense planes are candidates even when their UV/material/detail needs
justify every subdivision. Box-like fits can include slanted hexahedra.
For example, the Gannet's dense cabin-floor grid is explicitly authored to carry
local vertex cavity AO in `blender/build_gannet.py`. Its geometric simplification
hint does **not** establish waste: preserve that shading or deliberately replace
the bake representation and validate the result before reducing those vertices.
Likewise, Stratum's fitted box-shaped walk deck retains a dense `ContactAO` grid;
its 2,622-versus-12 triangle hint is a geometry comparison, not permission to erase
the vertex shading. See [initial findings and disposition](qa/mesh-scan.md).
Organic meshes need their own deformation-aware review; a flat patch alone is
not a reason to dissolve part of a creature or character.

## Thresholds and scope

Coordinates use world transforms, including parents and non-uniform scale,
multiplied by Blender's scene `scale_length` to obtain metres. Positions are
processed with Python doubles. Choose tolerances appropriate to the smallest
detail; these defaults are starting points, not asset acceptance standards.

| Option | Default | Meaning |
| --- | ---: | --- |
| `--weld-distance` | 0.00001 m | Virtual coincidence and exact-overlap gap; near-zero triangle area uses its square. |
| `--plane-distance` | 0.0001 m | Maximum departure from the seed plane for flat regions. |
| `--overlap-distance` | 0.0005 m | Maximum plane separation for nearby overlap candidates. |
| `--angle-degrees` | 0.1° | Normal alignment and straight-boundary simplification. |
| `--min-patch-triangles` | 8 | Minimum flat-patch cost for a simplification hint. |
| `--min-reduction-ratio` | 2 | Actual / theoretical triangle ratio for a hint. |
| `--sliver-ratio` | 100 | Longest edge squared / twice triangle area. |
| `--max-candidates` | 2,000,000 | Overlapping triangle AABB pairs examined before marking the overlap scan incomplete. |
| `--max-samples` | 100 | Retained IDs/hit samples per finding/overlap report. |

Scope includes hidden scene mesh objects unless filtered. Confirm whether those
objects are actually exported or visible together. Collection instances and
unrealized Geometry Nodes instances are not enumerated: realize them in a review
copy or scan their exported GLB. This is not a general self-intersection, interior
face, UV quality, curvature-fitting, rig-quality or animated collision validator.
It cannot establish what is occluded or whether the game's depth buffer flickers.
GLTF file hashes exclude external buffers/textures; mesh hashes identify the
geometry actually scanned. No third-party Python packages or Blender add-ons are
required. Exercised with Blender 5.2.1; other versions remain unverified.

## Select a finding in Blender

Open/import the **same unchanged model**, enter Object Mode and use the Python
Console. Replace the path and object name with those from the report:

```python
import sys
sys.path.insert(0, '/absolute/path/to/star-agent/blender')
import mesh_scan_select
mesh_scan_select.select_report('/tmp/roof-mesh-scan/model.blend.HASH.json', 'RoofTip', 'overbuilt_simple_shape')
# Or select sampled overlaps on either participating object:
mesh_scan_select.select_report('/tmp/roof-mesh-scan/model.blend.HASH.json', 'RoofSkin', 'coplanar_overlap')
```

The helper validates the geometry/transform fingerprint, selects sampled polygon
IDs and enters Edit Mode. It refuses stale geometry and evaluated IDs. Linked
mesh data needs an intentional single-user review copy; hidden objects must be
made visible first. It never saves a model. Re-scan after any mesh/transform edit.
Use Frame Selected and wireframe/X-ray to inspect the actual part. Overlay Face
Orientation to check normals. Repeated selections replace the previous selection.

## Basic cleanup recipes

1. **Preserve contracts.** Record the source and builder, bounds, origin, node
   names, materials, UVs, vertex colours/AO, weights, shape keys and animation
   pivots. Inspect before changing topology. Retain bevels that carry the design.
2. **Remove accidental duplicates.** Inspect both overlap faces from oblique
   angles. Remove redundant faces from the responsible builder or mesh. Adjacent
   panels should share a deliberate join, and overlays need measured clearance.
   Verify shells, glass, decals and surfaces that are never visible together.
   Do not blindly merge separate objects or offset an entire assembly to hide it.
3. **Clean one selected region.** Use a small, measured Merge by Distance only
   where vertices should connect; then inspect Degenerate Dissolve and loose
   geometry. Check Face Orientation and recalculate outside normals for a closed
   solid; determine normals deliberately for open shells. Recheck the result.
4. **Simplify flat subdivisions.** Try Limited Dissolve on the selected plane,
   beginning with a low angle. Keep material, seam, UV and sharp delimiters
   relevant to the part. Inspect the UVs and exported triangulation afterward.
   A flat ngon is fine for an undeformed static panel if its tessellation works;
   preserve loops needed by deformation, cuts, shading and baked detail.
5. **Rebuild a primitive when clearer.** Measure the existing corners/apex and
   replace only the intended solid, preserving origin, transforms and hierarchy.
   Transfer/re-author UVs and material assignments deliberately. Add purposeful
   bevels afterward, then count the evaluated/exported triangles.

| Unbeveled closed primitive | Minimal construction | Ideal triangles |
| --- | --- | ---: |
| Square-base pyramid | Four base corners + one apex; four triangular sides + one planar quad base. | 6 |
| Box | Eight corners; six planar quads. | 12 |
| Triangular prism / wedge | Six corners; two triangles + three planar quads. | 8 |
| Single flat rectangular panel | Four corners; one quad. Add thickness when its function needs it. | 2 |

These are geometric references, **not mandatory final budgets**. Bevels, holes,
panel joins and supported moving/deforming parts add legitimate topology. Prefer
deliberate region cleanup or rebuilding the simple part to indiscriminate
collapse decimation of the whole asset. Do not change collision clearances,
walking floors, moving pivots or required node names as a topology side effect.

## Agent delivery checklist and reusable prompt

- Capture before/after counts, identical thresholds, source/export hashes, bounds
  and every intentional exception. Fix the generator so a rebuild keeps the fix.
- Run the source and final GLB scans; explain any capped samples or incomplete
  scope. Inspect materials/UVs/normals and compare silhouette at use distance.
- Validate the actual loader's hierarchy/material contracts and affected collision
  route. For changed art, inspect the game renderer at grazing angles and in motion
  with before/after captures; follow normal controller acceptance for affected
  playable behavior. Record actual evidence and independent review separately.
- Keep large generated reports in `/tmp` or ignored artifacts. Commit the durable
  reproduction, concise QA record, source/builder changes and curated evidence.

> Clean only `<asset / object / region>` using `docs/mesh-cleanup.md`. Read HANDOFF,
> claim source/builder/export paths and preserve other work. Scan the unchanged
> source and GLB into `<report directory>`; record hashes, thresholds and limits.
> Inspect `<finding and polygon IDs>` and explain intentional topology/overlays.
> Preserve silhouette, named nodes, pivots, materials, UVs, colours, rig and physical
> clearances. Repair the responsible source/builder, re-export and re-scan. Deliver
> before/after counts and bounds, loader checks and game-rendered motion evidence.
> Do not treat scanner hints as permission for blanket decimation or art approval.

## Check the scanner itself

```sh
python -m unittest discover -s tests/mesh_scan -v
blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1 \
  --python tests/mesh_scan/blender_integration.py
```

The fixtures cover subdivided primitives, seam-split vertices, within/between-object
overlap, partial overlap, opposed normals, thin shells, adjacent/disjoint faces,
degeneracy, slivers, winding, sample/budget limits and stale selection. Blender
checks exercise import/export, transforms, scene units, source preservation,
selection, modifiers and n-gon tessellation.

Blender references consulted: [Clean Up](https://docs.blender.org/manual/en/latest/modeling/meshes/editing/mesh/cleanup.html)
for cleanup operators and [Deleting & Dissolving](https://docs.blender.org/manual/en/latest/modeling/meshes/editing/mesh/delete.html)
for flat-region dissolution and delimiters. API behavior is exercised locally;
the documentation site's direct API fetch was unavailable during this task.
