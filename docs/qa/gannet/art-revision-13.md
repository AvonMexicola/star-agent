# Gannet Art13 — continuous finish and connected forward shell

Art13 is a CPU-checked development candidate awaiting native capture and independent review. Art12's failed native assessment remains preserved: mean **3.97**, silhouette **4.4** against the required **4.5**. No visual acceptance or performance exception is claimed.

## Frozen identity and scope

The seven-file asset delta is based on Gannet `08e7fc3ceb3bf972b8a4a847a80b8aa25c7b286c`. Exact base/final hashes and the source archive are retained locally as `/tmp/star-agent-gannet-art13-delta.*`; this document is supplied separately. The author changed only the builder, texture provenance description and derived source/asset metadata. Gameplay, studio framing, global lights/exposure, main-game lamps, controls and the Burrow asset are unchanged.

- GLB: `8da0bc2e3da7c8c2a2db7b29957b226fab0ba30eb0155f98d82a3f82c3995e6f` — **3,169,484 bytes, 56,490 triangles, 33 primitives, 98 nodes**.
- Editable source: `474bc808ed71179df1acb704f64c3bf1f3c50e6c52c09d7629820f09a78e9d2f`.
- Canonical layout: `9334ef7470c6aa1c0d4da7a2ce91d42191fedfdde00bd8732f15675ad904adb5`.
- Images remain **three 1024² PBR WebP maps and one 512² emblem WebP**. All source-map and encoded image bytes are unchanged from Art12. Limits remain 60,000 triangles, 4,000,000 bytes and 1024 maximum texture edge.

## Measured floor and upholstery correction

Art12's new contact topology exposed a mapping defect. Each small polygon stretched almost the whole atlas swatch across its face, with only a four-pixel margin. At the actual studio cabin camera, minification reached neighboring colors and material channels. The exported floor stayed planar with upward normals; the bright grid was not a raised geometric lattice.

The new mapping projects in metres from each complete object's bounds, capped at 24 texels per metre and the central 128×256 pixels of its 256×512 swatch. Every cabin-floor face uses the same plane and scale. Small bevels and upholstery welts no longer expand a swatch across millimetres. Physical welts now sample the same nonmetallic textile family as the pads, preserving their geometry.

An actual-export comparison preserves all **3,872 floor triangles**, their positions/normals, **969 unique top positions** and all associated AO colors exactly. Shared-position UV discontinuities fall **965 → 0**. Exported floor vertices fall 7,744 → 2,222 through UV deduplication; no contact topology was removed. The existing short-range static geometry AO algorithm is unchanged, with moving mechanisms still white and excluded from its occluders.

The filtering probe uses actual GLB triangles, UV derivatives, the cabin camera and embedded WebP pixels. It predicts a linear-light box mip chain with bilinear/trilinear sampling at 196 visible floor and 58 pad/welt points:

| Measurement | Art12 | Art13 |
| --- | ---: | ---: |
| Floor samples with >10/255 channel contamination | 103 / 196 | 0 / 196 |
| Pad/welt samples with >10/255 contamination | 48 / 58 | 0 / 58 |
| Floor median predicted mip level | 6.57 | 0 |
| Pad/welt median predicted mip level | 9.39 | 0 |
| Pad/welt predicted metallic range | 0–0.234 | 0 |
| Pad/welt predicted roughness range | 0.720–0.960 | 0.956–0.963 |

This is an isotropic CPU filtering prediction, not a GPU render or a guarantee of native appearance. Driver mip generation, anisotropy, shader execution and the full range of viewing distances remain for native inspection. No exposure or lighting change conceals the defect.

## Primary form correction

The drive cowls retain their successful service waist and fore/aft transitions, but their horizontal caps narrow and the forward/aft crowns reduce where the load connections permit. The forward pressure cheeks rise from the lowered prow into the shoulder guards. Extended cockpit-to-shoulder fillets and a thinner leading roof lip connect the pressure shell into those forms. The existing fin rake, saddles, fitted fin faces and bay roof remain. Bow lettering follows the revised actual prow surface; no small-detail pass is added.

The first Art13 export exposed two real regressions and is preserved under `attempt-01/`: lowering the aft cowl opened **21–23 mm** gaps beneath two sampled fin-root columns, and moving the prow's rear mounting face by **20 mm** failed the display shelf/hull fit check. Restoring the fitted aft station heights and the protected mounting face closes both. No MFD, support-shelf, glass or fin-root geometry was moved to bypass these checks.

## Validation and limits

The final asset passes **12/12** existing physical cases, zero failures/skips, in **2.869 seconds**, using current clear Burrow `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`. The cases cover complete gear poses, both full 64 SBU banks, bay and player routes, actual steering/suspension/door sweeps through lift travel, pressure closure, hatch motion, clear central pilot glass, all four first-visible MFD faces and their physical supports. Minimum open hatch/cap clearance remains **25.82 mm**; backing/shelf overlap **11.74 mm**, fitted shelf/hull face gap **0.024 mm**.

Additional final-asset probes pass:

- **66** retained non-mesh transforms/parents, **five** bit-identical MFD/glass meshes and **11** unchanged moving envelopes.
- **103** decoded material/roughness samples, **96** expected outer-surface positions and **16** recessed nozzle first-hit rays with actual material sides.
- **12** finite actual-triangle load columns connect outer shell/fin/fillet faces into the supporting structure without an intervening air gap. This is sampled geometry, not structural stress analysis or exhaustive volume coverage.
- **20** PBR primitives retain vertex-color support; all **12** moving PBR primitives remain white. The exact floor/AO comparison above passes.
- **Six** actual fixture first hits/downward paths and **seven** occupied target paths remain valid. These verify source geometry and the unchanged studio fixture arrangement, not main-game illumination.

A repeated complete CPU Blender build reproduces the GLB, collision data and all source-map bytes exactly. Editable `.blend` serialization and its manifest source hash differ between saves; the frozen source hash above identifies the delivered save. Python syntax and scoped whitespace checks pass. The authoring mirror is not the integrated repository-check environment; root performs its repository/build checks after import.

The separate `/tmp/star-agent-gannet-payload-art12.*` CPU packet retains actual canonical 128 SBU accounting for two 64-SBU crates and 128 one-SBU crates, with current Burrow and the actual detailed/LOD batching path. It pins Art12 and must not be represented as an Art13 runtime measurement. It records the small-crate triangle cost and the cargo LOD support-contact gaps instead of asserting scene or FPS acceptance.

All probes, commands and failed source/asset receipts remain in `/tmp/star-agent-gannet-art13-evidence/`; generated reports are not committed. The author ran no GPU/browser job. Fresh native desktop/phone/motion review, main-game rendering and scene performance remain separate checks. Cees retains final product and release acceptance.
