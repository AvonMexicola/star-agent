# ⚠️ Third-party assets in the Unreal port — READ BEFORE USING ANY ASSET

**Epic-licensed content (Quixel Megascans, Megaplants, Fab Standard License
assets, Epic sample projects such as Electric Dreams) is used ONLY in the Unreal
Engine port under `unreal/`. It must NEVER be exported, converted or copied into
the WebGL browser game, its `assets/`, `public/` or `blender/` directories, or
any non-Unreal build.**

Why: Fab's Standard License and Epic's sample-project licences allow use of this
content inside Unreal Engine products only. The browser game's own rule
(AGENTS.md, README) is that core play needs no proprietary assets, and its
[asset production standard](../docs/asset-production-standard.md) requires
original, rebuildable sources with recorded provenance. Both lines stay intact
by keeping Epic-licensed content on the Unreal side of this boundary.

## Rules

1. **Not in this repository.** Fab downloads are ignored by git
   (`unreal/.gitignore`: `Content/Fab/`, `Content/Megascans/`, `Content/MSPresets/`,
   `Content/Quixel/`). Redistributing the raw assets, for example by committing
   them to this public repository, is not permitted by the licence. Every
   developer downloads them from Fab into their own project (Window > Fab in
   the editor, free items, Add to Project).
2. **Referenced by path only.** Code and scripts refer to these assets by content
   path or through actor properties; nothing in `Source/` or `Scripts/` embeds
   their data.
3. **Recorded.** Each pack in use is listed below with its Fab licence, so a
   release audit can see exactly what a build depends on.
4. **Never crosses to WebGL.** A change that moves any of this content toward the
   browser game must be rejected in review. The browser game's trees, grass and
   rocks remain the procedural, original ones in `src/`.
5. **Original assets go the other way freely.** Everything under `assets/` and
   `blender/` (ships, station, characters, tools) is the project's own work and
   may be imported into Unreal; `Scripts/asset-manifest.json` tracks that.

## Packs in use

| Pack | Source | Licence | Used for | Content path |
| --- | --- | --- | --- | --- |
| _(none yet; add rows as packs are adopted)_ | Fab | Fab Standard License | | `/Game/Fab/...` |

Candidates chosen for the port: Quixel Megaplants (Black Alder, Norway Maple,
Common Hazel, European Aspen, European Beech; Procedural Vegetation Editor +
Nanite Foliage) for forests, and the free Megascans meadow/grass packs for ground
cover. Fill in the table when they are downloaded.
