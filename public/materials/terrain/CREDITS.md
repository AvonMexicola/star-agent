# Terrain material sources

These bundled maps are derived from **ambientCG**, by Lennart Demes, and released
under **CC0 1.0 Universal**. They may be used, modified and redistributed with the
game, including the source repository. No account or external request is needed
to play. See <https://docs.ambientcg.com/license/> and
<https://creativecommons.org/publicdomain/zero/1.0/>.

| Array layer | Source | Use |
| --- | --- | --- |
| 0 | [Ground048](https://ambientcg.com/a/Ground048) | Aeon soil; desaturated lunar regolith detail |
| 1 | [Rock030](https://ambientcg.com/a/Rock030) | Exposed rock on both bodies |
| 2 | [Ground037](https://ambientcg.com/a/Ground037) | Moss and forest ground |
| 3 | [Ground054](https://ambientcg.com/a/Ground054) | Shore sand |
| 4 | [Grass004](https://ambientcg.com/a/Grass004) | Meadow grass |
| 5 | [Ground028](https://ambientcg.com/a/Ground028) | Forest leaf litter |
| 6 | [Gravel001](https://ambientcg.com/a/Gravel001) | Alpine scree |
| 7 | [Snow010A](https://ambientcg.com/a/Snow010A) | Snow and polar ground |

`manifest.json` records source URLs, downloaded archive hashes, packing and output
hashes. `scripts/pack-terrain-materials.py` builds the two atlases from those
1K-JPG archives using ImageMagick. Each layer is reduced to 512×512. Albedo stays
sRGB; the second atlas packs OpenGL normal XY and linear roughness into RGB.
Alpha is opaque throughout; these are material data, without baked lighting.

Gravel001 supplies no roughness map; its packed roughness uses an artistic matte
scalar of .94, recorded in the manifest.

The texture scale is an artistic choice: 4m soil/moss/litter, 8m grass/sand/snow,
and 16m cliff detail. Aeon uses nonperiodic vegetation fields for flight-scale
variation; the old 64m rock multiplier was removed from its ground material.
Selene retains its 64m/256m geological variation. Soil is a terrestrial source adapted for Selene,
not a measured lunar regolith sample. Geometry still comes from the game's
canonical planet and moon generators.
