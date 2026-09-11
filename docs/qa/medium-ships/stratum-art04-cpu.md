# Stratum Art04 builder closure — CPU only

Art04b is frozen for independent native review. This report does not award an art score or claim a browser/gameplay pass. The actual Art03 failed review remains `/tmp/star-agent-stratum-art03-independent-review.md`, SHA `558d1a40e1d6d74bbd37b61bab869a3eafc0af264c34177b1e2896dfd0252fcd`: mean3.9667, silhouette4.2. The next candidate still requires silhouette4.5 and QUALITY mean≥4.0 with no item<3.

## Exact candidate and scope

- Base asset: `22bbf0296e349e24f1a9bd636745511bf31b9291f1a305814f13d4a45cac4d08`, feature `97ebd8c` (root import `f1f1a8d`).
- Final GLB: `1f5cae2a4901a2618d7cff36f1713a19777b45d586022614b9bc5449560cb75b`, **3,867,188 bytes /59,224 triangles /69 primitives /114 nodes**.
- Builder: `0cf16d4167d5d4f753b08e3e4e7bc6c2071773548773b79c5ab3971cc65bafdb`.
- Packer: `4dac76cc4c265ef4e8ed20c4b334492755f778dbaecd4ed649eb5a0e32209513`.
- Editable blend: `eacabaf625e5a614d55841b0ab2597f068634782fa05c0fdfd7fd4e108ef2b31`.

The primary pressure shoulders, roof process housing and drive load arches have been reshaped. Deep tapered moving load casings and diagonal root webs replace the slender parallel rods and repeated saddle blocks. Secondary joints are narrower and less dark than the major structural gaps. Cabin lids/end faces and ceiling/wall contact grids keep the occupied and freight volumes unchanged. The original deterministic1024² finish textures are byte-identical to Art03; material factors and local geometric contact sampling changed, so there is no compensating atlas recolor.

The layout, loader, systems, flight API, shared runtime, studio, native fixtures and geometry primitive helper remain unchanged. The10-path delivery allowlist includes only the builder/packer, derived assets/measurements, provenance and asset README. The staging test file is the root integration's existing11-test version (permanent clear-centre regression included), copied for verification only and excluded from delivery.

## Checks actually completed

