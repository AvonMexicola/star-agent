# Pyre twilight and Miasma

Pyre now occupies an authored quadrature position: the straight line from Aeon is tangent to its 10 million km stellar orbit. The camera uses orbital north for arrival roll, giving **light left, night right**. Both quick transit and the drive stop 1,800 km above Pyre's reference surface (quick transit adds the local terrain height). Arrivals from other parts of the system still use the safe near side of the destination, so their phase can differ. Regular travel remains continuous and rejects paths through planetary exclusion zones.

The scene freezes this orbital layout for each session. The epoch is the reference of the orbital helper, rather than a changing initial orbital phase. Pyre generator version 3 reflects its volcanoes and lava fields across body longitude to bring Cinder Throne, Nightfire Plain and Furnace Flows onto the Aeon-facing hemisphere. It retains the same canonical geology, resource sampling and terrain refinement.

**Miasma** is a 340 km radius satellite, placed 6,400 km from Pyre's centre on an inclined, frozen orbit. From the Pyre approach it hangs above the dark limb. Select it on the system map (**M**) or use **H → Quick transit → Miasma**. Arrival clearance is 650 km. Its gravity is 2.1 m/s² and its 32 km atmosphere has flight drag and yellow-green aerosol scattering.

Four named mineral basins cut through sulphur uplands: Vitriol Basin, The Pale Eye, Verdigris Sea and Brimstone Crown. Dark copper-rich deposits, pale rims, ridges, fractures, walking-scale grit and small mineral fragments give the moon a different surface from Pyre. The "seas" are solid mineral deposits. Their surface heights and sulphur/silicate/copper weights drive rendering, collision, landing, walking and the mineral survey.

Animated aerosol bands occupy a cloud shell 8.5 km above the reference sphere. The atmosphere composites from far to near so both worlds can appear in the same view. Rendering retains logarithmic depth; terrain and fragment positions subtract camera/patch origins in CPU doubles before Float32 storage. Workers use the shared Pyre quadtree, canonical surface-map baker and swept terrain contact, with parent fallback, skirts and geometry morphs intact. Fragment scatter is adapted from the earlier Selene surface-stones work and keeps a clear area around a landed ship.

Toxic air is identified in the HUD, cockpit and map. Exploration assumes the existing sealed suit: this change does not add suit failures, oxygen consumption or acid damage. Small decorative fragments have no separate collision; the canonical terrain owns the walkable floor. Cloud motion and moon placement are authored visual effects, not atmospheric chemistry or an N-body simulation. No downloads, hosted APIs, dependencies or paid assets were added.

## Verification

- `npm test`: existing world, navigation, Pyre and star checks plus Miasma geography, resource consistency, local vertex precision, swept contact, travel separation and arrival orientation.
- `npm run test:browser -- -c scripts/miasma.config.js`: actual Chromium rendering from orbit through 5 km, 100 m and 8 m; mineral/toxicity HUD; map selection; continuous Aeon → Pyre → Miasma drive; physical landing, hatch exit, reboarding and launch; Aeon, Selene, Pyre and star visual regression checks.
- Artifacts and state reports: `/tmp/star-agent-miasma`. Chromium 151.0.7922.173 / ANGLE Vulkan SwiftShader; full browser/GPU details are recorded in `environment.json`. Screenshots use a 1280×800 viewport at render scale 1; streaming/movement checks use 0.4–0.5. SwiftShader is a rendering correctness check, not a hardware FPS benchmark.

![Pyre twilight arrival and Miasma](images/miasma/pyre-twilight.png)
![Miasma from orbit](images/miasma/miasma-orbit.png)
![Mineral fragments and fractured basin floor](images/miasma/miasma-ground.png)
![System map](images/miasma/map.png)
