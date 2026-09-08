# Pirate sources and reproducible build

Five Meshy textured humans supplied by Cees on 8 September 2026 become three
Aeon opponents and two Selene opponents. `source-manifest.json` records the exact
download names, ZIP members and SHA-256 hashes. The static textured exports have
no skeleton. The earlier male ZIP supplies a weighted humanoid and crouch-left
motion. Its crouch-look export is retained as source but is not used in gameplay.
The existing expedition player's mesh and motion library are retained separately
as the build input, with their original repository provenance.

From the repository root, with Blender, ImageMagick and `npm ci` installed:

```sh
node blender/build-pirates.mjs
node --test --test-isolation=none tests/pirate-assets.test.js tests/player-expedition.test.js
```

The build first normalizes each human to 1.85 metres, decimates to 18,000 triangles
and transfers the donor's nearest weighted surface influences onto a common
22-bone skeleton. Top four weights are normalized per vertex. Blender heat weights
failed on the disconnected clothing; this transfer replaces that failed step.
The unskinned helper sphere in the donor is excluded from body measurements.

The existing retargeter transfers the expedition library and supplied crouch-left
onto the common rig. World-space reflected rotations produce the opposite strafe.
Backward clips reverse the locomotion; crouch idle samples the deep crouch pose.
Two-bone leg IK authors cyclic forward crouch and standing sidesteps; short
interpolated stance transitions join standing and crouching. Root travel is removed.
NPCs retain 21 clips. The player receives nine additional clips and an improved
crouch-walk, preserving the existing detailed mesh, glove morphs, shadow index LOD,
weapon sockets and all other motions.

Intermediate `.blend` and GLB files are regenerated under `rigged/` and ignored.
Runtime GLBs and their manifests are retained under `public/models/`. Each NPC is
below the 20,000 triangle / 2 MB character budget, using a 1K base map and 512px
surface maps. The detailed player retains its existing 9 MB exception.
`build.json` records exact output hashes and the clip inventory. The props manifest
is updated by the same packer. Rebuilding may change Blender exporter metadata;
compare geometry, clip validation and output hashes before delivering new exports.

`blender/build_pirate_camp.py` authors the bevelled salvage barriers and supply
cache. Runtime barriers use the same dimensions for visible geometry, bullet
occlusion and walking collision. Every placement samples canonical body terrain.

These assets connect to `src/pirates/system.js`, the shared `Character` mixer and
`Equipment` weapon system. The encounter uses real ammunition, health and inventory
transactions. Pickup/carry clips remain available; heavy-object handling is not
introduced by this encounter. See `docs/qa/pirates/README.md` for validation status
and retained failures. Source production and author checks do not establish
independent art acceptance or production deployment.
