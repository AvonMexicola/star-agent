# Gannet Art11 — independent native visual review

**Changes required for final art acceptance.** Art11 improves the primary hull form and closes the previous studio framing and visible-mechanism evidence gaps. It still falls below the required visual mean and the stricter silhouette target. The six applicable criteria average **3.90 / 5**, with no item below 3. Silhouette is **4.1 / 5**, against the brief's **4.5** requirement. Retain this as a development checkpoint; do not label it accepted art or completed gameplay.

Reviewer: `/root/kestrel_reviewer`, independent of the Gannet hull, materials, studio and mechanism author. I previously authored the separate main-game medium lamp helper and some gameplay fixtures. Those implementations and their acceptance are explicitly excluded. This review used existing images/video and CPU decoding only; I changed no source, asset, camera, light, service or original evidence and launched no browser/GPU job.

## Identity and inspected evidence

- Capture source supplied by root: `5802948bc4da79af473b91d53f7a429623593b27`. At review time the root worktree had advanced to `f08fbc1a23ac504fb9f99a20cccb03379a10fe70`; the Gannet asset, wrapper, systems, studio and native fixture paths have no diff between those commits. This review follows the captured asset, not later integration changes.
- I independently hashed the captured build's `models/gannet.glb`: **`51f5578cc89f863453f937c7af5afb6bcee71fe4c4ef6a1e40105bd271bdaef1`**, **2,439,212 bytes**. Reading its actual GLB records gives **45,394 triangles, 33 mesh primitives, 98 nodes**, three 1024×1024 WebP maps and one 512×512 WebP image. It meets the individual asset budget.
- Captured Burrow: **`831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468`**, 2,175,556 bytes / 21,526 triangles. The two complete assets total **66,920 triangles / 67 primitives** before culling or batching. This is not a fully loaded freight/scene measurement.
- I inspected **all 21 original PNGs** in `/tmp/star-agent-gannet-native-art11/evidence`: exterior, side, top, rear, underside, cockpit, cabin, bay with Burrow, lowered platform; hatch opening/open/closing; gear retracting/stowed/deploying/deployed; portrait exterior/top/cockpit/left/right.
- I read the full retained Art10 review and directly compared its original exterior, side and cabin frames. Its five-item static mean was 3.62, silhouette 3.7, and motion was unscored. Changed studio layout/projection prevents a strict pixel comparison; this is a visual comparison, not an image-diff result.
- Desktop originals are **1440×900**, portrait originals **390×844**, configured DPR 1. The original VP8 video is 1440×900, **28.600 seconds**, nominal 25 recorded frames/s. That rate is recording metadata, not application FPS.
- `state.json` records **ANGLE / AMD Radeon 860M Graphics / radeonsi krackan1 ACO / OpenGL ES 3.2** and `diagnostics: []`. The native fixture collects page errors and console errors, not console warnings. Root reports the run passed 1/1 in 31.2 seconds, 34.6 seconds total; I did not rerun it. The fixture specifies `/usr/bin/chromium`; this receipt does not record its exact browser version.
- The final visible-frame counters are **13 calls / 38,742 triangles**. These are one frame's rendered counts, not the full assembled model or sustained performance evidence.

The original files, video, captured assets, compared Art10 images and all decoded samples are inventoried in `/tmp/star-agent-gannet-art11-review-evidence/evidence-manifest.json`, SHA-256 **`1c12fb3986310c00174bd24cdeae9f36aa53db646ef5b2a135f680affc220d9e`**. Originals remain unchanged.

## Scores

| Applicable criterion | Score / 5 | Independently observed evidence |
| --- | ---: | --- |
| Silhouette and scale | **4.1** | The former continuous side slab is now a clear forward power/gear body, recessed thermal waist and aft drive housing. The roof has a better front/service/rear hierarchy and the nozzles read as drives. Human and Burrow references communicate a useful medium transport. At the side and quarter views, the large simple fin wedges, broad cowl caps and abrupt cockpit/shoulder steps still read as an assembly of basic volumes. This is a substantial improvement, but not yet the 4.5 primary-form target. |
| Materials and detail | **3.6** | Graphite structure, petrol access plates, metal rims and narrow amber guides separate correctly; fitted thermal blades, lid returns and darker real nozzle recesses improve construction. Large pale cowl/fin faces remain nearly uniform at the inspected distance. Cabin pads, wall armor and furniture still share a similarly hard, bright response; the cabin is the least finished area. Thin bright metal outlines do too much of the work of describing joints. |
| Lighting and integration | **3.5** | Exterior cast shadows ground the overall ship and the cockpit remains legible. Bright cowl and ceiling response compresses relief. In the bay the tires have little readable contact darkening; cabin furniture/floor junctions are also weak. These are native-studio appearance findings, not proof of floating geometry, bad collision or a specific texture defect. I have not assessed the separately implemented game lamps. |
| Cohesion | **4.0** | The ivory/graphite/petrol palette, restrained mint/amber, transport bay and Meridian identification belong together. The new drive construction improves family consistency. Sparse exterior finish and plain cabin furniture still limit consistency of detail across the whole asset. |
| Information or physical function | **4.2** | All four desktop MFD faces and their values are visible at the actual pilot eye. Portrait shows the two central faces and provides successful left/right inspection views of the outer faces. No central opaque strut crosses the main forward view. The complete phone top view clears the controls. Lift/hatch state and the Burrow reference communicate the transport function. Small portrait text remains fine; studio readouts/poses do not prove gameplay state, physical boarding or input usability. |
| Motion | **4.0** | This recording visibly shows hatch opening and closing, loaded lift lowering and raising, and all four gear assemblies retracting and deploying. The sampled poses progress in the expected direction, settle at coherent end states and show Burrow tracking the lift without an apparent jump. Gear travel is simple straight retraction; the small underside presentation does not expose every internal mating surface. No LOD traversal is shown and one-second sampling cannot rule out brief flicker/contact faults. |

