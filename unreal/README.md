# Star Agent — Unreal Engine 5 port

> ⚠️ **Fab / Quixel / Epic sample content is Unreal-only and is not in git.**
> Read [THIRD-PARTY-ASSETS.md](THIRD-PARTY-ASSETS.md) first.

This directory is the Unreal project root (`StarAgent.uproject`, UE 5.8).
Design and rationale: [docs/design/unreal-planets.md](../docs/design/unreal-planets.md).

Status 2026-09-12: compiles clean and runs. First editor run confirmed Aeon
streaming from orbit to ground under SkyAtmosphere with vertex-coloured
terrain (M_AeonLand). Not yet done: water surface, LOD geomorph, sky light for
the night side, walking character, other bodies as actors. The engine-free world-generation code is compiled and
verified by `tools/crosscheck.sh`. Nothing here has been run in the editor.

## Layout

| Path | What it is | Verified |
| --- | --- | --- |
| `Source/StarAgent/WorldGen/JsMath.h` | ECMAScript numeric semantics (ToInt32, imul, Math.max/min, V8's Math.hypot, Three.js length) shared by every port | cross-check |
| `Source/StarAgent/WorldGen/AeonSurface.{h,cpp}` | `world.js` + `terrain-v2.js` + `rock-formations.js`: height, rock relief, moisture, biome, slope, colour | bit-identical outside outcrops, 1e-13 m inside |
| `Source/StarAgent/WorldGen/PatchBuilder.{h,cpp}` | `world.js` `generatePatch`: grid + skirt vertices, normals, colours, water, parent-morph buffers, indices | every float32 buffer identical on 90 patches |
| `Source/StarAgent/WorldGen/SeleneSurface.{h,cpp}` | `moon-world.js`: craters, provinces, resources, region, albedo | bit-identical where transcendental-free; 3.9e-9 m worst |
| `Source/StarAgent/WorldGen/JsLibm.{h,cpp}` | fdlibm `pow` and `exp` as V8 evaluates them, for generators that use `Math.exp` and `**` | cross-check |
| `Source/StarAgent/WorldGen/ResourceProfile.{h,cpp}` | `resource-profile.js` shared by Pyre and Miasma | cross-check |
| `Source/StarAgent/WorldGen/PyreSurface.{h,cpp}` | `pyre-world.js`: volcanoes, lava fields, craters, resources, regions, orbit frame by epoch | bit-identical away from features; 1.0e-7 m worst on volcano flanks |
| `Source/StarAgent/WorldGen/MiasmaSurface.{h,cpp}` | `miasma-world.js`: sites, basins, resources, position from Pyre's frame | bit-identical up to `pow` rounding; 4.5e-13 m worst |
| `Source/StarAgent/Planet/PlanetFrame.h` | Browser/glTF frame (m, Y up) to Unreal (cm, Z up): `(x, y, z) -> (x, z, y) * 100`, matching Interchange's glTF import | not compiled |
| `Source/StarAgent/Planet/PlanetPatchMesh.*` | `PatchBuffers` to `FDynamicMesh3`: land (UV0 height, UV1/2 direction, UV3..7 parent surface for the geomorph) and the sea-level water mesh | runs |
| `Source/StarAgent/Planet/PlanetAlbedo.*` | 2048x1024 lat/long bake of albedo + moisture and noise fields, built on worker threads at start | runs |
| `Source/StarAgent/Planet/PlanetVegetation.*` | Seeded per-cell tree and grass scatter on patches (level 12+ / 15+), placeholder tree and grass meshes built at start | not yet run |
| `Source/StarAgent/Planet/PlanetActor.*` | `planet.js` quadtree with the 0.6 s geomorph, worker-thread patch builds, per-patch land/water/tree/grass components, SkyAtmosphere, exposure and haze tuning (Look), orbital albedo bake | runs |
| `Source/StarAgent/Planet/PlanetGravityComponent.*` | Inverse-square radial gravity; Character Movement gravity direction, or force on physics bodies | not compiled |
| `Source/StarAgent/Planet/StarAgentSun.*` | Directional light as the atmosphere sun from `SUN_DIRECTION`, 1.10° disc | not compiled |
| `Source/StarAgent/Planet/StarAgentFlyPawn.*` | Altitude-scaled free flight (assisted mode) | not compiled |
| `Source/StarAgent/Planet/StarAgentGameMode.*` | Spawns planet and sun into an empty level, starts the player in orbit at 2 R | not compiled |
| `Scripts/` | Asset manifest and editor Python import script for the glTF assets | untested (needs the editor) |
| `tools/` | JavaScript sample dumps and C++ cross-checks | passing |

## Verify the world generators (no engine needed)

Needs Node 22+, g++ or clang++, and `node_modules` at the repository root.

```sh
cd unreal/tools && ./crosscheck.sh
```

Every section must print `PASS`. Run it after any edit under `WorldGen/`.

## Build and run once the engine is built

`EngineAssociation` is empty because this is a source-built engine; build with
the engine's scripts rather than a launcher registration.

```sh
~/UnrealEngine/Engine/Build/BatchFiles/Linux/Build.sh StarAgentEditor Linux Development \
  -project="$PWD/unreal/StarAgent.uproject"
~/UnrealEngine/Engine/Binaries/Linux/UnrealEditor "$PWD/unreal/StarAgent.uproject"
```

Do not run these while another engine build is in progress in `~/UnrealEngine`;
concurrent UnrealBuildTool runs contend for its lock.

First run in the editor:

1. File > New Level > Empty Level (not Open World: World Partition is off for
   this project). Save as `/Game/StarAgent/Maps/Aeon`.
2. Play. `AStarAgentGameMode` spawns `APlanetActor` and `AStarAgentSun` and puts
   the fly pawn in orbit. WASD, mouse look, speed follows altitude.
3. For coloured terrain, water and vegetation materials, run once in the editor's
   Output Log command line in Python mode (path only), or in Cmd mode with `py`:
   `py /home/cees/projects/star-agent-unreal/unreal/Scripts/create_materials.py`.
   It rebuilds `M_AeonLand` (per-pixel `surfaceColor` from height, pixel normal
   and the baked moisture/noise maps, blending to the baked albedo beyond
   40 km, plus the geomorph in World Position Offset and Normal), `M_AeonWater`
   (Single Layer Water with procedural waves) and `M_Vegetation` (vertex
   colour). The planet actor loads all three by path. Rerun it after pulling
   changes to the script; it deletes and recreates the assets.
4. Console `stat unit` and the actor's `VisibleCount` / `MaxVisibleLevel` show
   streaming state. Select the spawned PlanetActor in the Outliner during Play to
   tune the Look (exposure, haze, albedo fade) and Vegetation (densities, cull
   distances, meshes) groups live.
5. Vegetation is a list of biome layers on the planet actor (`Vegetation Layers`):
   each names static and/or skeletal meshes (Quixel Megaplants are skeletal, with
   Nanite foliage and wind bones, instanced through
   `UInstancedSkinnedMeshComponent`), the biomes it grows in (coast, grassland,
   forest, alpine, tundra, dry, wet), a kind (tree / shrub / ground cover, which
   sets the patch level and cull distance) and a density. When the list is empty
   the actor builds defaults from `/Game/Megaplant_Library` if the packs are
   downloaded, otherwise vertex-coloured placeholders, and always adds placeholder
   grass until a real grass layer exists. Place a PlanetActor in the level to edit
   the layers. Epic Fab content lives only here: see THIRD-PARTY-ASSETS.md.

## Rules for the world-generation files

- No Unreal headers in `WorldGen/`; the same files compile in the cross-check.
- Keep JavaScript evaluation order when editing, use the `JsMath.h` helpers for
  every `Math.imul`, `| 0`, `>>>`, `Math.max/min`, `Math.hypot` and Three.js
  `normalize()`, and keep fused multiply-add off (the clang pragma in
  `JsMath.h`, `-ffp-contract=off` in the cross-check).
- Change `GeneratorVersion`/`TerrainVersion` together with the browser build.
- Convert to centimetres at the mesh and actor boundary (`PlanetFrame.h`), never
  inside `WorldGen/`.
- `PI` is an Unreal macro; the ports use `Js::JsPi`.
