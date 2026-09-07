# Astra follow-up: shop enclosure and stock

Reviewer: **Astra (`gpt-6-astra`)**, 2026-09-06. User-authorized reviewer
substitution remains in effect; QUALITY.md thresholds are unchanged.

**Final affected-shop visual result: PASS, 4.00/5 at `025e587`. Whole PR 20
MERGEABLE: NO.** The inherited orbit/coast findings and performance tails remain
unresolved. The final rubric and evidence limits are appended below; the
intermediate rejected lighting result is preserved in its original context.

Candidate **29885c90d4a431f139dd4e0844e81dc5d1ae7d7f** verified with Git.
Independently fetched preview bundle `/assets/index-BJaVs6Cv.js`, SHA256
`e0a95c936d4c421e3deee8e51b1fa506255de0f9931c984398048c58b8267c49`.
The [435f116 review](station-shop-branding-astra-review.md) remains a historical
**3.50 failure** and is not replaced by this follow-up.

## Status at the first follow-up capture

**Not accepted yet. Motion evidence is pending.** The three original shop
findings are materially addressed, but the brighter display lighting exposes
clear horizontal banding on rear posters and sidearm mounting tiles. Lighting
remains **3/5** pending resolution. Do not infer a complete rubric or a merge
approval from this intermediate record.

I independently ran:

```sh
node scripts/concourse-review.mjs --url http://127.0.0.1:5260 --out /tmp/star-agent-shop-enclosure-astra-views
```

I opened and visually read all fourteen images: `overview`, `armory`,
`components`, `armory-interior`, `components-interior`, `armory-brochures`,
`components-brochures`, `armory-banner`, `components-banner`, `elevator-closed`,
`elevator-open`, `seating`, `hangar-elevator-closed`, `hangar-elevator-open`
(all `.png` in that directory). I read the accompanying `evidence.json`.
Capture timestamp: **2026-09-06T18:45:06.524Z**. AMD Radeon 860M / ANGLE OpenGL
ES 3.2, **1440×900, render scale 1**. Zero browser errors or warnings.
GPU lane was released after this job; no concurrent browser jobs were launched
by this reviewer. Unchanged world context was not recaptured.

## Corrective source and observed result

I read the diff from 435f116 through 29885c9, the updated asset contract,
actual-GLB tests, enclosure production record and prepared motion contract.

- The continuous roof skin, underside cassettes, vents, cross beams and
  end-wall downstands now make both shops read as enclosed rooms. The central
  glazed concourse stays visually separate. Entry/interior/banner views confirm
  the visible correction; this is not inferred solely from ray tests.
- Ivory rear lettering is readable in both shops. Existing shop lights and
  their visible fixtures sit below the ceiling. Carpet, counter and stock now
  receive a more balanced wash, although the new banding needs correction.
- Sidearms, two long arms, handled equipment cases and torches replace repeated
  rifles; the components shop has visibly different filters, avionics, scanner
  and repair stock. Case lids, latches and handles read in the interior images.
  Shelf names match the authored categories. Small sidearms read as sidearms at
  the entry viewpoint rather than miniature rifles.
- Brochures remain seated in physical pockets with natural proportions and
  intact margins. Banners retain visible mounting and bottom rails. Elevator
  endpoint images show no apparent change in the preserved cabin geometry.

## Newly observed rendering issue

Horizontal light/dark bands cross the helmet and kit posters in
`armory-interior.png`, the drive poster in `components-interior.png`, and the
ivory sidearm backing tiles in `armory.png`. These are much stronger than in
the previous independently captured candidate, and cut across printed content
rather than reading as natural paper texture. Small stippled patches also appear
on the front horizontal beam in the banner views.

Investigate `src/station-concourse.js` shop shadow configuration and the print
backing geometry/material relationship in `src/station-shop-graphics.js`.
Grazing-angle shadow acne is a plausible cause, **not yet a confirmed diagnosis**.
Use a controlled shadow/bias comparison on the same camera, preserve genuine
contact shadows, and inspect full-size poster, shelf and banner views after
correction. Do not accept dimming the displays back into illegibility as a fix.

## Performance evidence read, not independently rerun

The integration lead's latest hardware file is
`/tmp/star-agent-shop-enclosure-performance/evidence.json`, timestamp
2026-09-06T18:44:07.278Z. I read its environment, completion status, methodology
and timing/count fields. Chromium 151.0.7922.173, AMD Radeon 860M / ANGLE GL,
1440×900 at render scale 1; 30 warm frames, 61 valid hangar samples and 60 hub
samples. Zero browser errors, warnings, diagnostics or capture failure.

| View | Draws / triangles | GPU median / p95 ms | CPU callback median / p95 ms |
| --- | --- | --- | --- |
| Hangar | 505 / 684,953 | 8.387 / 8.626 | 5.700 / 7.000 |
| Hub | 269 / 479,478 | 4.934 / 5.286 | 5.050 / 5.500 |

