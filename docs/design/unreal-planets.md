# Unreal Engine 5 planets — design for the Star Agent port

Branch `feat/unreal5-planets`, started 2026-09-11 at Cees's request. This is a
design and a verified first step, not a playable Unreal build. The engine is
UE 5.8.2 built from source on Linux. The engine-free C++ port of the Aeon
surface function in `unreal/Source/StarAgent/WorldGen/` is validated against the
browser generator; nothing else in this document exists in Unreal yet.

## The problem, stated precisely

Unreal has no spherical world. Landscape is a flat heightfield, the Water plugin
is planar, World Partition streams a flat grid, and gravity is a global −Z
vector. None of those can be bent around a 1,592,750 m sphere. What Unreal does
have is every building block the browser game already assembles by hand:

| Need | Browser game today | Unreal 5.8 | Verified in |
| --- | --- | --- | --- |
| Double-precision positions | JavaScript doubles, metres | Large World Coordinates: `FVector` is double; world extent 43,980,465 km from origin | `EngineDefines.h` `UE_LARGE_WORLD_MAX` |
| Camera-relative float geometry | Subtract camera origin before `Float32Array` upload | Rendering works in translated world space; components keep local float vertices | engine design |
| Depth over 70 km atmosphere and 24,000 km moon | Logarithmic depth shader chunks | Reverse-Z with infinite far plane; no shader convention to maintain | engine design |
| Physically based sky from orbit to ground | `atmosphere.js`, `cloud-volume.js` | `SkyAtmosphere` with `PlanetCenterAtComponentTransform`, `BottomRadius`/`AtmosphereHeight` in km; `VolumetricCloud` layer at a planet altitude | `SkyAtmosphereComponent.h`, `VolumetricCloudComponent.h` |
| Radial gravity for walking | `navigation.js` | `UCharacterMovementComponent::SetGravityDirection` | `CharacterMovementComponent.h` |
| Double-precision physics | Custom swept contact | Chaos `FReal` is double | `ChaosCore/Public/Chaos/Real.h` |
| Runtime terrain meshes | Three.js `BufferGeometry` per patch | `UDynamicMeshComponent` with deferred, async collision | `DynamicMeshComponent.h` |
| Deterministic scatter | `vegetation.js`, `forest.worker.js` | Instanced static meshes; PCG is production-ready if wanted | `PCG.uplugin` |

So the port keeps the architecture PLANET-PIPELINE-MEMORY already prescribes
(cubed sphere, one canonical surface function, double patch centres, float
patch-local vertices, parent retention, skirts) and lets the engine take over
depth, origin handling, sky, clouds, lighting and character movement.

## Units and precision contract

- Unreal units are centimetres. Aeon radius is 159,275,000 cm. The sun at
  25,000,000 km is inside the 43,980,465 km extent, so the whole present system
  fits without world-origin rebasing. Keep rebasing as a fallback if Chaos
  jitters near distant bodies; do not design for it up front.
- `AeonSurface` works in metres and unit directions, exactly like `world.js`.
  Convert to centimetres only where a mesh, actor or component transform is built.
- A patch is one component. Its component transform is the double-precision
  patch centre on the actual terrain (radius plus height, as in the browser
  pipeline step 4). Vertices are float offsets from that centre. Never derive a
  sample direction from a float vertex; sample from the double `(face, u, v)`.
- Terrain generation runs on worker threads (`UE::Tasks`), producing plain
  arrays; the game thread swaps them into the `UDynamicMesh`. This mirrors
  `terrain.worker.js` with transferred typed buffers.
- Seed compatibility is a property to preserve: the C++ port reproduces the
  browser planet bit for bit outside rock outcrops (see validation). Compile the
  world-generation files without fused multiply-add (`-ffp-contract=off`; the
  header carries the clang pragma), and keep expression order when editing.

## Terrain streaming

Same quadtree as `planet.js`: six roots, cells `(face, level, ix, iy)`, grids
of 16 or 32 per `terrain-resolution.js`, maximum level 17, split at 1.8 patch
widths and merge at 2.3, a parent stays until all four children are resident,
perimeter skirts hide neighbour resolution gaps. Port the algorithm; do not
reinvent it.

Nanite is not available to runtime-generated meshes (the Nanite builder is a
Developer module, editor and tooling only), and Landscape cannot be used. The
quadtree is the LOD system, which is what the browser game does today.
`UDynamicMeshComponent` is the first choice because it ships with the engine
and supports deferred collision updates. If per-patch upload cost becomes the
bottleneck, the third-party RealtimeMesh plugin is the drop-in alternative.

Collision: keep the analytic contract. Altitude, landing floors and walking use
`AeonSurface` height and finite-difference normals directly, as `celestial.js`
and `terrain-contact.js` do now. Cook Chaos triangle collision only for patches
at level 13 and above within roughly one kilometre of the player, for ragdolls,
props and vehicles. Two floors are still forbidden: collision meshes come from
the same vertices the renderer shows.

