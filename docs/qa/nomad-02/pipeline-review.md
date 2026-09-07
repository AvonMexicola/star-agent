# Nomad painting and packing pipeline — independent CPU audit

Reviewer: `/root/nomad_cutter/nomad_reviewer`. Production source and assets were read-only. Implementation fixes belong to `/root/nomad_cutter`.

**The frozen painting layout is reproducible on Blender 5.2.0 LTS, and the material attachment operation preserves the complete authored mesh/rig state tested.** The seven pipeline findings below have been addressed and rechecked within the stated CPU scope. No unresolved pipeline blocker was found in the final source read. This is a pipeline review, not generated-material or final visual acceptance.

The reviewed worktree is `/tmp/star-agent-nomad`, branch `feat/nomad-utility`, with base HEAD `6f80fc09a5bba7206c2d7251ee07f52c68ac1208` plus the owner's uncommitted implementation. Source changed during the audit to fix findings; evidence identifies each version. No network, service job, download, bake, runtime export, or production asset write was attempted by this reviewer.

## Candidate identity and evidence

| Item | SHA-256 |
|---|---|
| Frozen editable source | `a7c374cbae510d32e475162617b570616105163aa2536e4686d9743ec9ae84aa` |
| Runtime GLB | `33a64aba2093e40768862fb130e81382b1900c11a8913080202efe9d89f204da` |
| Original painting upload | `ed5ae93d9f609d78815ef875176416fe7217a560cc1cc100c2c45648de716a7b` |
| Clean painting upload | `5ed4a120a5b664b14084ae2f96237106abf6587b3544144eb90b5f85aa8ffaa4` |
| Painting UV buffer | `d30e0ab0cd135a93fbc51b92787c6c13cd922fd842f9ff236ccef9c15097689a` |
| Blender hull geometry/UV signature | `a36431b0fcc9e1bf8bfb0c045a25447691a39c63920fbe1d58254bf7708e8e89` |

The `.blend`, GLB and layout manifest remained unchanged through the probes. Final corrected source hashes (local archive: `final-fix-hashes.json`) identify the concluding source read. Earlier source hashes (local archive: `final-read-hashes.json`) and the `source-snapshot`, `source-snapshot-v2`, `source-final-read`, and `source-final-fixes` directories preserve the successive inspected versions. Evidence is local under this audit directory; none of these generated reports is a proposed repository artifact.

- Original CPU probes (local archive: `cpu-probes.json`): current file-chain consistency, deterministic cleaning, historical validator failures, and GLB packing preservation.
- Revised contract probes (local archive: `contract-recheck.json`): the same positive and negative geometry/chain fixtures against the corrected validator.
- Frozen Blender state (local archive: `frozen-v2-layout.json`), fresh corrected build (local archive: `fresh-03-v2-layout.json`), and corrected rebuild from a loaded file (local archive: `loaded-rerun-v2-layout.json`).
- Material attachment regression (local archive: `material-attach.json`): full geometry, UV, normal and rig comparison before and after two applications.
- Final validation (local archive: `final-validation.json`): 17 passing contract tests, exact prompt/upload metadata checks and source syntax checks. [The provisional report](review-provisional.md) preserves the earlier open findings.

## Findings and their disposition

1. **Fixed and rechecked — stale cleaned upload could borrow a new manifest UV identity.** The original importer validated geometry against `nomad-meshy-clean.glb` but copied `uvLayoutSha256` from an unrelated current manifest; the packer compared only that copied field. The historical AST probe validated upload A, supplied a different UV identity B, and the pack guard accepted the incorrectly stamped result. `clean_meshy_upload.verify_chain()` now validates the original upload SHA, derives the actual UV-buffer SHA, deterministically recomputes the clean copy, and compares its complete SHA. Importer and packer use the shared chain. Raw source-map and derivative hashes are now checked before packing. My current-chain positive case passes, and stale upload/UV manifest cases reject.

