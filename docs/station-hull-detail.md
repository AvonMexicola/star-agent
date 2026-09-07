# Station hull detail recovery

This branch preserves and completes Fable/Claude's interrupted procedural station
detail pass. It replaces the integration model's broad panels with finer seams,
recessed ceiling lights, access hatches, fasteners, pipe clamps, roof thrusters,
plate tones, mint trim and localized wear. Ambient occlusion is baked into vertex
colours; the models require no downloaded textures or hosted generation service.

The recovery fixes the material-split export hierarchy. `Hull` now contains all
its material sections instead of naming only a detached trim mesh. The same rule
applies to other split static batches. The two animated doors retain their names
and original animation. `LandingDeck` remains a single mesh with its original
bounds and anchors. Floor tests cover both a plate and the 3 cm recessed seam,
including separation from the structural hull beneath the 40 cm deck slab.

## Rebuild and review

```sh
blender -b --python blender/build_station.py -- --out public/models/station.glb
blender -b --python blender/build_station.py -- --out public/models/station_lod1.glb --lod
npm test
npm run build
npm run test:browser -- -c scripts/hull.config.js
node scripts/hull-review.mjs http://127.0.0.1:5185 /tmp/star-agent-hull-review
node scripts/hull-review.mjs http://127.0.0.1:5185 /tmp/star-agent-hull-tour --tour
```

The review script captures the production renderer, records console messages,
GPU/backend, resolution, render scale, draw calls, triangles and software RAF
cadence. An optional fourth argument supplies a directory containing baseline
station GLBs; Playwright intercepts only those two model requests for comparable
before/after views. `--tour` captures the six world viewpoints. Its cockpit is a
staged camera fixture; the separate browser tests verify physical boarding.

The detailed export uses Blender 5.2, a seeded procedural builder and a 24-sample
Cycles CPU AO bake. Static batches are split by material to preserve exported
`COLOR_0`; GLTFLoader's `vertexColors` must remain enabled. Secondary door
materials do not receive AO in this exporter workaround. The detailed model has
colours on 91/105 primitives; the remaining 14 are intentional lights, signs,
markings and solar surfaces. LOD1 intentionally omits the AO bake and fine detail.

## Asset and integration cost

| Asset | Before → after bytes | Before → after triangles | Before → after material primitives |
|---|---:|---:|---:|
| Hero | 1,573,844 → 2,990,144 | 54,096 → 70,540 | 74 → 105 |
| LOD1 | 269,272 → 272,648 | 7,748 → 7,784 | 48 → 53 |

The complete bounds remain 149.9 × 47 × 89.6 metres. The deck is
`[-21,-8.4,-22]` to `[21,-8,26]` in station-local coordinates; pad `[0,-8,2]`,
approach `[0,-4.8,-112]`, trigger `[0,-4.8,-272]`. Door tracks and sampled walking
and ship-entry sweeps match the integration model.

Hero collision triangle bounds increase from 31,272 to approximately 50,568,
mostly from recessed geometry. This remains a startup/memory cost to review when
instancing twenty pods. Share immutable local collision data where possible.
The current collider also includes 544 exterior wear triangles; this branch
does not change collision filtering or navigation.

The parallel hangar PR20 owns materials, props, printed graphics and local lights.
This branch changes none of its runtime modules or source assets. Its decorators
must traverse the new named groups, preserve vertex colours and avoid replacing
the full current opening/navigation integration. Review combined exposure and
instancing costs before adopting the branches together.

See [renderer evidence and review status](qa/station-hull/README.md). This is a
hull detail slice; it does not claim completion of the station interior or the
project's target graphics fidelity.
