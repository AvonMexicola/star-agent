# Meridian Bastion station battery

Bastion is an original station-scale twin-barrel defense mount. Its octagonal load spreader, continuous yaw bearing, forked elevation cradle, paired breeches, hollow barrels, return cylinders and aft heat exchanger are authored geometry. The source is deliberately separate from the ship gun kit; this is not a scaled ship weapon.

`layout.json` is the shared runtime contract and is read-only to the builder. The measured export identity, counts, bounds, named nodes and map provenance are generated in `manifest.json`. Authoring and CPU clearance checks do not grant independent visual, actual-game, authority or performance acceptance.

Exported candidate06 is **9,177 triangles / 908,388 bytes**, with nine mesh primitives, two materials and three 512² lossless WebP maps. SHA256: `adf6c5b03da18710a3d97341dd503ec95433e564d81610ed67037b226af8e4ca`. Its matching corrected motion audit passes all 188 poses, 77,720 candidate triangle pairs and 1,316 actual world-pose assertions. A strict comparison with candidate05 preserves every oriented local/world triangle, complete rig records and all corner attributes except normals and UVs. The contact and finite-sample limits below still apply. See `PRODUCTION.md` for the earlier failures and exact closures. Candidate06's independent native review scored3.90 and left the broad enamel finish below bar. Frozen candidate07 source addresses those faces; its export and independent review are still pending.

## Rebuild and audit

Run from the repository root with Blender 5.2 and ImageMagick `magick` available:

```sh
env ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio \
  --python-exit-code 1 --python blender/build_station_defense.py
env ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio \
  --python-exit-code 1 --python assets/station-defense/check_motion.py
```

Both scripts accept `-- --root /absolute/checkout/path`; the read-only motion audit also accepts `--out /absolute/report.json`. The builder regenerates the three original 512² map sources and lossless WebP files, the editable `.blend`, the GLB and measured manifest. It saves the editable component scene before constructing disposable export batches. The normal exporter is uncompressed glTF geometry; there is no Draco, Meshopt or hosted decoding dependency. Optional aft decorative lettering uses the installed Adwaita Sans font at `/usr/share/fonts/Adwaita/AdwaitaSans-Regular.ttf`; reproduce the font environment for an identical engraving/export. All operating labels and strike behavior belong to runtime.

The standard-library Python delta probe accepts `--before /path/to/candidate-05.glb --after /path/to/station-defense.glb --out /path/to/delta.json`. It checks expanded oriented triangles independently of exporter vertex splitting, complete node records, material bindings and non-normal/non-UV corner data. Its unchanged-file control passes, and a deliberate 1 mm position mutation is rejected. The preserved candidate05 identity is `ccc8f276dc07891aff056fded88367607a28d5f5aa2897e39b9ae973fca3472f`.

The audit imports the actual exported GLB, sets imported DOFs to XYZ rotation mode and independently verifies actual mesh vertices and muzzle world transforms against game-space matrices at every pose. It checks 188 finite pitch/recoil/yaw poses with triangle intersections and forward bore-centre rays. The only contact exemptions are the narrow trunnion sleeve engagement and the rear barrel end-stop boundary at full recoil. This is a finite pose check, not a continuous swept-solid theorem or a check against the station's surrounding geometry. The audit writes its own asset SHA and does not mutate the asset or source.

## Coordinate and articulation contract

All dimensions are metres: game +Y is up, game −Z is the bore direction. The root sits on the mounting surface at Y0. The fixed foundation is contained by X/Z±10 and Y0..4. The editable Blender source uses the equivalent Z-up mapping; export and runtime use the game convention.

| Node | Parent | Rest transform / runtime operation |
| --- | --- | --- |
| `Bastion` | scene | Identity root at the mount surface |
| `Bastion_Base` | `Bastion` | Fixed foundation |
| `Bastion_Yaw` | `Bastion` | Rotate local +Y, unlimited yaw |
| `Bastion_Pitch` | `Bastion_Yaw` | Position [0,9,0]; rotate local +X from −0.20 rad through +π/2 |
| `Bastion_Recoil_Port` | `Bastion_Pitch` | Identity at rest; translate local +Z by 0..0.60 m |
| `Bastion_Recoil_Starboard` | `Bastion_Pitch` | Identity at rest; translate local +Z by 0..0.60 m |
| `Bastion_Muzzle_Port` | `Bastion_Pitch` | Identity rotation, local position [−4.2,0,−29] at rest |
| `Bastion_Muzzle_Starboard` | `Bastion_Pitch` | Identity rotation, local position [+4.2,0,−29] at rest |

The muzzle empties are **direct children of Pitch**, not of the recoil nodes. Runtime must add each barrel's current recoil offset to its companion muzzle's local Z. The instant strike samples the actual selected muzzle at its defined strike pose; recoil and visible flash behavior do not establish gameplay authority or a cooldown. There are no baked animation clips, private shaders or lights in this asset.

The main bores remain open, with a 2.16 m nominal interior diameter. A narrow mint emitter annulus is attached to the inner wall near each mouth; no luminous disc closes the opening. The return plungers enter actual hollow cylinders. Machined top/bottom reliefs in the receiver guides preserve space for the 0.60 m stroke. All source parts retain descriptive names and the explicit intended joint labels. Export batches preserve fixed, yaw, pitch and each independent recoil assembly; powered pieces remain separate from PBR pieces.

## Materials and provenance

All geometry and texture pixels are original deterministic procedural work. The ivory, graphite, petrol, steel, restrained amber and mint palette follows Meridian's existing fleet language. No model, photographic map, paid generation or previous gun texture payload is copied. `textures/provenance.json` records the seed, algorithm, color spaces, source-map hashes and font condition.

Three 512² lossless WebP maps provide sRGB base color, linear roughness/metalness and a restrained tangent normal response. Relief is independent of color. The brushed metal variation affects roughness; no light direction or diagonal scuff pattern is painted into albedo. Geometric bevels provide the main edge response. Cylindrical rods use explicit radial side normals and flat cap normals. Candidate06 also gives revolved barrels/collars circumferential normals while preserving longitudinal profile breaks and machined relief flats. The two existing bore inner walls sample the dark, rough liner swatch; no cap or added geometry closes their openings. Bounded contact AO comes from two short CPU hemisphere rays per source corner and is stored as standard normalized RGBA8 vertex color; quantization error is measured in the manifest and is at most 1/510 per channel. Geometry uses the standard exporter precision and all maps are lossless.

Candidate06's additional deterministic finish recipe is recorded here alongside the generated provenance file: base-color grain uses Python RNG seed 7291; independent normal pores use seed 7317; brushed roughness uses integer-hash noise with salt 41; broad finish variation uses smoothly interpolated integer-hash noise at a 43-pixel scale with salt 79 plus the swatch index. Steel and enamel receive bounded roughness/metalness variation, with the bore liner at nominal roughness 0.94 and metalness 0.02. Lossless WebP method 6 changes compression effort, not quality. The frozen builder is the complete reproducible algorithm; no hosted inputs or photographic textures were used.

The budget is per exported asset: at most 10,000 triangles, 1,000,000 bytes and 1024 pixels per map dimension. The manifest reports the measured result. Draw calls in an actual station also depend on instance handling, culling and shadows; asset primitive count is not a whole-scene performance result.

## Acceptance boundary

The builder asserts its shared contract, fixed-base bounds and export budgets. The matching actual-GLB motion report establishes only its documented finite checks. Independent native and station images, actual yaw/elevation/recoil behavior, barrel-origin strikes, station keep-outs and resource/performance checks remain the integrating task's responsibility. A successful export must not be presented as final art approval.
