# Meridian Bastion — independent native PBR review 08

**Native-only decision: pass at 4.00/5 across five applicable criteria.**
The prior broad-white-face/detail finding closes at this inspection scale.
The visible change is fitted service panels, fasteners and a better defined
bearing surround; I am not claiming that an imperceptible texture revision
resolved it. Motion remains unscored and is excluded from the mean.

Reviewer: `/root/nomad_cutter`, independent of builder and capture executor.
I inspected all five original 1600×900 native-08 PNGs and reopened the original
native-07 side and cradle frames for direct comparison. No images or production
files were edited. No browser/GPU was launched by this review. Reports 05, 06
and 07 remain unchanged.

## Evidence

Keep `bastion-native-08/` beside this report for the relative links. Original
location: `/home/cees/projects/.community-hub-qa/bastion-native-08/`.

- Exact asset SHA-256: `8d0dcbb6395479ad083cd609217833b97c74008acdd15b72ed9182ced46b64ae`.
- 948,632 bytes; 9,877 triangles; nine meshes.
- Recorded source: `004979d736bc5bfb39133622f35d0e0afce829f0`; the capture records only `HANDOFF.md` dirty.
- [capture.json](bastion-native-08/capture.json) SHA-256: `ba6ffc933191a61000c57f338fe82fe523a0fda067992f68617d8834c263bb67`.
- Native capture 2026-09-07 21:13:54.893–21:13:59.258 UTC, Chromium 151.0.7922.173, ANGLE AMD Radeon 860M / radeonsi krackan1 ACO / OpenGL ES 3.2; viewport and drawing buffer 1600×900; zero recorded diagnostics.
- Native material maps, RoomEnvironment PMREM, ACES Filmic exposure 0.95. No material overrides or performance claim.

Independent metadata comparison confirms identical 07→08 cameras, named poses,
model bounds and lighting for all five pairs, and an unchanged layout hash.
The scene-script hash differs; this report does not call the entire capture
source byte-identical. Root's geometry/clearance test results are separate from
this visual decision and are not counted as art evidence.

## Applicable QUALITY rubric

| Criterion | Score | Observation and scope |
| --- | ---: | --- |
| Silhouette and scale | **4.0** | [01-wide](bastion-native-08/01-wide.png) and [02-side](bastion-native-08/02-side.png) retain the strong twin barrel/cradle/bearing hierarchy. The additional details do not clutter the overall profile. The complete rest asset is framed against a metre grid; actual station and player scale remain separate. |
| Materials and detail | **4.0** | [04-base-cradle](bastion-native-08/04-base-cradle.png) now shows a bordered access panel with fasteners on the previously bare outer cheek, a dark bearing surround and a framed petrol receiver panel. Those changes also read in 02 and give the large white structures a manufactured assembly logic. Curved brushed metal, dark jackets, painted panels and ivory armor remain distinct. The white surface response itself is restrained; this earns the threshold score, not an exceptional finish score. |
| Lighting and integration | **4.0** | Isolated lighting keeps the bevels, metal variation, base contact and dark bores readable. No new glaring surface or pale-bore regression is visible. Station sunlight, exposure and physical mounting are not certified by studio lighting. |
| Cohesion | **4.0** | Petrol access panels, sparse amber cues, graphite mechanism and ivory armor remain consistent. The new service panels look related to the existing receiver treatment. The Bastion lettering is legible in the inspection views without becoming the main visual feature; gameplay-distance readability remains untested here. |
| Information or physical function | **4.0** | [03-open-bores](bastion-native-08/03-open-bores.png) preserves unmistakably dark open mouths and bright inner annuli. Guides, receiver and bearing explain the mechanism, while the new framed panels suggest credible maintenance access. [05-posed-recoil](bastion-native-08/05-posed-recoil.png) shows no obvious gross detachment or intersection at that endpoint. This is not proof of the full motion path or a live shot origin. |
| Motion | **Unscored — pending** | View 05 is one yaw 0.45 rad / pitch 0.68 rad / port recoil 0.60 m endpoint. It cannot establish temporal recoil/return quality, flicker, continuous clearance or LOD. |

Mean: `(4 + 4 + 4 + 4 + 4) / 5 = 4.00`.

## Closure and limits

The 07 exterior cheek and receiver read as unusually large plain shaded blocks.
In the same 08 views, the surfaces now have clear panel boundaries, attachment
points and a bearing recess. That is a visible, appropriately restrained answer
to the earlier manufactured-finish/detail concern. The inward-facing cheek and
some roof armor remain comparatively plain, but they no longer make the exterior
assembly look unfinished at this scale. No further blocking native-still defect
is identified in this bounded review. The successful 06 bore and metal fixes
remain intact.

This passes the native still-image gate only. **Actual station placement, live
beam and muzzle presentation, continuous recoil and return, phone readability,
gameplay and performance still require their own evidence.** Detail views 03/04
are intentionally cropped; the full-asset views are 01/02/05.

| PNG | SHA-256 |
| --- | --- |
| 01-wide.png | `488bfb55bbdfdbf325c48013d998ea3087845be43b0290d9fa71efb876c279a7` |
| 02-side.png | `c833eec58915857b244f9673388263cb6b6955c932a2b889ec25995f9d59c06c` |
| 03-open-bores.png | `67ab74ae45b0cef6d8c8e13df3bcde2f893d47c9a42d9918644bb20105eff632` |
| 04-base-cradle.png | `515ddb7ccaa5bf8edd7a4d516ae1a98b39c730b75760fc1204495e9733cd4afb` |
| 05-posed-recoil.png | `1b79ce7a63a368d44ef0aba6b7e05adf48259a83bee1cc4184becb818e9cf7d7` |