Materials: per-vertex height, slope, moisture and biome masks feed one terrain
material with world-aligned triplanar layers. Use patch-local position plus a
stable offset (the browser's surface-position-modulo-256 m trick) so detail
textures do not crawl when the translated-world origin moves.

## Sky, clouds and light

One `SkyAtmosphere` per level, transform mode `PlanetCenterAtComponentTransform`,
`BottomRadius` 1592.75 km, `AtmosphereHeight` 70 km, component placed at Aeon's
centre. One `DirectionalLight` flagged as the atmosphere sun with a 1.10° angular
diameter, matching `SUN_ANGULAR_RADIUS`. A `VolumetricCloud` layer supplies the
cloud deck by altitude in kilometres. This replaces `atmosphere.js`,
`cloud-volume.js` and `lighting.js` with engine features, and is the largest
fidelity gain of the port.

Selene, Pyre and Miasma: the atmosphere component is retargeted when the
observer changes body domain (`bodyAt` in `celestial.js` already defines the
domains). Distant bodies render as coarse spheres with baked albedo until the
observer enters their domain and their quadtree activates.

## Gravity and movement

Disable engine gravity on every primitive that lives on a planet. A
`UPlanetGravityComponent` applies inverse-square acceleration toward the owning
body's centre each tick: 9.81 m/s² at Aeon sea level, lunar and Pyre values from
`celestial.js`. Characters call `SetGravityDirection` with the radial vector
each tick, so the standard Character Movement Component walks, jumps and slides
correctly on the sphere. Ships and rovers receive the same acceleration through
`AddForce`. The Mover plugin is still experimental in 5.8; do not build on it.

## Water

Not the Water plugin. Reuse the terrain patches at radius without height, which
the browser pipeline already emits as `waterPositions`, as a second mesh with a
material using the Single Layer Water shading model. Shore depth comes from the
negative terrain height already in the vertex data.

## Rotation and multiple bodies

Keep ADR SA-WORLD-004: terrain never rotates numerically. The level frame is the
current body's body-fixed chart; the sun, stars and other bodies are rotated into
that chart for rendering. Switching domains re-expresses the observer, not the
terrain. Rotating a 1,592 km actor every frame would move every collision body
under the player and is exactly what the ADR rejects.

## Validation so far

`unreal/tools/crosscheck.sh` builds the engine-free ports with a plain system
compiler and compares them with the JavaScript generators. All sections pass:

| Check | Result |
| --- | --- |
| Aeon height bit-identical where no rock outcrop contributes (seeds 7291, 42; 21,256 samples each) | 100% |
| Aeon largest height difference, outcrop samples | 2.3 × 10⁻¹³ m |
| Aeon biome mismatches; moisture and colour difference | 0; ≤ 6.1 × 10⁻¹⁵ |
| `generatePatch` buffers (positions, normals, colours, water, parent-morph, indices) on 90 patches across all faces and levels 0–17 | every float32 value identical |
| Selene height, albedo, frost, colour, resources on 25,670 samples | bit-identical where no `exp`/`pow`/`sin` term applies; 3.9 × 10⁻⁹ m worst case |
| Pyre height, resources, regions, 69 feature constants and 7 orbit frames on 21,655 samples | bit-identical away from features; 1.0 × 10⁻⁷ m worst on volcano flanks; orbit positions exact |
| Miasma height, resources, sites and position on 21,276 samples | bit-identical up to V8's `pow` rounding; 4.5 × 10⁻¹³ m worst |
| Surface sample cost, one thread | 2.2 µs Aeon, 1.9 µs Selene, 3.5 µs Pyre, 2.4 µs Miasma |

The residuals come from `sin`, `cos`, `exp`, `pow` and `atan2`, where V8's
fdlibm and glibc round the last bit differently in a few percent of calls.
`JsLibm.cpp` already ports fdlibm `pow` and `exp`; `sin`, `cos` and `atan2`
are left to glibc because their residual only reaches feature flanks and
sub-micrometre agreement is far below any gameplay or save-compatibility
threshold. This is recorded, not fixed.

## What exists in the Unreal project

`unreal/StarAgent.uproject` with one runtime module. The world generators are
compiled and verified as above. The Unreal-facing classes in
`Source/StarAgent/Planet/` were written against the 5.8.2 headers on disk and
are not yet compiled or run: the planet actor (quadtree, worker-thread patch
builds, SkyAtmosphere), the patch-to-`FDynamicMesh3` conversion, radial
gravity, the sun light, an altitude-scaled fly pawn and a game mode that spawns
the planet into an empty level. Since then, verified in the editor: the 0.6 s geomorph
(parent-surface offsets in UV channels, blended in World Position Offset and the
Normal input per patch), the orbital albedo bake, per-pixel `surfaceColor` in the
material, exposure and aerial-perspective tuning, and a six-degree-of-freedom
fly pawn. Written but not yet run: per-patch Single Layer Water meshes with
procedural waves, and seeded tree/grass instancing with runtime-built placeholder
meshes. Vegetation placement is per cube cell, not yet the browser's
latitude-row layout, so groves differ from the browser build for now.

## First Unreal milestone

1. Compile the module and open the editor (see `unreal/README.md`).
2. Orbit view of Aeon under `SkyAtmosphere`, then a continuous descent to the
   coast destination with no holes, parents retained until children arrive.
3. Walk on ground and on a rock outcrop with radial gravity.
4. Cross-check remains green after every change to the world-generation files.

## Open decisions for Cees

- Repository layout: `unreal/` inside this repository with Git LFS for
  `.uasset`/`.umap`, or a separate repository that vendors `WorldGen/`.
- Whether the first Unreal build targets Aeon only or all four landable bodies.
- Which browser systems beyond planets are in scope for the first playable build.
