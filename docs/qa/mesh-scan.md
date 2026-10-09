# Blender mesh scan baseline — 9 October 2026

Status: tooling implemented and developer-validated. No models repaired, art
accepted or public deployment performed. The [cleanup guide](../mesh-cleanup.md)
is the reusable agent entry point; [brief](../briefs/mesh-scan.md) bounds the task.
Source base: local `dev/all-features`
`6bb57a7732684f0855f028a2b22163ae22139351`, isolated branch
`feat/blender-mesh-scan` in `/tmp/star-agent-mesh-scan`.

## Validation

- `python -m unittest discover -s tests/mesh_scan -v`: **15 tests pass**.
  Geometric fixtures include a clean 6-triangle pyramid, a seam-split 96-triangle
  subdivided pyramid, box/wedge fits, planar holes, partial/reversed overlaps,
  adjacency, thin shells, degeneracy, winding, loose geometry, thresholds and limits.
- `blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1
  --python tests/mesh_scan/blender_integration.py`: **passes**, Blender 5.2.1 LTS,
  hash `9e2066aef7ef`, Linux. Actual Blender source/GLB import/export, parent/rotation/
  non-uniform scale, scene unit scale, source file preservation, face selection,
  stale/evaluated selection rejection, modifiers, concave n-gons, world-space gaps,
  batch-error continuation and report-before-failure gates are exercised.
  Log: `/tmp/star-agent-mesh-integration-final.log`.
- `npm run check:repo`: passes. `git diff --check`: passes. `npm run build`:
  passes in 11.07 s; existing Vite large-chunk advisory remains.
  Log: `/tmp/star-agent-mesh-scan-build.log`.
- Required `npm run plan:checks -- --base origin/dev/all-features` ran; it includes
  533 paths from local integration history beyond the remote tracking base.
  The task-base plan against `6bb57a7` scopes this work to asset/integration tooling.
  No browser/gameplay/controller/performance pass is claimed: runtime and assets
  are unchanged. A later cleanup must supply its own game-rendered evidence.

The first Blender integration attempt used an unrealistically tight comparison
against literal `0.01`; Blender stores scene scale with float precision. The
fixture now compares against the actual stored scale. Two early Blender processes
stalled during restricted audio shutdown; only those processes were terminated.
`-noaudio` makes the final test exit normally. The glTF exporter reports an
unavailable optional MeshOptimizer library; default uncompressed fixture export
and import complete successfully. No compression support is claimed.

The first Nomad scan hit its 2,000,000-candidate cap. Inspection showed the budget
counted non-overlapping pairs emitted by broad-phase leaves. The scanner now
counts only overlapping triangle AABBs from distinct polygons. The complete
replacement reports retain actual findings; the rejected incomplete attempt is
kept at `/tmp/star-agent-mesh-baseline`.

## Runtime inventory

Command from the isolated worktree:

```sh
blender -b -noaudio --factory-startup --disable-autoexec --python-exit-code 1 \
  --python blender/mesh_scan.py -- public/models --recursive \
  --output /tmp/star-agent-model-scan
```

**113 of 113 GLB scans complete**, 1,637,894 triangles inspected, at the default
thresholds recorded in the guide and every report. Inventory:
`/tmp/star-agent-model-scan/index.md` and `index.json`; console/import log:
`/tmp/star-agent-model-scan.log`. The Markdown inventory was generated from the
completed JSON inventory after the aggregate Markdown writer was added.
Per-report colour-attribute metadata was subsequently added to the adapter;
the focused delivery reports use that version. The geometric pass is unchanged.

87 models produce exact or nearby overlap candidates. Totals are **67,364 exact
and 12,672 nearby triangle-pair candidates**, not that many confirmed defects.
There are 514 dense planar region hints, one overbuilt simple-shape hint,
81 object-level degenerate-face findings and 922 object-level sliver findings.
Samples are capped; full counts remain in JSON. Visibility, occlusion, intentional
joins/decals, animation and the real depth buffer were not examined by this scan.

## Bounded first cleanup candidates