**Six-item mean: 23.4 / 6 = 3.90.** For comparison only, the first five items average **3.88**, versus Art10's 3.62. All six criteria are applicable; none receives a free score from a build or an unexamined test.

## Closures and remaining work

1. **Primary hull form: improved, acceptance still open.** The long unbroken dark pontoon is visibly gone, and the waist, tapered forward housing and fitted rear drive are successful. Preserve these changes. The remaining shape issue is concentrated in the broad fin/upper-cowl silhouettes and the stepped transition from the narrow cockpit to the shoulder/roof. Refine those few connected forms so their rake, thickness and roots read as one supported transport shell in `desktop-side.png` and `desktop-exterior.png`. Keep the occupied pressure cell, clear bay, gear/hatch envelope and canonical eye authoritative. Adding further tiny markings does not address this silhouette finding.

2. **Broad-surface finish/contact: partly closed, still the largest overall quality limit.** The new thermal pocket, gasketed lids and recessed nozzle interiors are readable improvements; the old pale drive-disc concern is closed in the reviewed rear views. Now concentrate finish on the remaining large cowl/fin faces and the cabin's pads, cupboard bases and ceiling junctions. Give pads a distinct rough compliant finish and meaningful seams; retain clear coating/structural-metal separation at useful viewing distance. Inspect existing AO and receiver/contact behavior at tire/floor and furniture/floor joints before adding detail or changing exposure. The current images do not identify which map/light setting causes the weak contact, so no unverified diagnosis is asserted.

3. **Studio framing: closed for the tested views.** Desktop shows all four displays. Portrait top clears the header and mechanism bars; portrait forward/left/right views expose each MFD without moving the eye. Recorded eye error is approximately **0.000000384 m** at `[0, 2.95, -8.4]`, with 60° FOV. Every recorded chrome-overlap list is empty. Fine portrait footnotes remain small, but the previous obscured/cropped critical faces are no longer an evidence blocker. This is not acceptance of the separate main-game camera.

4. **Hatch/gear evidence gap: closed for the nominal studio cycle.** The new rear and underside views make both directions visible, so motion can be scored. No additional browser capture is requested for this bounded review. A studio reference rover following a platform is not physical loading, tire support, mining, reverse reloading or carried-flight acceptance.

## Motion examined and limits

I CPU-decoded and inspected **29 ordinary original-size frames**, source frame indices 0, 25, …, 700, at exact PTS **0 through 28 seconds**, one-second spacing. No crop, rescale, interpolation, generated frame or image editing was used. Decode used `ffmpeg -hwaccel none -threads 2`, filter `select=not(mod(n,25))`, and `-fps_mode passthrough`. PTS values were independently read with ffprobe. Output is `/tmp/star-agent-gannet-art11-review-evidence/motion/second-NN.png`.

| Recorded PTS | Visible progression |
| --- | --- |
| 0–3 s | Initial loading/viewport resize, exterior/rear/top and settled desktop cockpit. Initial loading pixels are not scored as an art fault. |
| 4–7 s | Rear hatch opens: displayed 13% → 44% → 69% → 100%; the actual leaves withdraw and expose the bay. |
| 8–11 s | Burrow and platform descend together; displayed lift 1.15 → .72 → .30 → 0.00 m. |
| 12–15 s | Rear view shows the loaded platform rise: .21 → .64 → 1.07 → 1.39 m, followed by the 1.40 m settled state. |
| 16–19 s | Rear hatch closes through 97% → 64% → 30% → 0%; the subsequent underside frame is secured. |
| 19–24 s | Underside shows gear deployed → retracting → stowed → deploying → fully deployed. |
| 25–26 s | Second retraction returns to the recorded portrait stowed pose. |
| 27–28 s | Portrait cockpit forward view. Separate original PNGs cover the short left/right looks between these samples. |

This is a complete nominal-cycle sample sequence, not continuous inspection of every video frame. I saw no gross jump or visible collision in those samples; the one-second gaps and small underside view prevent a certification of every transient/contact. Video compression is not treated as texture detail or shimmer. The inspected native studio does not establish actual lighting at a destination, chair-to-rover passage, controller/keyboard/native-touch journeys, inventory persistence, secure carriage, launch/landing, station fit, LOD behavior or performance. Separate gameplay evidence remains required by the brief. Cees retains product and release acceptance.
