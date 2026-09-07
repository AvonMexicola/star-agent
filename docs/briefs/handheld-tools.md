# Handheld equipment finish

User request: a Blender pass, quality check and improved texturing for the
tractor, mining cutter, laser rifle and existing sidearm firearm.

The three inherited GLBs are original `blender/build_gear.py` hard surfaces with
no UVs. The cutter has a runtime triplanar wear shader; tractor mode reuses it.
The rifle's separately fitted stock must stay at 0.221 m behind the grip.

Finish the actual held assets: ivory ceramic paint, graphite polymer, machined
metal, rubber contact surfaces and restrained mint emission. Use service markings,
roughness variation, bevel highlights and localized contact shading. Retain the
industrial cutter and rifle silhouette; give the tractor a guarded open induction
head with three field poles and a distinct teal housing. The sidearm stays a
compact energy firearm. No new weapon damage, ammunition or cargo rules.

| Tool | Runtime barrel | Muzzle, metres | Support grip | Rear limit |
| --- | --- | --- | --- | --- |
| Rifle | −X, Y up | −.55, .115, 0 | −.29, .012, 0 | .221 |
| Sidearm | −X, Y up | −.15, .055, 0 | one hand | .15 |
| Cutter | −X, Y up | −.60, .14, 0 | −.30, .01, 0 | .204 |
| Tractor | −X, Y up | −.60, .14, 0 | same as cutter | .204 |

Origins remain the rear grip/palm; current expedition glove calibration and
support-position overrides are retained. First person, third person, side, muzzle
and hands are the affected views. Inspect the actual game in addition to a
controlled material/rig view. Preserve RT fire/beam input and neutral transitions.

All geometry/maps are original deterministic authorship, reusing the checked-in
gear construction helpers. No external imagery or generated-photo material.
Targets: each prop under 10k triangles/1 MB, maps at most 1024² WebP, shared maps
and material batching. Record actual exports, GPU counts, failures and inspection;
builder inspection is not independent visual acceptance.