| Asset / part | Measured finding | Next review action |
| --- | --- | --- |
| `base/roof-triangle.glb` / `roof-triangle_EdgeSteel` | 116 asset triangles, 12 exact overlap triangle pairs. First sample: polygons 24 and 1, same-facing normals, zero measured gap. | Inspect edge trim ownership and oblique in-game visibility; fix the responsible source/builder if redundant. |
| `base/roof-corner.glb` / `roof-corner_MineralConcrete` | Four dense-plane hints; rectangular regions include 50 and 98 triangles versus a theoretical 2. Three exact overlap pairs also occur. | Inspect material/UV/vertex shading, then clean one planar region while preserving roof joints and collision. |
| `base/roof-edge.glb` / `roof-edge_MineralConcrete` | One 50-versus-2 planar-region hint; three exact overlap pairs with trim. | Classify trim contact and shading before simplifying. Opposed-normal overlap can be intentional closure. |
| `cargo/1-sbu.glb` / stacking rail and corner extrusions | 2,592 asset triangles, 268 exact overlap triangle pairs; first sample names `Stacking rail` polygon 3 and `Corner extrusion.001` polygon 3. | Inspect the joining surfaces, preserve cargo bounds and attachment/grid contracts, repair a bounded repeated construction if needed. |
| `nomad.glb` | 57,628 triangles, 93 exact and 40 nearby pairs; nearby cabin samples have opposed normals and approximately 0.5 mm separation. | Inspect shell/overlay function and simultaneous visibility; nearby surfaces alone are not a confirmed Z-fighting defect. |

These are proposed review tasks, not ownership transfers or accepted fixes.
The report samples provide polygon IDs tied to the input hashes. Reports from
the source `.blend` have different IDs/counts from the triangulated GLB: the Nomad
source finds 87 exact pairs versus the export's 93 at the same triangle count.

## Deliberate geometry that must be preserved

- **Gannet**: `CabinFloor Geometry` has two planar 1,800-triangle regions whose
  simplified six-corner boundaries would need four triangles each. The builder
  explicitly adds a 0.29 m grid for local cavity vertex AO, including samples next
  to furniture plinths. `blender/build_gannet.py` documents and bakes this shading.
  This is a meaningful density finding, but not established waste. Keep the grid
  unless a deliberate replacement preserves contact shading in the game.
- **Stratum**: `Stratum_Static__brushed_mechanisms Geometry`, source mesh
  `Walk deck`, fits a closed box-shaped island with 2,622 triangles versus the
  ideal unbeveled 12. The builder's closed slabs use dense grids and `ContactAO`
  to avoid broad four-corner shading interpolation. This hint requires a vertex
  data/shading review, not automatic primitive replacement.

The synthetic pyramid fixture proves the recognizer catches over-tessellated
pyramids. No real runtime pyramid cleanup is claimed. Slightly noisy, beveled,
joined or material-split shapes may require explicit `--expect` intent or an
isolated source part to get a useful fit.

## Focused input identity

Final representative reports: `/tmp/star-agent-mesh-baseline-delivery/index.md`.

| Input | SHA-256 |
| --- | --- |
| `assets/ship/nomad.blend` | `a7c374cbae510d32e475162617b570616105163aa2536e4686d9743ec9ae84aa` |
| `public/models/nomad.glb` | `33a64aba2093e40768862fb130e81382b1900c11a8913080202efe9d89f204da` |
| `public/models/base/roof-triangle.glb` | `2a6f3043257f54ec184ba63ab39c99ddc5118ff97e81f6291d2270674f4d047f` |
| `public/models/base/roof-corner.glb` | `eade0bc4528e823a56958a0abfe4bca431d99eb88c7871a7a07b93a659208ed9` |
| `public/models/cargo/1-sbu.glb` | `eb7162f120ea0986f231705aea8d34bd08a8857545cad5035f193e7ec401a9f9` |
| `public/models/gannet.glb` | `8da0bc2e3da7c8c2a2db7b29957b226fab0ba30eb0155f98d82a3f82c3995e6f` |
| `public/models/stratum.glb` | `1f5cae2a4901a2618d7cff36f1713a19777b45d586022614b9bc5449560cb75b` |

Generated bulk reports stay outside commits. The guide, fixtures, concise
findings/failed attempts and recorded identities are the durable baseline.
No preview/server process or production configuration is needed by this tool.