2. **Fixed and rechecked — one-way vertex matching accepted incomplete painting meshes.** The original validation prefix accepted a three-vertex, one-triangle subset of the 67,855-vertex shell with zero UV error. Keeping every vertex while supplying only one face also passed. `nomad_texture_contract.verify_mesh()` now compares both used position/UV corner coverage and unique triangle-corner coverage, allowing harmless vertex/index/winding changes and duplicate faces. Both historical failing fixtures now reject. A Float32-normalized roundtrip of the actual full shell passes: 36,095 unique triangles, zero UV error, maximum restored position error approximately `1.45e-7 m`. The tolerance intentionally merges nearly coincident corners within the documented `1e-5 m` / `2e-6 UV` matching rule; this is a bounded geometric comparison, not byte identity.

3. **Fixed and rechecked — rebuilding from an existing `.blend` retained obsolete datablocks.** The original builder deleted scene objects but retained orphan materials/images. The isolated loaded-file test produced `Nomad / hull manufactured PBR.001` and `.001` bake images; exact-name material lookup then selected the old unused material and found zero hull meshes. The builder now uses `read_factory_settings(use_empty=True)`. Both a new process and a process initially loaded from the frozen `.blend` reproduce the exact frozen hull signature and object hierarchy/transform/custom-property digest, without duplicate material/image aliases.

4. **Fixed and rechecked — geometry UV0 validation did not establish material mapping.** The original importer ignored `texCoord`, `KHR_texture_transform`, and texture indirection. Raw images addressing UV1 or transformed UV0 could therefore be attached to the authored UV0 atlas. The new `verify_material()` runs before image writes and requires opaque, embedded PNG/JPEG maps using untransformed UV0; unsupported indirection rejects. Source PBR factors and normal scale are recorded with an explicit statement that the authored composition recipe replaces them. The latest 13 Python contract tests pass, including UV1, transform, external-image and indirection rejection.

5. **Fixed and rechecked — upload preparation could discard the Blender baseline.** The earlier preparation script wrote a fresh manifest without `blenderHullLayoutSha256`, and pack preparation silently initialized a missing signature from the currently loaded scene. A sound upload/clean chain A could therefore be paired with a newly blessed Blender layout B. The final `nomad_texture_layout.py` centralizes the same hull signature; upload preparation captures it before creating the disposable copy and records it in the manifest. Pack preparation now requires an existing matching signature and never writes one. The added regression rejects both a missing signature and a different current scene. The existing frozen manifest's value remains unchanged.

6. **Fixed and rechecked — budget failures previously occurred after public outputs were replaced.** Both commands now use `pack_nomad.publish()`, which stages the GLB, quantizes it, checks the byte cap, saves a staged source copy, and writes a staged manifest before replacing final files. Regression tests confirm that an over-budget candidate and a failing source save retain the prior source/runtime/manifest; the success case publishes matching runtime bytes and manifest. These tests use copied assets and callback fixtures, not a new Blender export. Replacement of several files is explicitly not a filesystem transaction; an I/O failure during final replacement can still split the bundle. The helper does not itself enforce the complete 60,000-triangle assembly cap, so the separate assembly test remains required.

7. **Provenance bookkeeping corrected; actual source attribution remains pending.** The importer now verifies `meshy-job.json` against the exact current prompt and cleaned-upload hashes, copies `prompt.txt` and `job.json` next to `source.json`, and records their hashes with working relative names. The packer checks those copies and records the source-record hash. My CPU checks confirm the current prompt/upload hashes match the job record. The job record explicitly identifies its values as observed UI settings and leaves the unavailable provider job ID null. This reviewer has not independently verified that provider UI, and the real returned file is still absent. Once supplied, retain its exact source or archival location and verify its attribution; the code's metadata checks do not prove that a file came from a particular remote job.

## Reproducibility and preservation scope

The isolated Blender proof used copied source and a copied `.blend`. It executed the production geometry creation, modifier application, material/parent batching, and smart-project UV operations. The bake operator was replaced with a no-op in the review copy, and the builder's save/export tail was not executed. This proves the relevant geometry/UV ordering, not reproducible rendered bake pixels or a completed fresh GLB export.

The original two fresh processes, followed by a corrected fresh process and corrected loaded-file rebuild, all matched the frozen hull signature. The latter detailed comparisons also show that **every textured hull and cabin mesh UV layer matches the frozen file**. The only varying UV data belongs to the two untextured `Position / ice` emissive batches. These unused primitive UVs prevent an all-UV/whole-file byte-determinism claim but do not affect the painting layout or baked cabin atlas. The source's sets primarily assign parents or perform membership tests; the evidence does not support claiming that those sets destabilize the painted UV ordering.

