# Independent station exterior review — baseline and geometry checkpoint

7 September 2026. Reviewer session: `/root/kestrel_reviewer`, separate from the builder. **Legacy silhouette: 3.0/5. Authored silhouette: 4.0/5.** The authored structure is a useful development checkpoint: its continuous pressure ring, truss spokes and concentric bearings clearly improve the inherited outline. **Final art acceptance: no.** Unique material finishing, complete function/motion review and hardware timing remain pending; two measured overview frames exceed the orbit triangle budget.

This is an assessment of the actual game renders below, after reading `QUALITY.md`, `STATION-PIPELINE-MEMORY.md`, the station runtime and the builder's production brief. It does not certify a finished station, flight integration, controller/touch operation, collision clearance through all poses, or the material recipe. Existing Atlas/Kestrel review evidence and production source were not changed.

## Evidence and identity

The original port 5178 preview was unavailable. The first browser launch succeeded outside the sandbox but its first GET returned `ECONNREFUSED`; no app page rendered. The builder supplied production 5400, whose default exterior remains the legacy one. An initial 5400 attempt was then **invalidated by visual inspection**: the asynchronous start transaction restored cockpit mode and covered the lower station. Its first camera was also overwritten. Both failed attempts remain under [invalid-attempt-01](invalid-attempt-01/README.md) and [invalid-attempt-02](invalid-attempt-02/README.md); their images and counts are excluded from this review.

The corrected [capture fixture](capture.spec.mjs) completed **1/1 in 1.8 minutes**, including both page loads, on Chromium 151.0.7922.173, **ANGLE / AMD Radeon 860M / radeonsi krackan 1 ACO / OpenGL ES 3.2**. All ten images are 1440×900 at render scale 1. Both variants recorded zero browser console warnings, console errors and page errors. The runner's terminal `NO_COLOR`/`FORCE_COLOR` notice was not a browser diagnostic. No restricted Chromium startup was attempted for these captures; each launch used the project's approved outside-sandbox route.

The isolated review context used `/?dev=1&start=orbit&ship=nomad&intro=0&debug=1&seed=7291`, adding only `&stationExterior=1` for the authored counterpart. It waited for readiness **and transit completion**, hid UI, switched to a stationary first-person camera and removed the reviewer ship position. Before each screenshot it verified the actual camera within 0.1 mm of the requested station-relative position, first-person walk mode, and `shipVisible=false`. Every overview also projects all eight corners of a conservative combined envelope X±1350/Y±1500/Z±1500 to within 90% of the viewport. Ring angles were reset before each pose and then continued their normal runtime updates. Camera fixtures are not a gameplay journey.

Legacy source: `8576e994b8e03d8987ac487fd72e609062bbae04` in the read-only dev tree. Its `station-architecture.js` is unchanged in the preview branch; the new loader is opt-in. Runtime reports `exterior:legacy` or `exterior:geometry-review` as appropriate. Served hero and LOD bay hashes match the original dev-tree bytes in both variants:

- Bay hero: `59c4e38845f2ce6d93e25bc7e7f5ac2eb709591a06a1fdeac464ad2dde03863d`.
- Bay LOD 1: `adb8019a1c76b2bd684c4c46997718b793a61f7ba7cd214300e082227d54ce3b`.
- Authored exterior: `079f7262e992ffaadd56c4ad16c201b69bb23f0664cf19ff2e692312444334a8`.

Exact renderer, pose, ring-angle and served-byte records: [legacy](legacy/evidence.json), [authored](authored/evidence.json), [review index](evidence.json). The independently decoded [baseline audit](geometry-audit.json) and [candidate audit](candidate-audit.json) include vertex bounds, resource counts and source identity. Their adjacent `.mjs` scripts are reproducible read-only audits; candidate decoding includes normalized quantized positions and node transforms.

## Repeated cameras and actual frame costs

Coordinates below are metres in the complex frame, +Y up; each pose uses `station.baseQuaternion`, `station.centre` and `station.up`, with 52° vertical FOV. The quarter eye was moved back once by the common conservative fitter, identically for both variants. The other four eyes were unchanged. These are the exact final cameras to repeat.