- Host CPU Blender export: exit0, `STRATUM_BUILD_DONE`, normal Blender quit. Root executed the exact frozen four-input command after the sandbox invocation's rejected04a shutdown hung. `build-inputs-04b.json` and `build-04b.log` retain that host receipt. No renderer or GPU was launched by this lane.
- Existing actual-GLB tests: **11/11 pass**, Node26.7.0,1.700s. Includes measured budget,13gear/169boom envelope samples,14 separate flight solids, all occupied/freight clearances, gear-to-fixed-body clearance, continuous deployed ramp/nested storage, rebasing at25billion metres, permanent forward sightline, all four actual MFD faces, mechanism interlocks and partial/disposed-load readiness.
- `final-geometry.json`: all four gear assemblies, complete ramp assembly, all four MFD faces and all glass triangle sets match Art03 at1µm hash resolution; all21 actual named reference TRS arrays are exact. Twenty central pilot-to-glass rays are clear. The actual49-pose-per-boom triangle SAT check reports no contact beyond its declared bearing interface.
- `final-optical-geometry.json`: each entire authored optical isolator64tri, hood96tri, focus lip224tri, throat168tri and physical emitter92tri matches its original triangle set on both booms. Analytic source ring vertices select complete nonempty actual triangle sets;2µm selection tolerance and1µm geometry hashes are explicit. This is stronger than matching just the muzzle transform.
- `final-optical-path.json`:18 two-sided opaque rays, starting1mm forward of the physical emitter and crossing the full working throat/lip, have no obstruction.
- `final-continuous-boom-clearance.json`: full yaw±0.20rad and pitch−0.12..+0.14rad against actual opaque fixed triangles,3,304 moving triangles,13,998 angular cells and576,467 triangle-pair checks. Every accepted cell has a separating-axis gap greater than its conservative rotational displacement bound `R*(yawHalf+pitchHalf)+1µm`; ambiguous cells subdivide. Maximum depth8, no unresolved cells. Only triangle pairs wholly within the actual0.74m bearing sphere are declared mating geometry.
- `final-moving-pair-clearance.json`: both booms against all four independently moving gears and against each other,58,927 initial candidate pairs/277,221 angular cells, maximum depth7, no unresolved contacts. The same conservative rotational bounds cover both moving triangles. No bearing exception is used between separate mechanisms.
- `final-packing.json`: actual GLTFLoader comparison of unencoded export to final asset checks every ordered triangle corner, winding, UV and contact color; maximum position error0.20555mm, normal0.37273°, color0.001862 (<1/255). Neutral-color omission requires every original component including alpha to equal exactly1. The compactor indexes only byte-identical complete encoded static attribute tuples;54 protected moving/glass/display meshes are excluded.
- `packing-preflight-04b-corners.json` separately compares rejected04a against its compaction-only preflight: **zero** decoded position/normal/UV/color change at every ordered corner. This preflight excludes the subsequent22cm tail shortening and is not presented as the final asset identity.
- `final-material.json`: actual embedded lossless WebP bytes resolve through exported textureInfo/UV0 and match source hashes/recipes. Basecolor is grayscale reflectance grain, ORM is R=1/G=roughness/B=material-scaled metalness, and normal channels are independently bounded. No semantic atlas row exists to invert.1024² bounds pass.
- `final-ceiling-diagnosis.json`: decoded visible acoustic face triangles are locally sampled rather than spanning metres. The report also deliberately retains hidden backing and unrelated sloped wall triangles, so its largest-area aggregate is not claimed to describe visible liner faces alone. Broad ceiling face normals are0° from their geometric normals. This isolates a coarse vertex-contact interpolation contribution; it does not claim to prove that every prior dark trace was caused by AO or that the native image defect has closed.
- Builder fitted-skin visibility:118panels/944samples,918externally visible samples, **zero own-backing burial**. Samples hidden by other real fittings remain recorded; the count is not a screen-space visibility/art score.

## Retained failures and byte accounting

Art04a `fdff87fdb7e8ddfd6b26be41e3654790529ef6913b508b6a641001dcac05f119` was rejected at4,104,316B/59,224tri. Its11-test run reports10pass/1budget failure, with source/blend/GLB and the exact unpacked export preserved under `rejected-04a/`. The export completed before the deliberate byte assertion; sandbox Blender then hung during shutdown and was stopped through its owned session (exit130). The inherited startup add-on warning did not prevent geometry export. No approval retry or application/GPU process was used.

The byte correction merges9,909 identical encoded static tuples. The GLB still contains the same triangle count and unchanged texture pixels. `manifest.packing.outputBytes` is4,218,312: geometry-packed intermediate with embedded source PNGs. Final WebP substitution and JSON container serialization yield the authoritative top-level3,867,188B. The two sizes measure different explicit stages.

The optical path probe also reproduced an **inherited** defect in the actual Art03 GLB: its former solid spine capped the bore19.0004mm forward of the emitter ray start. Art04a retained that old end position. Both negative receipts remain (`art03-optical-path.json`, `rejected-04a/optical-path.json`). Final04b ends the solid load casing19cm behind the retained emitter, closing all18 rays while preserving the surrounding original optical triangle sets. No beam/gameplay origin or aim range changed.

## Next gate

Root must build/serve the frozen candidate and capture the unchanged studio/native cameras and full motions. An independent reviewer owns the silhouette, fitted-surface, cabin-light/contact and overall visual disposition. No native screenshot, performance, gameplay or final art pass is claimed here. The earlier visual failures remain retained.

Root metadata correction: the frozen packet/report called `f1f1a8d` the feature base; that is the integration import. The actual source feature head is `97ebd8c`. All10 base files matched both worktrees exactly before import. Final feature commit is `cec332a`, integrated as `1c07b8f`. The original frozen report and packet remain unchanged.