Both report 16.7 ms RAF median/p95 separately. This single sample meets the
affected hangar timing/count budget; it does not invalidate previous slower
samples, prove an exact feature cost, or establish performance on other hosts.
CPU and GPU durations overlap and are not summed. The inherited orbit draw
budget and coast-vista findings remain outside this corrective shop pass.

Motion scoring and final disposition will be appended only after the available
motion evidence has actually been inspected. No new physical journey, phone UI
test or unit/build run was performed by this reviewer in this follow-up so far;
the integration lead's reported passes remain attributed to that lead.

## Final independent review — 025e587

Final candidate **025e587e63a6241182b10376eb6e83b68515fe81** verified with Git.
I independently fetched the served `/assets/index-mk6QIuGf.js` and verified
SHA256 **bde5924fa0c3bacbe03f03a87ea2946e0ff4583c207fa50a7c81f8b27dcec0e7**.
The only runtime difference from 29885c9 is the two existing shop spotlight
shadow settings in `src/station-concourse.js`: 1024² maps, depth bias −0.001,
normal bias 0.04. I read that corrective diff. Geometry, artwork, materials,
light count, interactions and animation code are unchanged.

I ran the fourteen-view capture script again, using
`--out /tmp/star-agent-shop-shadow-astra-views`, and opened/read **all fourteen
PNGs**, with the same filenames listed above. I read its `evidence.json`.
Timestamp **2026-09-06T18:52:09.771Z**, **1440×900 at render scale 1**, AMD Radeon
860M / ANGLE OpenGL ES 3.2; zero browser errors or warnings. Both capture runs
were sequential within the team's GPU lane. No new world-context tour was run.

The previously conspicuous stripes are gone from the helmet/kit/drive posters
and sidearm tiles. Printed margins and artwork remain intact. Contact shadows
are still visible beneath counters, shelf contents, frames and racks; the fix
has not simply disabled shadows. The thin stepped edge on the central rack's
wall shadow remains visible at full size, but is now a local polish issue rather
than a pattern crossing the primary merchandise graphics. The front beam's
speckled patches are also cleared in the final banner views.

### Motion evidence actually inspected

I read the completed [motion ledger](station-shop-motion.md), the recorded
environment, test result JSON and extraction metadata. I independently opened
and read all **ten lossless PNG contact sheets** under
`/tmp/star-agent-shop-motion/windows/`: walking (one), elevator-entry (two),
hub-transit (two), shop-purchase (two), return-transit (two), cargo-reload (one).
I additionally opened full-resolution `shop-purchase/frames/frame-0034.png`
and `frame-0035.png` to read the brief before/after purchase states.

These are **author-produced motion captures assessed by me**, not my own
recording. The source is the 45.08-second, 1440×900 VP8 WebM recorded at
**29885c9**, SHA256
`af29f8ee0eaeb4af02f7ad14645d0348cf3014a46e094155ffaad36b1ef589f8` as retained
in the ledger. Its renderer attachment verifies AMD hardware and a 1440×900
drawing buffer at scale 1. The test result reports one pass in 48.598 seconds,
with no test errors. It is not a capture of the final shadow settings.

Observed intervals: 6.0–7.9 s straight hangar approach; 11.0–14.9 s elevator
area and physical cabin entry; 14.0–17.9 s outbound fade and hub arrival;
21.0–24.9 s shop approach/open/purchase/close; 31.0–34.9 s return selection,
fade and berth arrival; 37.0–38.9 s terminal approach and intentional reload.
Straight walking enlarges nearby objects continuously; cabin entry preserves
the room's scale; fades cover destination changes; the shop closes onto the
same counter view. The full-size frames show credits 1500→1150 and delivery
feedback. These concrete observations support raising motion from the previous
evidence-limited 3 to a **bounded 4**.

Limits remain explicit: opening leaves are mostly at the frame edge, so this
does not establish a complete frontal door-animation review. Fixture heading
snaps at approximately 13.1, 21.4 and 24.7 s are intentional test turns, not
runtime camera defects. The 38.4 s reload is deliberate. Ten-Hz extraction
from nominal 25-fps video cannot exclude between-sample flicker, and the windows
do not cover every second. I did not play or audit every original video frame.
The **final shadow settings have still-image evidence only**, so this score
does not certify their temporal stability. Interaction/geometry continuity is
applicable because the final diff changes only shadow settings.

### Final affected-shop rubric

| Criterion | Score | Basis |
| --- | ---: | --- |
| Silhouette & scale | 4 | Enclosed shops have a clear ceiling/stock/counter hierarchy. Distinct handheld sidearms, long arms, cases and component families read at plausible scale. A5 holders and banners remain physically supported. |
| Materials & detail | 4 | Case latches/handles, ceiling cassettes/vents, paper graphics, worn carpet and differentiated stock now provide sufficient finished detail. Broad ceiling panels still have room for subtle wear variation. |
| Lighting & integration | 4 | Rear identity and stock are readable; poster banding is removed while contact shadows remain. Local rack-shadow stepping survives as polish, not a dominant artifact. |
| Cohesion | 4 | Tenant colors, consistent typography, campaign imagery, shelving and room construction feel like the same station. The central glazed hall remains distinct from enclosed retail rooms. |
| Information design / function | 4 | Physical category stock and labels agree. Existing desktop/phone menu hierarchy, delivery/implementation limits and feedback remain clear. Purchase frames confirm the visible transaction. A brief first-open heading font swap is a minor follow-up. |
| Motion | 4 | Independently read consecutive samples support continuous walking, entry, concealed destination transfer and stable menu return for unchanged interactions. This is a bounded result with the framing/sampling/final-shadow limitations above. |

