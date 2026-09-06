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

`manifest.json` records source URLs, downloaded archive hashes, packing and output
hashes. `scripts/pack-terrain-materials.py` builds the two atlases from those
1K-JPG archives using ImageMagick. Each layer is reduced to 512×512. Albedo stays
sRGB; the second atlas packs OpenGL normal XY and linear roughness into RGB.
Alpha is opaque throughout; these are material data, without baked lighting.

The texture scale is an artistic choice: 4m soil/moss, 8m sand, 16m cliff detail,
and 64m/256m broad rock variation. Soil is a terrestrial source adapted for Selene,
not a measured lunar regolith sample. Geometry still comes from the game's
canonical planet and moon generators.
