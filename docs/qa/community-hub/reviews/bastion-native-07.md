# Meridian Bastion — independent native PBR review 07

**Decision: the broad-white finish finding remains open. Native-only mean
3.90/5 across five scored criteria.** The change is visible mainly as a subtle
enamel tone/edge change; the provided frames do not establish closure of the
previous large-surface finding. The metal and bore corrections from 06 remain
successful. Motion is unscored and excluded from the mean.

Reviewer: `/root/nomad_cutter`, independent of the Bastion builder and capture
executor. All five unedited native-07 PNGs were inspected at original 1600×900
resolution. Native-06's cradle frame was reopened for direct comparison. No
production file or image was edited and no browser/GPU was launched. Native-05
and native-06 reports and captures remain unchanged.

## Exact evidence

Keep `bastion-native-07/` beside this portable report for its relative links.
Original evidence location:
`/home/cees/projects/.community-hub-qa/bastion-native-07/`.

- Asset SHA-256: `6a0bfd851bc35f4dcc2fc300ea3d2abd16325b506ad0521580dd019ca45c615b`.
- Export: 898,780 bytes, 9,177 triangles and nine meshes.
- Recorded source: `cc529d48aab623e90ba7623533d92cc0b4327244`, with `sourceDirty: true`. The exact asset and capture hashes identify this review; the commit alone does not.
- [capture.json](bastion-native-07/capture.json) SHA-256: `7b495371d969babea2efc7b209f1f3a80e087aff8546f2e5e1bc24352e38baa3`.
- Capture: 2026-09-07 20:35:47–20:35:52 UTC, Chromium 151.0.7922.173, ANGLE AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2. Zero recorded diagnostics. Viewport and drawing buffer both 1600×900.
- Native materials, no overrides; orthographic views with RoomEnvironment PMREM and ACES Filmic exposure 0.95. Scene draws 10–11; no performance claim.

Independent metadata comparison confirms the same camera, named pose and model
bounds for each 06→07 pair, identical lighting, and unchanged layout and scene
script hashes. Root reports 13 strict export checks preserving geometry, rig,
normals and protected texture tiles; this image review does not independently
repeat that audit.

## Applicable QUALITY rubric

| Criterion | Score | Observation and boundary |
| --- | ---: | --- |
| Silhouette and scale | **4.0** | [01-wide](bastion-native-07/01-wide.png) and [02-side](bastion-native-07/02-side.png) preserve the clear twin-barrel battery, substantial cradle and layered bearing. Both full rest views frame the complete asset, with the metre grid supporting scale. Actual station/person/ship scale remains separate. |
| Materials and detail | **3.5** | Brushed curved metal, dark barrel jackets, ivory armor and teal service panels remain distinct. The newly targeted white finish is too subtle to resolve the large-face limitation: [04-base-cradle](bastion-native-07/04-base-cradle.png) still presents broad cheek and receiver faces as mostly uniform color, also apparent in 02. I cannot award a higher finish score from the existence of new map data when the intended result is not clearly visible in the supplied views. |
| Lighting and integration | **4.0** | The isolated lighting keeps the corrected metal response, readable bevels, dark bores and base contact/shadow. No new blown metal or pale-bore regression is visible. This score does not certify the station scene's sunlight, atmosphere, exposure or physical mounting. |
| Cohesion | **4.0** | Ivory armor, restrained black/metal, teal panels and small amber cues still form one Meridian assembly. The enamel revision preserves that language without a conspicuous texture/style mismatch. Small model/maker markings are not proven readable at gameplay distance. |
| Information or physical function | **4.0** | [03-open-bores](bastion-native-07/03-open-bores.png) retains clear dark interiors against the bright annuli. Rods, guides, receiver supports and the rotary bearing explain the mechanism. [05-posed-recoil](bastion-native-07/05-posed-recoil.png) shows no obvious joint detachment or gross intersection at the depicted endpoint. Actual working-muzzle/shot clearance is not inferred from the stills. |
| Motion | **Unscored — pending** | View 05 records yaw 0.45 rad, pitch 0.68 rad and port recoil 0.60 m. A single endpoint cannot establish travel/return quality, flicker, continuous clearance or LOD. No motion score enters this mean. |

Mean: `(4.0 + 3.5 + 4.0 + 4.0 + 4.0) / 5 = 3.90`.

## Prior finding assessment

The remaining issue is specifically the **rendered finish on broad white plates**,
not silhouette, the previously corrected curved normals, or bore geometry.
In 04, the outer right cheek's clear face and the large receiver shoulders still
look like plain shaded regions. The perimeter/application treatment does not
read clearly enough at this inspection scale to close the 05/06 observation.

A small numerical check supports that local observation without replacing visual
judgment: in the original 04 image rectangle x1133–1152 / y451–490, native-06
contains four RGB colors (normalized standard deviation 0.00132523); native-07
contains one RGB color (standard deviation 0). This is a 20×40-pixel patch on a
clear part of the outer cheek, not a claim that the complete material is flat or
that all texture data is absent. ImageMagick read the source pixels and emitted
statistics only; no edited comparison image was produced.

Further refinement should first verify the intended painted-face UV/finish is
visibly expressed on the actual loaded asset in 04, then tune its application or
edge treatment at that scale while checking 01/02. This does not require changing
the successful geometry, metal or bore areas, increasing the triangle budget,
or adding indiscriminate noise and dirt. The score remains based on the current
images; no texture-generation intent or unobserved motion is credited.

03 and 04 are declared detail crops, so their intentional full-asset cropping is
not a framing failure. **Station placement, live beam/muzzle presentation,
continuous recoil and return, phone readability, gameplay and performance remain
separate pending evidence.** This report does not reject or approve the concurrent
physical hub/browser journey.

PNG SHA-256 receipts:

| File | SHA-256 |
| --- | --- |
| 01-wide.png | `5a71935da9b8c60674f70138b74dc7134b1a3b37f3f8c59e0f235885d1b012f0` |
| 02-side.png | `8373fadfe88ff52802331de2baeed872b65a77a4712246b597e64162a7ee6c97` |
| 03-open-bores.png | `0c2725de6614ea6512bc277ae84b52ba70b1b2124b253feb2c3a62a1a61cbe46` |
| 04-base-cradle.png | `5115bbbbf42719d380168942d5a28cbe5386a4d4bfca8f41f46a3ec4a6cd1d53` |
| 05-posed-recoil.png | `6191a594fe4f0aab0cddd32783fddc7513cd09e326b6fb6be07a591dab6309f8` |
