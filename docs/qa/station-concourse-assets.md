# Concourse shop and passenger elevator assets

Candidate authored on 2026-09-06 in `feat/station-concourse` worktree
`/tmp/star-agent-concourse-work`, starting from `056d20b`. This record covers
the Blender kit, its collision contracts and studio review. In-game lighting,
shop UI, production journeys and the independent visual rubric require the
integrated candidate's separate review; these images do not establish those gates.

The kit replaces oversized bench blocks with three-place manufactured seating,
adds two distinct shop interiors, and replaces bare elevator leaves with a
pressure-door surround, pockets, lined cabin, handrails and controls. Shop stock
uses original inert rifle silhouettes, filter canisters, avionics modules and a
drive assembly. No external geometry or generated image is included.

The final merchandising pass adds a third rack in each shop at Z=-1.0 and two
slim directory pylons at X=±5.5, Z=-12. The studio images below predate this
additional stock and the pylons; final in-game review remains pending.

## Rebuild and inspect

Blender **5.2.0 LTS**, build `fbe6228777e7`. Run from the repository root:

```sh
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_station_concourse.py
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_station_concourse.py -- --render-dir /tmp/star-agent-concourse-studio
node --test --test-isolation=none --test-reporter=tap tests/station-concourse.test.js
```

The optional `--only-elevator` argument limits rebuilding and studio rendering
to that asset; `--only-concourse` leaves the elevator binary untouched. The
merchandising pass used `-- --only-concourse` and verified the elevator SHA-256
remained unchanged. Source geometry is authored in game metres and transformed once
from Blender Z-up to glTF Y-up. Materials read the established CSS colour tokens,
convert sRGB to scene-linear, and use bevels and weighted normals. The station
finish decorator maps `FinishIvory`, `FinishPetrol`, `FinishSteel`, `FinishDark`
and `FinishRubber`; `FinishMint` keeps its modest authored emission.

The builder exports actual standalone GLBs to temporary directories to measure
each assembly's bytes, including its own material/JSON overhead. It then batches
static geometry by material, with independent material batches for each moving
leaf. The aggregate buffer is not charged repeatedly to every prop.

## Export manifest

| Asset | Actual GLB bytes | Actual triangles | Mesh primitives | Static collision boxes |
|---|---:|---:|---:|---:|
| `station-concourse.glb` | 2,676,356 | 36,932 | 6 | 69 |
| `station-elevator.glb` | 364,380 | 4,724 | 18 | 45 |

The concourse is an aggregate of fifteen separately measured assemblies. Every
assembly passes the 10,000-triangle and 1,000,000-byte prop limits. The two assets
use 24 mesh primitives together, below the kit's 60-draw limit; these are asset
counts, not measured total scene draw calls or frame timings.

| Assembly | Triangles | Standalone GLB bytes |
|---|---:|---:|
| Armory architecture | 1,640 | 136,764 |
| Armory counter | 2,056 | 171,228 |
| Components architecture | 1,640 | 136,852 |
| Components counter | 2,056 | 171,332 |
| Armory rack 0 | 2,936 | 242,884 |
| Components rack 0 | 4,152 | 319,760 |
| Armory rack 1 | 2,936 | 242,744 |
| Components rack 1 | 4,152 | 319,708 |
| Armory rack 2 | 2,936 | 242,204 |
| Components rack 2 | 4,152 | 319,564 |
| Drive module display | 2,100 | 153,408 |
| Waiting seat bank 0 | 2,240 | 160,700 |
| Waiting seat bank 1 | 2,240 | 160,680 |
| North directory pylon | 848 | 64,936 |
| South directory pylon | 848 | 64,932 |
| Elevator surround | 2,048 | 170,548 |
| Elevator cabin | 2,060 | 171,052 |
| Elevator left leaf | 308 | 26,220 |
| Elevator right leaf | 308 | 26,228 |

GLB SHA-256 for this reviewed export:

```text
station-concourse.glb 9654c3d3068759dfad2a340521d662fe022511e770f662482fb42939448e0cef
station-elevator.glb  981a229de511ed34ea99a1d35cc639bb05651e4f8c8829d8ba987dbfc5b9f5c2
```

## Placement and collision API

