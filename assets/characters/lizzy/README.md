# Lizzy — tutorial guide asset

Cees supplied the newest rigged Trailblazer download on 8 September 2026 and
named the intended guide Lizzy. The ZIP contains walking and running exports;
original files and hashes are retained in `source-manifest.json`. Identity was
inferred from the newest rigged download and confirmation requested in the thread.

The supplied walking pose holds both upper arms away from the torso, with the
hands turned outward. This build preserves the supplied skeleton, skin and gait,
reduces lateral shoulder abduction in evaluated world space, then converts the
correction back to each bone's local axes. A relaxed idle and a greeting are
authored from the original rest pose. Root travel is removed for runtime movement.

Rebuild from the repository root with Blender and ImageMagick available:

```sh
node blender/prepare-lizzy.mjs
```

Blender reduces the mesh to approximately 18,000 triangles; a 1K WebP map brings
the runtime GLB below the 2 MB character budget. `build.json` records the final
hash. Intermediate exports live in ignored `.staging/`; original source is retained.
The model can be inspected in `/dev/pirates.html?guide=1`.

Two generic retarget candidates were rejected: importing the original armature's
bone axes distorted the pelvis, and rebuilding its basis produced an unsuitable
head pose. The accepted method instead adjusts the supplied clips directly.
Original diagnostic renders remain in `/tmp/lizzy-audit` during development.

This is preparation for Lizzy's tutorial-guide role. A tutorial script, dialogue,
voice, lip movement and in-world guide placement are not implemented by this asset.
Renderer inspection and independent acceptance are recorded separately in the
pirate/guide QA handoff; the existence of this file does not establish acceptance.