The material-only regression executes the real `attach()` twice for hull and cabin, using original procedural maps plus a neutral test normal. All 44 objects and 23 meshes retain identical topology, local vertices, every UV layer, corner normals, parent/local/world/pivot transforms, and object custom-property signatures (numeric values recorded to nine decimal places). Each material retains five owned nodes after either application. This supports the material-only separation: generated geometry never enters the authored rig. The packer's built-in signature still covers only the hull's active UV layer, world vertices and polygon indices; it is narrower than this independent check and should not be described as a complete rig invariant.

The host Blender installation logged a missing `cattrs` extension-registration error and audio connection/teardown errors. Probe artifacts were produced successfully, but the long-lived processes stalled during audio shutdown and were stopped after completion. The attachment-only probe exited successfully after flushing its report. These are CPU probe results, not clean full-build or browser-render claims.

## Packing, budget and material risks

The cleaner reproduced the exact current clean GLB from the original upload. It excluded 1,465 geometrically or UV-degenerate triangles (total geometric area approximately `0.00001147 m²`) and retained position, normal, UV and image bytes verbatim. The cleaned copy has 36,095 triangles; the source painting copy has 37,560. Only the temporary painting shell is affected.

Packing a copied float-attribute shell preserved position/index buffers, hierarchy, scenes, images, skins and animations. UV quantization error was `7.6293e-6`, approximately 0.00781 pixel at 1024 px. Repacking the actual runtime GLB was byte-identical. `pack_nomad.py` does explicitly set `installedWeapon = null` on named weapon sockets, so it is not a metadata-neutral general-purpose packer; that matches this ship's empty S1 contract.

| Runtime GLB measurement | Current value |
|---|---:|
| Encoded bytes | 3,413,568 |
| Remaining to 4,000,000 | 586,432 |
| Authored triangles | 57,628 |
| Mesh primitives | 23 |
| Embedded images | 4 |
| Existing image bytes combined | 521,918 |

The separate owner-run assembly evidence reports 59,224 triangles with all eight boxes, leaving 776 triangles to the ship cap; that complete-assembly figure is not a new renderer measurement from this CPU audit. Adding hull/cabin normals increases image count from four to six. Encoded WebP cost, material primitive count, tangent behavior, normal seams and data-map compression must be checked on the real final export. The current byte margin is not a guarantee that the generated finish will fit.

Colour composition explicitly decodes/encodes sRGB while ORM and normals are treated as linear data; material nodes assign the corresponding colour spaces. The recipe keeps authored colour ownership and bounded material response instead of copying broad generated lighting. Those are sensible implementation choices, but their visual effect, UV padding behavior, wear placement, normal convention and lossily encoded data maps need actual-source close and grazing-angle renders. No generated-source score or final rubric score is issued here.

## Related runtime intake review

The new `ship-walkable.js` prevalidation checks the chair, lid, console, cabin, all eight cargo roots, gear roots and hardpoints before adopting the model or hiding fallback parts. These conditions cover all explicit `cabin.adoptModel()` rejection conditions, preventing the identified parseable partial-GLB overlap. This is a source review of that follow-up; the owner owns its browser validation and the earlier independent controller evidence remains tied to its original frozen hashes.

**Disposition:** painting-layout reproducibility, tested material/rig preservation and the corrected intake/export guards pass within the stated CPU scope. No further pipeline source change is requested by this audit. The real source import, full final export, packed budget/render check and final art acceptance remain pending. No generated-source or final visual score is issued.

## Curated-copy provenance

This is the independently authored review copied for the PR; only local JSON
evidence links were converted to archive labels. The original report and probe
outputs remain at `/tmp/star-agent-nomad-review/pipeline-audit/`. The original
report SHA-256 is `934cf55a58bf998f4016961e6e7a0f0980180cd8b12195f52d1bbb005032439e`. Generated probe JSON and
temporary source snapshots are not committed. The owner implements the fixes;
the reviewer retains authorship of the findings and disposition.
