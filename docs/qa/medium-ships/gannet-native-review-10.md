# Gannet Art10 — independent native visual review

**Changes required.** Art10 visibly corrects the previous material-map routing failure and improves the exterior hierarchy, but it does not meet the medium-ship silhouette target or the static QUALITY mean. The five scored criteria average **3.62 / 5**, with a lowest score of **3.3**. Silhouette is **3.7 / 5**, below the brief's **4.5** target. Motion remains applicable but incompletely examined and is not included in that mean. This is a review of a development candidate, not final asset or gameplay acceptance.

Reviewer: `/root/nomad_cutter`, independent of the Gannet geometry/material author. I authored the separate Stratum asset and a Gannet input fixture; neither is being independently assessed here. No source/art was edited and no live browser, GPU job or server was launched for this review.

## Exact candidate and evidence

- Captured integration source: `40e7866fb28a872076b02c4c1fa60038fa61847d`, supplied by the capture operator. Subsequent runtime work is outside this frozen image review.
- Gannet Art10 GLB: `ca49eb995747a9fa665833729b3a370e757bcb0dd0d7e537695603b8705d6303`. I independently hashed the actual captured build file at `/tmp/star-agent-gannet-native-art10/build/models/gannet.glb`: **2,251,080 bytes**, exact hash match. The asset manifest reports **41,302 triangles, 33 primitives, 98 nodes and four embedded WebP images**. These budget observations do not confer visual credit.
- Manifest source blend: `546a9dafc453087ef9b708bbcaa7bcc667cb6f25f3be71a69eca1f7e3818d7d9`; builder: `4bb92177a23c8a2487feeb7575188e8687d41edc3b38165603380fc7a7548469`; unchanged canonical layout: `9334ef7470c6aa1c0d4da7a2ce91d42191fedfdde00bd8732f15675ad904adb5`.
- I inspected all **13 unedited PNGs** in `/tmp/star-agent-gannet-native-art10/evidence`: desktop exterior, side, top, rear, cockpit, bay with Burrow, cabin, lowered lift, underside and gear stowed; portrait exterior, top and cockpit. I also compared the retained geometry09 exterior, Burrow bay and cockpit images and read its full failed review.
- The operator reports the frozen studio test **PASS 1/1, 26.2 seconds / 29.5 seconds total**, on Chromium **151.0.7922.173**, executable `/usr/bin/chromium`. Recorded `state.json` confirms **ANGLE / AMD Radeon 860M Graphics / radeonsi krackan1 ACO / OpenGL ES 3.2** and `diagnostics: []`.
- Viewports: **1440×900 desktop, 390×844 portrait, DPR 1**. The portrait sequence resizes the desktop page and activates controls with injected pointer input. It is not native-touch gameplay or physical hardware input acceptance.
- The final studio frame reports 11 calls / 34,646 rendered triangles. That is one visible-frame observation, not the complete assembled-asset count or a sustained performance result. No FPS claim is made.

The complete original/evidence hash inventory is `/tmp/star-agent-gannet-art10-review-evidence/evidence-manifest.json`, SHA-256 `3e7122c4bad6a6a974a829824a7ff01e49062849ee1149d2503f2b028c070ced`. It includes the 13 PNGs, state, captured build assets, original video, retained09 review and decoded motion-frame files. Original captures and the prior failed review remain unchanged.

## Scores and comparison

The applicable criteria come from `QUALITY.md`; `docs/briefs/meridian-medium-ships.md` additionally requires silhouette 4.5 before final material detail and separates studio inspection from real boarding, loading and flight acceptance.

| Criterion | Art10 / 5 | Independently observed evidence |
| --- | ---: | --- |
| Silhouette and scale | **3.7** | The enclosed transport volume, outboard drives and measured human/Burrow references read. Fore/aft armor caps and the middle service band add hierarchy over09. Long straight side pontoons, broad repeat-panel roof and simple triangular fins still dominate the exterior/side/top views; the transition from cockpit to load structure and drive ends is insufficiently developed for the 4.5 brief. |
| Materials and detail | **3.4** | Graphite floors/structure, petrol service faces, metal surrounds and restrained amber guides now separate correctly. Large pale roof/cowl and cabin surfaces still have a similar flat, bright response; fine repeated streaks on the dark side structure and a single inset vent do not provide enough fitted construction at this scale. Rear drive collars/throats remain very bright. |
| Lighting and integration | **3.3** | All reviewed views render without recorded diagnostics and the corrected dark floor improves legibility. Broad pale ceiling/cowl highlights suppress relief; wheel-to-floor and furniture contact are weak in the studio images. This is an appearance finding, not proof of an unsupported wheel or collision fault. Actual game lamps/exposure were not assessed. |
| Cohesion | **3.9** | The corrected ivory/graphite/petrol/brushed-metal palette and mint/amber accents now fit Meridian substantially better. The utilitarian bay, labels and restrained guides belong together. Broad simplified exterior panels and similarly hard-looking cabin fittings still limit finish consistency. |
| Information or physical function | **3.8** | Clear central glazing is retained; no opaque center brace crosses the viewed pilot sightline or display faces. The actual Burrow is legible in the bay and lift positions communicate its purpose. The desktop studio crops outer MFD content, and portrait cockpit/top framing hides important information behind viewport edges or inspection controls. This does not certify or reject the separate main-game camera. |
| Motion | **Unscored, applicable** | Recorded frames show the loaded lift moving, but the selected cockpit/cabin camera hides the hatch and gear during their transitions. A complete mechanism/transition score cannot be assigned from these views. |

