# Field cutter production record

2026-09-08. Author implementation in progress; local integration, final browser
journey and independent acceptance are pending. See the [brief](../../briefs/field-cutter.md).

Current exported Mk1: `dc078fe73e0d46d32bbdf8a63db82f41231454178297ae6104d62db0cbece967`,
9,444 triangles, 915,800 bytes, five draw primitives, three 1024² WebP maps.
Normal and ORM reuse the existing handheld textures; the yellow basecolor has a
distinct cache identity. Named body/head assemblies and common mount survive
material batching. Editable Blender source and original user reference are kept.

Author01 exceeded the 10k geometry limit (12,196 source triangles); author02 was
also rejected by the binary packer (10,308 triangles / 992,904 bytes). Author03
reduced ring/bearing and bevel tessellation, preserving the three-pod silhouette.
The packer removed 192 zero-area export triangles and repaired no winding.
Blender exited 0; optional local extension `cattrs` and MeshOptimizer availability
warnings were retained, plus the inherited multi-image sampler warning. No
extension-dependent export or compression was used.

Four affected unit files pass in `assets/field-cutter/.staging/unit02.log`:
actual exported PBR/UV/normal/AO/budgets; 24 rotor phases, nine clear aperture
rays per phase, body/shaft radial and axial clearance; per-player clone isolation;
acceleration/coasting; actual equipment heat gate and holster. The first test
attempt began before packing completed, and an equipment assertion sampled its
world origin before the first update. The sequenced rerun samples after normal
initialization; runtime coordinates were not changed to satisfy it.

The supplied medical GLBs are preserved separately under `assets/medical-items`.
They are not evidence of implemented medical-use animations.

Combined checkpoint `534907b` retains the checked projected terminals and builder
phone refinement. All 156 normal test files pass with two CPU workers (68.46 s),
and the production/native-viewer build passes (76 s under shared memory load).
Repository checks pass; the suggested plan is retained in ignored
`.staging/check-plan02.log`. Shared helper claims transferred from SA-TOOL-001
to SA-TOOL-002 within the same parent; the builder retains its dedicated modules.
One serialized combined browser job covers both tools without parallel GPU jobs.