The concourse attaches at identity, with its floor at Y=-8. Its measured bounds
are approximately `[-19.94,-8,-12.22]` to `[19.94,-4.02,10.8761]`. Counters are
centred at X=±12, Z=0; customer reach points are X=±10.7, Z=0. Seating banks at
X=±6, Z=10.5 have a measured cushion surface 0.46 m above the floor.
Directory pylons have 0.88 × 0.44 m footprints and stand 2.45 m tall. Their
`DirectoryNorth` / `DirectorySouth` display anchors are at
`[-5.5,-6.59,-11.792]` / `[5.5,-6.59,-11.792]`, facing +Z. The portrait inset is
0.58 × 1.64 m; labels and actual station directions are runtime-owned.

The elevator attaches at `[0,floor,doorZ]`. Its local bounds are approximately
`[-4.39,-0.024,-0.37]` to `[4.39,3.585,3.4]`. The threshold is flush with the floor.
Named groups `ElevatorLeafLeft` and `ElevatorLeafRight` have origins
`[-1.04,1.55,0]` and `[1.04,1.55,0]`. Each leaf occupies 2.04 × 3.1 × 0.13 m and
moves 2.05 m outward along X. The groups remain independent when cloned.
The usable cabin is approximately 3.0 m deep. Its rear lining and handrail sit
0.30 m forward of the initial export, ahead of the original hangar vestibule wall
at doorZ+3.1. The rear rail is centred at local Z=2.88; the side rails end at 2.77.
The outer roof and side-shell depth remain 3.4 m. Door leaves and surround are
unchanged, and this elevator-only correction leaves the concourse GLB untouched.

Both loaded `gltf.scene.userData` objects directly contain:

- `assetManifest`: JSON string array of `{name,bounds:{min,max},triangles,standaloneBytes}`.
- `collisionBoxes`: JSON string array of `{name,min,max}`, in game-local Y-up metres.
- `coordinates` and `builder`: provenance strings.

Shop architecture, surround and cabin supply individual physical-piece boxes;
their broad enclosing bounds must not be used as a solid wall across the interior.
Compact counters, racks and seats use individual assembly footprints. Moving
leaves are excluded from the static boxes and use the runtime's moving bounds.

Shop sign anchors face the central aisle along ±X, including `ArmoryScreen` and
`ComponentsScreen`. Elevator header and call-screen anchors face -Z; the internal
screen faces -X. Runtime code owns the displayed names, stock and interactions.

## Validation and studio review

Five focused Node tests passed against the real GLBs with Node 26.7.0. They check
the index count against the manifest, vertex containment, individual budget rows,
the central corridor, both counter approaches, passage around counters, directory
footprints and front-facing display anchors, blocked
counter/seat volumes, seat height, visible cabin walls, cloned leaf independence,
and collision agreement in closed, partially open, open and closed-again poses.
They exercise door Z=14.3 and Z=22.3 at floor=-8, plus a translated floor=-11.25
to catch fixed-height assumptions. Both exported models loaded successfully.
The additional overlay test loads the original `station.glb` together with the
new cabin and verifies that both rear lining and handrail are the first visible
ray hits, ahead of the inherited vestibule. Two previous clear-path endpoints
were shortened to local Z=2.5 so the full walking body clears the relocated rail;
the unchanged deeper endpoints correctly reported collisions after the fix.

CPU studio inspection corrected a 5 cm seat-height excess, doubled shared
armrests and door cassettes initially hidden behind the structural slab. Final
inspection confirms separate cushions, stable metal supports, layered door
faces, pocket travel and the lined open cabin. The wide kit-only view deliberately
lacks the runtime room shell, floor graphics and shop labels; the complete hub
still needs in-game review.

Blender printed existing optional `cattrs` and MeshOptimizer availability errors
at startup/export. All builds exited zero; the assets use ordinary uncompressed
glTF and require neither optional component. Raw audit/build logs remain in `/tmp`.

These five images are **Blender CPU studio renders before the final merchandising
pass and rear-cabin fit correction**, 1200×800, Cycles with 24
samples and denoising, using studio area lights. They are not game screenshots or
performance evidence. Review copies preserve dimensions and use WebP quality 86:

```sh
magick /tmp/star-agent-concourse-studio/seating.png -quality 86 docs/qa/station-concourse/seating.webp
```

The same encoding command was used for the other four named views.

![Shop kit composition in the Blender studio](station-concourse/concourse.webp)

![Armory counter and display rack in the Blender studio](station-concourse/armory.webp)

![Three-place seating in the Blender studio](station-concourse/seating.webp)

![Closed pressure elevator in the Blender studio](station-concourse/elevator-closed.webp)

![Open lined elevator cabin in the Blender studio](station-concourse/elevator-open.webp)