**Partial static mean: 3.62 / 5.** Geometry09's retained five-item static mean was 3.08, with silhouette 3.2 and materials 2.4. Art10 improves materially on that failed baseline, but the new candidate still misses both the mean 4.0 requirement and the stricter silhouette 4.5 target. No unscored item is treated as a free pass.

## Findings and bounded corrections

1. **Required for art acceptance — primary hull form remains too slab-like.** Reproduce with `desktop-side.png`, `desktop-top.png` and `desktop-exterior.png`. The dark full-length lower pontoon, pale caps and large triangular fin remain a simple stack of long volumes. Introduce an intentional fore/body/aft transition in the outboard cowl: taper or step the forward shoulder, give the middle structure a purposeful waist/service break, and resolve the aft drive collar and fin root into that structure. Concentrate geometry on these few primary forms. Preserve the measured load volume, tire/door/player paths, platform, gear sweep and canonical anchors. More paint strips or unrelated small fittings would not close this finding.

2. **Required for art acceptance — broad fitted surfaces and contact need another finish pass.** Reproduce with the side/top, rear, cabin and bay views. Use deliberate panel edges, gaskets and meaningful service access on the broad cowl/roof; distinguish cabin pads/composites from armor and structural metal. Keep working drive interiors darker and preserve readable machined rim relief. Improve contact and restrained roughness variation at useful viewing distances without compensating for the now-correct UV palette or adding random greebles. The corrected material-family routing should remain frozen and validated through this work.

3. **Required for complete studio/interface evidence — safe framing is incomplete.** `desktop-cockpit.png` crops the outer Flight/Cargo row; `phone-cockpit.png` shows only parts of the central displays with the bottom controls/metadata over their content; `phone-top.png` places the bow beneath the header/view controls. The studio uses its historical 52-degree projection. Root reports that the actual main-game camera is now 60 degrees at the same canonical eye; this report makes no claim about that unviewed game projection. Correct the studio's available inspection rectangle/projection or reachable pan behavior while preserving the physical eye and clear glazing. Recapture the actual pilot route separately; do not move the eye merely to conceal a geometry obstruction.

4. **Evidence gap — complete hatch/gear motion is not visible in this recording.** The lift evidence below is useful and positive. A bounded dedicated view of opening/closing hatch and deploying/retracting gear is still needed before scoring those mechanisms. This is an evidence limitation, not a newly asserted mechanical defect.

The previous large amber/gold floor/edge/MFD-surround failure is **visibly closed**: the actual new bay has a graphite floor with narrow hazard guides, the drive structure reads dark, and the display surrounds read as metal. The no-center-strut improvement is retained. Neither closure establishes the remaining silhouette, finish, camera or gameplay gates.

## Recorded motion actually examined

Original video: `/tmp/star-agent-gannet-native-art10/test-output/gannet-authored-hull-full--1dbeb--views-on-desktop-and-phone/video.webm`. Independent `ffprobe` inspection reports VP8, 1440×900, nominal recording rate 25 frames/s and 23.760 seconds. This is recording metadata, not measured application FPS.

I decoded ordinary full-size frames on CPU, without interpolation, cropping, scaling or image edits, and inspected these exact recorded positions:

- PTS 5s: cockpit while the hatch changes, but the hatch itself is out of view.
- PTS 8, 9, 10, 11s: bay with Burrow visibly tracking the platform downward. Displayed lift height goes 1.19→.77→.45→.03m.
- PTS 12, 13, 14, 15s: rear exterior with the loaded platform visibly raising, displayed .17→.59→1.01→1.33m.
- PTS 17s: cabin during hatch closure; hatch out of view.
- PTS 20 and 21s: cabin with gear/secured end state; gear transition out of view.

These are **12 inspected decoded frames**, including every one-second sample from 8 through 15 seconds. In that visible lift sequence, the reference rover tracks the real moving platform within the bay frame without an apparent jump in the inspected positions. One-second gaps cannot rule out transient flicker or contact faults. I did not inspect the entire video continuously, and neither off-camera telemetry nor end-state screenshots establishes full hatch/gear motion acceptance.

Decoded frames are `/tmp/star-agent-gannet-art10-review-evidence/motion/second-NN.png`, where `NN=1` is PTS 0s. The retained `frame-extraction.log` records exact selected timestamps. The first extraction invocation used an unsupported local `-vsync` option and failed before decoding; the corrected CPU invocation used `-fps_mode passthrough` and completed with exit 0. Neither invocation launched the application.

## Disposition and limits

**Retain Art10 as a labeled development checkpoint; request another bounded hull/finish revision and corrected inspection framing.** No final art acceptance follows from the passing studio test. The unchanged 09 report is retained as the failed comparison baseline; these scores apply only to the exact ca49eb99 export and recorded views.

This review does not independently approve the actual game camera/lighting, physical chair-to-rover route, mining yield, persistent inventory, complete return loading, carried flight/landing, native-touch/controller neutral handling, station fit or performance. Root's separate gameplay tests and another actual-game visual review must supply those claims. Cees retains product/release acceptance.