| View / own screenshots | Eye → target | Legacy draws / triangles | Authored draws / triangles |
|---|---|---:|---:|
| Quarter: [before](legacy/overview-quarter.png), [after](authored/overview-quarter.png) | [−4484,2484.3,−4956] → [0,−35,0] |231 /365,314|160 /439,858|
| Broadside: [before](legacy/overview-broadside.png), [after](authored/overview-broadside.png) | [0,900,−6000] → [0,−35,0] |213 /317,186|142 /391,730|
| Ring face: [before](legacy/overview-ring-face.png), [after](authored/overview-ring-face.png) | [−5600,1100,−1800] → [0,−35,0] |234 /360,578|163 /435,122|
| Berth 05: [before](legacy/berth-05-scale.png), [after](authored/berth-05-scale.png) | [−5,35,−630] → [−95,−4,−520] |386 /530,382|345 /605,286|
| Bearing: [before](legacy/bearing-scale.png), [after](authored/bearing-scale.png) | [−1420,250,−380] → [−1110,0,0] |225 /374,410|164 /449,074|

These are actual **whole-frame** renderer counters, including the world and render passes; they are not station-only figures or FPS measurements. Both bay captures activated hero pods 05 and 06 and retained 26 LOD batches. The overview resource difference is exactly+74,544 triangles/−71 draws, consistent with the independently counted exterior change.

The legacy exterior is 22,116 assembled triangles across 93 nominal colour draws. The authored kit is 68,772 stored triangles, **96,660 assembled triangles**,15 stored/22 assembled primitives,7 authored materials, no embedded images, and 3,697,952 bytes. It meets the brief's individual kit caps of 100 k/36 draws/4 MB. Its actual quarter and ring-face frames exceed `QUALITY.md`'s 400 k orbit limit by 39,858 and 35,122 triangles respectively. No frame-time pass is claimed. The bay template itself is 89,944 triangles/3,804,976 bytes; LOD 1 is 6,932 triangles/250,796 bytes. These current measured numbers supersede older pipeline-memory examples.

## Visual assessment and ranked work

The legacy's two rings are recognizable, but the 12 m spokes, tiny direct bar intersection at each hub and 480 m rectangular connector bars read as a structural diagram. The repeated 120-panel wheel outline resembles a chain of blocks. Existing detailed hangars provide the strongest scale and finish cues.

The candidate preserves that recognizable layout while supplying a continuous rim, separate concentric mechanical assemblies, deep spoke roots, paired truss chords and an underslung service core. It reads as a larger industrial structure. The bay close view retains the existing hangar exterior and shows more credible support behind it. Metric scale remains consistent with a 42 m-wide landing deck and a roughly 3 km ring diameter. A direct 1.8 m human comparison at the new bearing/rim was not captured, so human-scale detail acceptance remains pending.

| Criterion | Authored checkpoint | Evidence / limit |
|---|---:|---|
|1. Silhouette & scale|4.0|Recognizable paired-ring port; stronger rim and bearing mass. Centre remains dominated by a uniform rack of arms.|
|2. Materials & detail|2.8|Geometry supplies seams, bevels and recesses, but broad bearing/arm surfaces are still very uniform. Unique finishing is explicitly unfinished.|
|3. Lighting & integration|3.5|Readable in actual planet-oriented light; no shader errors. Bearing plates and joint contacts look flat next to the richer inherited bay.|
|4. Cohesion|4.0|Ivory, graphite, steel and restrained service accents fit Aeon's existing bays. Rim striping is more repetitive than the bay design.|
|5. Function|Pending|No independent continuous docking, concourse or full moving-collision journey in this camera review.|
|6. Motion|Pending|Opposite runtime ring-angle signs are recorded; these reset-and-settle views cannot certify timing, flicker or LOD transitions.|

There is **no complete rubric average** and no final merge recommendation from partial scores. Geometry direction is suitable for the next iteration and a clearly labelled development preview.

