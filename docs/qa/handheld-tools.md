# Handheld Blender and material pass

Candidate in `art/handheld-tool-pass`, based on checked tractor `b1ed035`, wildlife `20e9f1b` and player-performance
`8552d44`. Final pre-visual runtime/export is `2060cec`. This is a builder's quality check and
development candidate, not independent visual acceptance or public deployment.

## Measured exports

| Asset | Triangles | GLB bytes | Draw primitives |
| --- | ---: | ---: | ---: |
| Laser rifle | 9,611 | 924,552 | 3 |
| Sidearm | 2,404 | 322,964 | 3 |
| Mining cutter | 7,868 | 779,472 | 4 |
| Cargo tractor | 5,164 | 553,260 | 3 |

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

- First browser fixture's launch command used the config directory; explicit root
  CWD corrected this before Chromium started. The first renderer check then found
  only two maps: substring detection matched `orm` inside `normal`. Packing now
  derives channel identity from actual glTF material slots; exact source WebP bytes
  are asserted for each slot. Original failed result is retained in browser-02.log.
- Geometry audit removed43 microscopic/zero-area rifle triangles and48 cutter
  triangles at <=1e-10 square metres, and repaired one rifle triangle winding.
  This cleans boolean tessellation; it is not silhouette decimation. Others had
  none. Current counts above include cleanup, recorded in the measured manifest.
- Reconciliation with the live player-performance source initially truncated two
  merge tails and failed module parsing. Restored complete files from the three-way
  source; kept cached aim vectors with the tractor's tool offset, and retained the
  cargo-held fire guard with optimized player iteration. Final combined887units
  pass in40.0s. No shared application served either failed candidate.
- Multiplayer combined run:121passed, two existing opt-in SQL cases skipped; its
  automatic cargo SQL setup failed in `/tmp` with PostgreSQL disk/quota53100.
  Writable task TMPDIR exposed missing generated Prisma files in this new checkout.
  Generated the declared local client, then all8cargo server/actual SQL tests passed
  in2.8s, including detached-crate reopen. Stopped only owned failed fixtures;
  shared5178/API8087 and the existing account database were untouched. Missing
  generated client failures and an initially wrong script name remain in logs.

Remaining browser checks and image inspection use a single coordinated GPU window.
