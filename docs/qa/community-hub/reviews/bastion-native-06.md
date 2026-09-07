# Meridian Bastion — independent native PBR review 06

**Decision: native finish still needs a bounded correction. Mean 3.90/5 across
five scored criteria, below the 4.0 native review bar.** No scored item is below
3. The previous curved-metal and pale-bore readability findings close in these
views. The large armor/receiver surface-finish finding remains open. Motion is
unscored and excluded from the mean.

Reviewer: `/root/nomad_cutter`, independent of the Bastion builder and capture
executor. All five unedited candidate-06 PNGs were inspected at their original
1600×900 resolution. Candidate-05 wide, bore and cradle images were reopened for
direct comparison. No production file, asset or image was edited; no browser or
GPU job was launched. The native-05 rejected report and evidence are unchanged.

## Exact candidate and comparison

Keep the `bastion-native-06/` evidence folder beside this portable report for the
relative links below. Its original location is
`/home/cees/projects/.community-hub-qa/bastion-native-06/`.

- GLB SHA-256: `adf6c5b03da18710a3d97341dd503ec95433e564d81610ed67037b226af8e4ca`.
- Clean recorded source: `96142485f2b027d73f0c6b6ebeeaf3d746093ece`.
- Layout SHA-256: `e9f34742ee9b4002513abb8f5fbfcaf9a838553977be97e6523f358c94037072`.
- [capture.json](bastion-native-06/capture.json) SHA-256: `df7e81e16b2d7874f9dd07bc15173d3c332ef68353cb8286394e833e25d2b20e`.
- Captured 2026-09-07 20:10:01–20:10:05 UTC. Chromium 151.0.7922.173; ANGLE AMD Radeon 860M, radeonsi krackan1 ACO, OpenGL ES 3.2. Viewport and render buffer both 1600×900. Receipt contains zero diagnostics.
- Native materials without overrides, ACES Filmic exposure 0.95, RoomEnvironment PMREM, identical key/fill lighting and 1 m grid. These are isolated orthographic views; they do not use the actual station scene.
- Export: 9,177 triangles, nine meshes, 908,388 bytes. Native scene reports 10–11 draws. These counts do not establish frame-time, phone or resource-lifetime acceptance.

Independent JSON comparison confirms **identical camera, named pose and model
bounds for all five 05→06 pairs**, plus identical lighting, layout hash and scene
script hash. Thus the visible improvements are assessed without a changed view
or exposure. This is metadata comparison, not a new independent triangle/rig
clearance audit. Root's reported 188-pose audit remains separate evidence.

## Applicable QUALITY scores

| Criterion | Score | Evidence and boundary |
| --- | ---: | --- |
| Silhouette and scale | **4.0** | [01-wide](bastion-native-06/01-wide.png) and [02-side](bastion-native-06/02-side.png) retain the clear heavy twin-barrel battery, layered bearing, paired receivers and substantial trunnion supports. Full rest views frame the complete model; the metre grid supports scale. There is no new silhouette defect. Actual person/ship and station scale remain unassessed. |
| Materials and detail | **3.5** | Long barrels and collars now have continuous curved highlights with restrained brushed variation. The black jackets, metal collars, white armor and teal service panels separate clearly. This is a substantial improvement from 05. However, the broad white support and receiver faces in [04-base-cradle](bastion-native-06/04-base-cradle.png), also visible in 02, still read close to plain color regions; their finish remains much less developed than the metal. Small bolts, bevels and access panels help, but do not close the earlier large-surface finding. |
| Lighting and integration | **4.0** | The unchanged native light now reveals round metal response without the earlier broad polygonal bands. Bores separate strongly from their bright inner rings. White bevels retain form, and the base has a legible ground contact/cast shadow. This score covers the isolated setup only, with no claim about station contact, Aeon sunlight, atmospheric/postprocess exposure or night play. |
| Cohesion | **4.0** | White armor, matte dark parts, restrained metal, teal service panels and amber marks remain a coherent Meridian assembly. The improved metal response strengthens that material language. The small maker/model text in 04 remains subtle; readability at gameplay distance is unproven. |
| Information or physical function | **4.0** | The paired rods/guides, receivers, cradle and bearing communicate a plausible mechanism. [03-open-bores](bastion-native-06/03-open-bores.png) now clearly distinguishes the dark interior from its bright annulus, and oblique 01/05 views show recessed mouths. [05-posed-recoil](bastion-native-06/05-posed-recoil.png) retains connected supports with no obvious gross intersection at the shown pose. It does not demonstrate a live muzzle shot or continuous clearance. |
| Motion | **Unscored — pending** | View 05 is one endpoint at yaw 0.45 rad, pitch 0.68 rad and port recoil 0.60 m. It cannot establish recoil travel/return, continuous joint behavior, flicker or LOD. No score for those absent observations enters the mean. |

Mean: `(4.0 + 3.5 + 4.0 + 4.0 + 4.0) / 5 = 3.90`.

## Closure of the three native-05 findings

1. **Broad faceted curved-metal response — closed.** The difference in matched
   01 and 03 is clear: continuous highlights replace the conspicuous alternating
   flat bands. Profile 02 also reads as a round machined barrel. Some polygonal
   silhouette at the dedicated mouth crop remains consistent with the modest
   geometry budget; it is distinct from the corrected shading failure.

2. **Pale bores resembling filled faces — closed as a readability issue.** In
   matched 03, the former pale interior is now dark and clearly separated from
   the annulus; 01 and 05 give supporting oblique depth cues. The near-frontal
   dark interior does not expose every internal surface, so this finding's
   closure is not a claim about unobstructed live fire or bore collision.

3. **Large manufactured-surface finish — remains open.** The primary remaining
   evidence is 04: the large white outer trunnion plates and receiver shoulders
   are still visually close to their 05 appearance, while metal has gained a
   convincing finish. This is the reason for the 3.5 materials score and the
   below-bar mean. It is a finish limitation, not a new geometry defect.

The next bounded pass should address the actual-scale painted surface response
on those broad faces: restrained, readable paint/roughness/normal variation or
purposeful existing panel-edge treatment. Preserve calm white armor and the
successful metal/bore changes. Uniform noise, extra dirt everywhere or added
geometry solely to raise a score would not address this observation. Reinspect
the same 04 close view and 01/02 use-scale views after the finish change; retain
this exact 06 record.

## Evidence boundaries

03 and 04 are explicitly declared detail crops, so intentionally cropped parts
of the complete asset are not framing failures. The endpoint pose shows no
obvious detached joint or gross mechanism collision, but neither this review nor
its score extends the separately reported CPU motion tests.

**Actual station placement/scale, continuous recoil/return, the 200 ms beam and
working muzzle, gameplay authority, phone readability and performance remain
pending separate evidence.** Native-06 is visibly improved and closes two finish
issues; it is not final asset or game acceptance.

PNG SHA-256 receipts:

| File | SHA-256 |
| --- | --- |
| 01-wide.png | `45693cd6be52e4680b7bbdb79d4f70e17b90c7beb8901237e6096ca4e63a07fa` |
| 02-side.png | `92f56f598055c817db2129f90b77041c230a0bd9ea138b8950703a36fbc6ceb7` |
| 03-open-bores.png | `c65e5a505dd38fdbbcf94358736e8de451c95b165167d0bdd3c35ec942e65205` |
| 04-base-cradle.png | `5d5a3972f49f3d769b659c07fc9b7719b7cd0f25247af6b3e83fcf672286dc73` |
| 05-posed-recoil.png | `cfd0f1f61d4d57e73c2844eeda39128780ce20758e15b335dc85becbf5db135c` |