1. **Close the real orbit triangle budget.** In `blender/build_station_exterior.py` and the exterior runtime, introduce a cheaper distant representation that preserves the rim/backbone silhouette while removing subpixel truss webs, small saddle parts and bevel subdivisions. At this quarter view, an exterior of approximately 55 k triangles would fit the existing 400 k whole-frame limit. Preserve separate ring motion and collision ownership; render LOD must not remove physical obstacles. Confirm timing in an isolated hardware run afterward.
2. **Give the centre a stronger hierarchy.** In the three overviews, the ten identical pressure cassettes and 20 arms still dominate as evenly spaced rungs. Reallocate some small repeated geometry to larger changes in the existing central service volumes: deepen/step the lower housings of the central cassette pairs at X±95/±285 and taper toward the outer bays. Keep these changes below the occupied hub, while retaining 190 m pitch and all bay origins. Use stronger arm heels at the spine to make load collection visible from kilometres away.
3. **Resolve the bearing's oversized plain surfaces.** The close bearing image is substantially better than the original intersection, but the large capped rectangular torque tube and broad unbroken root plates still look like stock forms. Keep the structural tube and clearance, but give its exposed end a deliberate chamfered/octagonal cap and recess the service face. Carry a few large access divisions across the root armour; use the later normal/roughness atlas for small fasteners instead of spending triangles on distant bolts. Preserve the real separate bearing/rotor gap.
4. **Make six structural sectors outrank the rim's repeating pattern.** The continuous annulus is successful; retain it. The current `k % 8` paint blocks and identical lids produce 12 equally strong interruptions around 96 sectors. Align the strongest breaks with the six spoke collars, quiet the intermediate joints and vary service markings by role. This is primarily material organization, with minimal silhouette change.
5. **Bring close construction into the bay's finish language.** The authored berth background and bearing plates have much less surface variation than the inherited hangar. Complete the approved finishing workflow with material-specific roughness, plausible contact darkening, restrained wear and measured-scale labels. Keep paint diffuse, reserve metal response for actual metal, and avoid emissive paint or extra fill lights. Re-review actual bearing, ring-wall and bay captures after finishing; the recipe's execution alone will not constitute a visual pass.

## Structural and flight constraints for subsequent work

The independent baseline vertex audit gives neutral exterior bounds X±1150/Y±1476/Z±1476. Each rotating ring reaches radius 1476.285 m across all angles and occupies local axial−40..41.5 m or−41.5..40 m. The candidate's decoded neutral assembled bounds are X±1257/Y±1494.050/Z±1494.050; its fixed structure reaches Y−227..142.994 and Z−508..508.004. These broad envelopes are for framing and planning, not solid collision boxes.

- Preserve the 20 exact bay frames: X−855 through 855 in 190 m steps, banks Z±520, with the positive-Z bank yawπ. Each complete bay remains 149.900×39.450×89.600 m; adjacent full template AABBs therefore leave approximately 40.10 m between them. Do not spend that entire gap without testing the largest ship sweep.
- Preserve `LandingDeck` X−21..21, Z−22..26, topY−8, slab bottom−8.4; `LandingPad` [0,−8,2]; local `ApproachPoint` [0,−4.8,−112]; local `DoorTrigger` [0,−4.8,−272]; both named door leaves and `DoorsOpen`. The negative-Z bank's approach/trigger become complexZ−632/−792; the positive-Z bank mirrors them to+632/+792. These outward lanes need a full ship envelope, not a centreline-only check.
- Keep passenger arms behind/under their bay. Preserve the existing±12 m side walking routes, aft Z 20 cross-route, door opening, elevators and cargo-screen access. New exterior geometry must not introduce a competing deck or penetrate occupied space. Hub occupied bounds are X±22, Z±19, floor−8, ceiling+1.5; test actual triangles against the room, including long faces whose vertices all lie outside it.
- Retain stationary versus rotating ownership. The rings rotate around localX at opposite 0.00045 rad/s (approximately 3.879 h/revolution). A swept spoke plane is not empty just because a still frame has a gap. Keep fixed attachments outside the full moving sweep except the intended bearing assembly; validate the new collar/throat clearance with quantization included. The legacy narrow axial envelope is not sufficient for the enlarged candidate.
- Keep all 20 berth colliders active regardless of visual LOD, preserve the 180 m hero selection, shared immutable geometry/BVH and 26 merged LOD batches, and retain the 600 km exterior horizon. GPU positions must remain local after subtracting the actual double-precision camera origin. Ring collision must use the current individual rotation.

The source/vertex measurements establish constraints and costs. They do not replace the builder's physical tests or a later independent playable/motion review. No production source, asset, merge or publication was performed by this reviewer.
