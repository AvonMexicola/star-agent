# Outdoor floodlights — asset and gameplay record

Builder: Codex, SA-LIGHT-001, branch `feat/outdoor-floodlights`.
Brief: [outdoor floodlights](../../briefs/outdoor-floodlights.md).
Initial runtime candidate: `85208b7`, on checked foundation/combat/settlement
union `8b5ecd4`. This is builder evidence; independent acceptance and physical
controller testing have not been performed. Local integration and public release
are separate from these checks.

## Source and contract

Original deterministic Blender authorship. No external imagery, generated image
service, third-party model, texture or dependency. Editable component source:
`assets/build-floodlight/floodlight.blend`. Rebuild with Blender 5.2.0 LTS:

```
ALSOFT_DRIVERS=null blender --background --factory-startup --python-exit-code 1 --python blender/build_floodlight.py
```

The ordinary `blender/build_base.py` rebuild also invokes the dedicated builder.
Both routes preserve the complete base manifest. Runtime import uses the existing
`createBuildVisual` GLTF loader, cloned materials and cached geometry.

Metres, Y up, mounting surface at Y0; beam faces local −Z. The service box faces
+Z and is reached at Y1.2. Named source/export anchors are `LightEmitter`,
`LightTarget` and `SwitchTarget`. Every exported vertex is checked against the
mast, shoe, control-box and head colliders. Landing checks cover Nomad, Atlas,
Gannet and Stratum at all four canonical settlement sites.

Measured GLB: **9,826 triangles, five meshes/material draws, 837,064 bytes**.
SHA-256: `3f2d93fc8eb0f236e2cc590cf327cda09e84711a13aceba73fb62560a797240b`.
Bounds: X ±1.3375 m, Y0–5.84492 m, Z−0.607883–0.58 m.
Five PBR materials: WhiteArmour, EdgeSteel, DarkPolymer, MintStatus and
WarmTaskLight. Metre-projected UVs and per-corner surface variation; zero textures.
The export is below the existing per-piece 10k-triangle/1 MB limits. No separate
LOD was added; the existing construction coverage fade remains at 500–600 m.

## Runtime behavior and bounded cost

Power wheel entry, normal placement/material ledger, reachable switch and saved
`lightOn` flag. Ceiling lights remain in the Roofs wheel. A powered mast consumes
600 W; switching off removes its operating demand and useful emitted light.
The usual 10 W per-piece/base upkeep remains. Base supply loss also removes
illumination without changing the saved switch setting.

All construction renderers share one scene pool of **six spotlights and at most
two 512² shadow maps**. Each light has a 75 m range, 180–260 m camera-distance
fade and downward target. World positions and targets remain doubles until
the floating camera origin is subtracted. No new custom shader, global ambient,
sun, exposure or volumetric effect. Distant planets cannot consume the six slots.

The four commissioned settlements each have six inward-facing perimeter masts,
supported by the existing large pad. No player material/save grants are used.
These world fixtures follow the existing settlement availability and authority.

## Checks and corrections

- Seven individual new tests pass: measured export/anchors/collision, independent
  material switching, Pyre-scale coordinate precision, shared caps/disposal,
  distance fade, actual energy and save semantics, all-site support/landing.
- `npm test`: 150 test files pass, no failures or skips.
- Four focused existing geometry/roof-light/build-state/settlement files pass.
- `npm run check:repo` passes; required plan against `origin/dev/all-features`
  reports the broader unpushed development stack. It is guidance, not validation.
- Production build passes in 22.05 s with the inherited chunk-size warning.
- First Blender export failed because joining one material batch invalidated
  object references used by later batches. Compute all groups before joining;
  subsequent exports pass and retain the same runtime GLB hash. The failed
  process hung during audio shutdown and was explicitly stopped. `ALSOFT_DRIVERS=null`
  permits clean headless authoring shutdown without changing system settings.
- Blender reported unavailable optional `cattrs`/MeshOptimizer and thumbnail-cache
  warnings. The uncompressed GLB/native save and measured exports succeeded.
- First production build failed with read-only shared Vite cache (`EROFS`).
  The same build passed through the approved scoped escalation.

Browser/controller images and exact results are added after the actual journeys.

## Integration contract

No database/schema or protocol-version change. Client and API both import the
piece catalog and power model; reload them together before account-backed solo
saves contain the new type. Older clients reject unknown pieces through the
existing save guards. Public deployment is not part of this task.
