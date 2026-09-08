# Stratum art revision 02 — CPU checkpoint

This asset revision replaces the broad single-piece extraction shoulders with
stepped nacelles, separate upper armor around open thermal channels, and actual
load-bearing boom shoes. The cutter guards, focus lips and deep working throats
have separate geometry/material assignments. Cabin fittings gain lids, gaskets,
plinth panels and a fitted ceiling above the existing standing clearance.

The previous native candidate remains a failed review: static mean3.26,
silhouette3.4, materials2.6. Its original captures and failure report are retained.
This new revision has **no native or game visual acceptance yet**. The required
silhouette4.5 and applicable mean4.0/minimum3 remain independent review gates.

## Identity and bounds

- Source base: `e6c69cac513746eff815b99aad335642421e5adc`.
- Runtime GLB: `b2660a8e400c7ae64ed75cf3e4166d66f1953f0fb6dcbcce5357b1edaa37eb3e`.
- 41,048 triangles;3,407,756 bytes;66 mesh primitives; three embedded1024² lossless WebP maps. The60k/4MB budget is unchanged.
- Layout remains byte-identical (`a17f9159a02de736fc1463da132a4a709d95135ca5fcb93647e762d6abe5ff44`). Updated14 flight parts describe the changed static shapes inside the same allocated envelope. Only individual gear volumes reach the floor.
- The centre glazing, all four displays, complete ramp, four legs and21 named functional transforms remain intact. No opaque central brace is introduced.

## Production and validation

The builder remains deterministic, original Blender source. Manufactured finish
maps use seed505; this is repeating grayscale microfinish with explicit material
factors, not a semantic color atlas. Decoded final UV/WebP samples validate the
basecolor/normal/ORM routing. Short-range contact visibility is baked using
148,944 deterministic CPU BVH rays into vertex colors; no lamps or environment
are baked, and dynamic parts have no pose-dependent shadow.

The scoped packer reuses the existing rigid packing approach for static opaque
batches. All positions in moving mechanisms, glazing and MFD meshes stay float.
Actual GLTFLoader comparison verifies unchanged indices and177,770 UV scalars,
97 preserved named transforms, maximum static position error0.208mm and normal
error0.367degrees. Full decoded geometry, rather than Blender source bounds alone,
is used for the clearance checks.

- Existing10 actual-GLB tests pass. The unedited current root-owned suite,
  including the permanent clear-centre test, passes11/11.
-20 additional central sightline rays reach retained glass before opaque geometry.
-49 yaw/pitch poses per boom check37,415 candidate moving/fixed triangle pairs;
  no intersections were found. This is a sampled CPU clearance check, not a
  rendered motion or continuous-sweep claim.
- The independent cabin-light probe passes on this exact hash: all3 emitter
  paths and8 cabin targets, transform/visibility/power/disposal checks.
- Production studio build passes in914ms (Vite7.3.6); its615.55kB JS chunk warning
  remains recorded. A first cache write through the read-only dependency symlink
  was an environment failure; the same config built with a local cache override.

The first revision export failed the byte gate at5,403,820 bytes/53,168 triangles.
That receipt remains retained. New small fittings were reduced to a single real
chamfer, unused secondary UVs were pruned only after proving no texture uses them,
and the existing bounded packing approach brought the asset within budget.

CPU records, failed logs, unencoded source and reproducible probes are retained
under `/tmp/star-agent-stratum-art-qa` for root's integration handoff. Actual
native desktop/phone imagery, full game routes and independent art scores remain
root-coordinated follow-up evidence. No browser, GPU job, service reload or user
preview was launched or modified by this authoring pass.
