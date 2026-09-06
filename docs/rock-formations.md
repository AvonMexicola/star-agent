# Seeded rock formations

The missing middle scale between surface grains and mountains now comes from
`src/rock-formations.js`: metre-scale boulders and larger, fractured bedrock
outcrops. A 23 m cell field supplies small rocks; a 115 m field supplies outcrops
with independently rotated shoulders, worn caps, varied outlines and occasional
fractures. Regional density varies, leaving open terrain between groups.

The layer is evaluated inside the canonical surface samplers, so terrain workers,
collision, surface normals, resource rendering and plant placement use the same
height. No camera-driven random placement or extra collision floor is involved.
The field uses body-local doubles and three-dimensional cells, including all
neighbours that can overlap the sample. It has no cube-face or longitude seam.
Existing patch-local Float32 buffers, parent fallback, skirts and morphing remain
in charge of rendering.

- Aeon uses the selected planet seed. Outcrops fade away at beaches and polar ice;
  its slope materials expose rock on steep faces.
- Selene uses its existing independent body seed and darker exposed rock.
- Pyre uses its body frame and independent seed. Strongly active lava suppresses
  the new formations, and solid outcrops retain the local mineral palette.
- Miasma uses its independent seed and mineral palette; flora still follows the
  final surface and rejects steep ground.

Generator versions advance because surface heights and safe destination choices
can change. The existing forest-to-coast flight test now budgets for the actual
route length, since the safest forest destination can move.

These are solid **heightfield** formations: no caves, overhangs, movable rocks,
mining or new destruction system. Maximum added relief is below 50 m. They refine
with the existing terrain LOD; this does not replace the separate large-scale
Selene geology and surface-stone branches. No assets or dependencies were added.

Validation commands:

```sh
npm test
npm run test:browser -- -c scripts/rock-formations.config.js
```

The unit suite includes seed reconstruction/variation, open ground, continuity at
cell boundaries and poles, and a swept collision crossing with both endpoints
clear of an outcrop. Existing tests check terrain/worker agreement and flight.
The Chromium test builds production and captures Miasma at 350 m and 4 m, plus
Selene, Pyre and Aeon at 4 m, checking browser errors. Evidence and environment
metadata are saved to `/tmp/star-agent-rocks`.

Verified on Chromium 151.0.7922.173, ANGLE Vulkan SwiftShader, 1280×800.
All 20 unit-test files pass. The final browser run passed in 4.9 minutes with no
console errors. Captures use render scale 1; this is not a hardware FPS benchmark.

![Miasma descent](images/rock-formations/miasma-350m.png)
![Miasma outcrops and flora](images/rock-formations/miasma-4m.png)
![Selene boulders](images/rock-formations/selene-4m.png)
![Pyre outcrops](images/rock-formations/pyre-4m.png)
![Aeon forest outcrop](images/rock-formations/aeon-4m.png)
