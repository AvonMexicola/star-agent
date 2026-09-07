# Meridian Bastion — independent native PBR review 05

**Decision: needs refinement. Native-only mean 3.60/5 across five scored criteria.**
This is below `QUALITY.md`'s 4.0 mean. No scored item is below 3. Motion remains
unscored and is excluded from the mean. This report does not approve station
integration, temporal animation, beam presentation, gameplay, phone readability
or performance.

Reviewer: `/root/nomad_cutter`, independent of Bastion's builder and root's native
capture. All five actual PNGs were visually inspected. The asset and production
files were not modified, and the reviewer did not launch a browser or GPU job.

## Exact evidence

Evidence folder: `bastion-native-05/`. Preserve that folder beside this portable
report so the relative links remain usable.

- Asset SHA-256: `ccc8f276dc07891aff056fded88367607a28d5f5aa2897e39b9ae973fca3472f`.
- Layout SHA-256: `e9f34742ee9b4002513abb8f5fbfcaf9a838553977be97e6523f358c94037072`.
- Capture records source commit `7e566297faf3efbae733c43c2b0800405fdc494f` with dirty source. The exact asset and scene/capture hashes in [capture.json](bastion-native-05/capture.json) identify the reviewed candidate; the commit alone does not.
- Captured 2026-09-07 19:22:03–19:22:07 UTC. Chromium 151.0.7922.173; ANGLE, AMD Radeon 860M, radeonsi krackan1 ACO, OpenGL ES 3.2. Viewport and render buffer 1600×900. The receipt contains zero diagnostics.
- Native materials unchanged; ACES Filmic exposure 0.95, RoomEnvironment PMREM, key/fill lighting and a 1 m grid. These are isolated orthographic PBR views, not the game's atmosphere/postprocess or station lighting.
- Asset: 9,177 triangles, nine meshes, 877,048 bytes. The capture reports 10–11 scene draws. These counts do not establish frame-time or resource-lifetime acceptance.

## Scores

| QUALITY criterion | Score | Evidence and boundary |
| --- | ---: | --- |
| Silhouette and scale | **4.0** | [01-wide](bastion-native-05/01-wide.png) and [02-side](bastion-native-05/02-side.png) clearly read as a heavy twin-barrel station battery. The 20 m foundation, long projecting barrels, paired receivers and visible trunnion supports have a coherent hierarchy. Both full rest views fit the entire asset. The metre grid supports scale; an actual person/ship relationship remains for the station view. |
| Materials and detail | **3.0** | White armor, dark jackets, metal collars and teal panels are separated, with useful bevels, plungers and fittings. However, the barrel and collar surfaces read as broad polygonal gray bands in 01–03; the large white receiver and support faces remain visually plain in [04-base-cradle](bastion-native-05/04-base-cradle.png). Surface variation and manufactured finish are too weak at this inspection distance. |
| Lighting and integration | **3.5** | The isolated lighting keeps the main masses visible and gives the base a readable ground contact and cast shadow. The dedicated bore detail loses depth because the inner surfaces are extremely pale; metal response also emphasizes broad faceting. No station contact, Aeon lighting, HDR/postprocess or daylight/night integration is assessed here. |
| Cohesion | **4.0** | White armor, restrained dark polymer/metal, cool green service surfaces and small amber caution marks form a consistent Meridian assembly. Detail density is concentrated near mounts, collars and service interfaces. The maker/model marks are subtle in 04; this score does not claim they are readable at gameplay distance. |
| Information or physical function | **3.5** | The bearing, paired cradle supports, separate barrel guides and return rods explain the mechanism. [05-posed-recoil](bastion-native-05/05-posed-recoil.png) shows an elevated assembly without an obvious detached joint or visible interference. But [03-open-bores](bastion-native-05/03-open-bores.png) reads as two pale filled polygons rather than clear deep openings. Wider/posed views show recesses, so this is a readability finding, **not a claim that the geometry is capped**. |
| Motion | **Unscored — pending** | View 05 records yaw 0.45 rad, elevation 0.68 rad and port recoil 0.60 m, with both muzzle poses reported. It establishes a posed state only. The different camera and single endpoint do not show recoil travel, return timing, continuous joint clearance, flicker or LOD transitions. No motion score enters the mean. |

Mean: `(4.0 + 3.0 + 3.5 + 4.0 + 3.5) / 5 = 3.60`.

## Required finish corrections

1. **Restore convincing curved metal response.** In 01–03, the long barrels and
   expanded collars show distinct wide facets/bands, dominating the otherwise
   deliberate manufactured forms. Review smooth/weighted normals and intended
   hard-edge boundaries on the curved parts. Preserve the useful collar bevels
   and silhouette transitions; this finding does not call for a new silhouette.

2. **Give the bores a clear visual opening.** In 03, both interiors are pale,
   nearly filled shapes with little depth separation from the bright annuli.
   Make the bore-wall/recess/emitter relationship readable with the native finish
   under the same lighting. Avoid painting a fake hole over valid geometry or
   relying only on a different camera to conceal the problem.

3. **Finish the large manufactured surfaces.** In 04, broad armor and receiver
   faces look close to plain color regions despite the loaded maps. Add or tune
   restrained roughness, normal and surface variation so metal, paint and polymer
   differ at the actual viewing scale. Retain the calm panel hierarchy; uniform
   noise or an overall dirt overlay would not solve this finding.

Repeat the same five native views after that bounded pass, retaining this failed
set. Preserve the proven geometry positions, named rig, muzzle contract and
clearances unless a separate reason requires a change. A new export hash requires
a new visual record even when only normals or material finish changes.

## Scope retained for later review

The mouth and base images are explicitly labeled detail crops; their cropped
full-model bounds are intentional and are not counted as framing failures.
Native stills show no obvious joint detachment or gross mechanism intersection
in the depicted poses. That observation does not replace the separate CPU motion
and collision checks, which this report neither reopens nor independently extends.

Actual station mounting/scale, sunlight and exposure, first-person approach,
beam beginning at the working muzzle, recoil/return in continuous play, and phone
readability remain pending. The model is a promising authored battery whose
current native finish requires refinement; this is not final asset acceptance.
