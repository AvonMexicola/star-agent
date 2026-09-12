# Asset manifest and Unreal import

Generated 2026-09-11 from the repository by an inventory pass over `assets/`, `public/`, `blender/` and `src/`. Nothing here has run in the editor yet.

## Files

- `asset-manifest.json` — one entry per asset: id, category, source path, Blender build script, the `src/` modules that load it at runtime (`loaded_by`; empty means studio, tooling or source only), proposed Unreal content folder, gameplay-facing node names, units and provenance notes. The top-level `counts`, `conventions` and `anomalies` summarise the pass.
- `import_assets.py` — editor Python that reads the manifest and imports every `.glb`/`.gltf` with a content path through Interchange, falling back to `AssetImportTask`. Untested until the editor runs: use `--dry-run` first. Mesh combining is off so named nodes survive as components; no manual scale or rotation is applied because Interchange converts glTF metres/Y-up to centimetres/Z-up itself.

## Counts

| Entries | glTF files shipped | glTF loaded by the game | Blender sources | Anomalies |
| --- | --- | --- | --- | --- |
| 243 | 109 | 90 | 29 | 59 |

Per category: prop 81, texture 39, other 27, ship 16, character 16, creature 15, station 12, font 10, weapon 8, tool 7, audio 6, vehicle 4, ui 2.

## Running the import

Enable the Python Editor Script Plugin (already listed in `StarAgent.uproject`), open the project, then in the Output Log's Python console:

```python
import sys; sys.argv = ['import_assets.py', '--dry-run']
exec(open('/home/cees/projects/star-agent-unreal/unreal/Scripts/import_assets.py').read())
```

Or from a shell with the editor built:

```sh
~/UnrealEngine/Engine/Binaries/Linux/UnrealEditor-Cmd unreal/StarAgent.uproject \
  -run=pythonscript -script="$PWD/unreal/Scripts/import_assets.py --dry-run"
```

Drop `--dry-run` to import; add `--all` to include studio-only assets; `--category ship` or `--id nomad` restrict the run; `--report PATH` writes a JSON summary.

## Conventions that affect import

- **coordinates.** metres, Y up; ships nose -Z, aft +Z; origins documented per entry (landing plane, support surface, base centre)
- **named nodes.** node names gameplay looks up (getObjectByName / layout.json); they must survive as components or sockets
- **colour spaces.** basecolor/emissive sRGB; normal (OpenGL +Y), ORM, bump, roughness linear
- **vertex colours.** COLOR_0 carries baked AO / tint on base kit, station and ship exports; keep it on import

## Anomalies

The manifest's `anomalies` array lists 59 items: files referenced by `src/` but missing, files present but unreferenced, and assets whose producing script could not be identified. Review them before the first real import; they are inventory findings, not import failures.