Arithmetic: **(4 + 4 + 4 + 4 + 4 + 4) / 6 = 4.00**. No criterion below 3.
The affected shops meet the numerical visual threshold. This is not a claim
that the whole game or every inherited asset scores 4.

### Ranked remaining findings

1. **Whole-PR blocker, inherited performance:** orbit remains 477 draws against
   a 300-draw budget in the earlier independent context tour. The latest final
   candidate sample also has hangar CPU callback p95 **12.0 ms** and hub p95
   **10.1 ms**. GPU medians alone do not clear those tails. Profile visibility,
   batching and callback work in `src/station.js` and the render loop using
   `scripts/station-performance-check.mjs`; retain slower samples and establish
   a documented budget disposition. The shop-only shadow change cannot be
   credited with fixing unchanged orbit or hangar work.
2. **Whole-PR blocker, inherited coast presentation:** the earlier independent
   `02-coast.png` still shows a largely flat grassy vista without a readable
   shoreline. Review destination selection using `src/world.js` and the tour's
   sea-facing fixture. Verify an actual land/water boundary and horizon relief
   without inventing a second terrain surface. This correction did not change
   the world, and no new coast pass is claimed.
3. **Shop polish follow-up:** central rack wall-shadow edges retain fine steps
   in the final interior views. Relevant file: `src/station-concourse.js`, shop
   shadow frusta/filtering. Improve texel distribution or filtering if practical,
   then verify poster faces and grounded contacts together and remeasure cost.
   Do not raise resolution indefinitely or regress to the former banding.
4. **UI polish follow-up:** the full-size motion frame at 24.3 s shows a broad
   fallback WATCHKEEP heading, while 24.4 s shows the intended condensed face.
   This brief font swap does not prevent purchasing, but is visible. In the
   shop UI/style loading path (`src/station-shop-ui.js`, `src/station-shop.css`),
   preload/warm the declared display face before first modal display. Verify
   first-open typography with a cold cache. This is an observed visual change;
   its precise font-loading cause was not independently instrumented.
5. **Room polish follow-up:** the repeated ceiling panels are now structurally
   convincing but uniformly clean compared with worn carpet and retail paper.
   `blender/build_station_concourse.py` / the existing station material finish
   could add restrained seam/vent wear or occasional service marks with shared
   resources. Keep the current uncluttered ceiling silhouette and light mounting.

Items 3–5 are follow-ups, not new acceptance blockers for this bounded shop
pass. The limited frontal door and final-shadow motion coverage is also retained
as a validation limitation rather than mislabeled as an observed runtime bug.

### Latest performance and disposition

I read `/tmp/star-agent-shop-shadow-performance/evidence.json`, timestamp
**2026-09-06T18:50:25.555Z**, including errors, discarded-query counters, timings
and counts. Evidence SHA256 reported by the integration lead:
`1cd4d2aca428a8139122fd152e6130ec03adb485ebe44a6696d3f5bb8daa02bd`.
Chromium 151.0.7922.173 / AMD Radeon 860M / ANGLE GL, 1440×900, scale 1;
60 valid queries per view, zero discarded queries or timer errors, zero browser
errors/warnings/diagnostics. This was the lead's measurement, not my own rerun.

| View | Draws / triangles | GPU median / p95 ms | CPU callback median / p95 ms | RAF median / p95 ms |
| --- | --- | --- | --- | --- |
| Hangar | 505 / 684,953 | 7.992 / 9.050 | 7.400 / 12.000 | 16.7 / 16.8 |
| Hub | 269 / 479,478 | 5.314 / 5.754 | 6.500 / 10.100 | 16.7 / 16.7 |

Hangar CPU maximum was 26.7 ms and RAF maximum 33.4 ms. These tails remain in
the result. Neither separate-run GPU differences nor overlapping CPU/GPU times
are an exact cost of the larger maps. Earlier passing and slower measurements
remain historical evidence; this sample does not establish universal performance.

**Affected-shop visual gate: PASS at 4.00. Whole PR 20 MERGEABLE: NO**, pending
the separate inherited world/performance disposition. No user waiver, merge or
deployment is inferred. The original 435f116 failure and intermediate 29885c9
banding finding are preserved. The lead reports the final 24-file unit suite
passes and the prior three relevant browser cases passed; I did not rerun those
checks. Desktop/mobile UI design is unchanged by the corrective diff; my earlier
native-DOM UI captures remain relevant, with their 0.55-scale 3D background
limitation, while the new recorded desktop sequence uses full render scale.
