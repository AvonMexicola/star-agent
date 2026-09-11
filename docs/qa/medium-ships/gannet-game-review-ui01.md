# Independent Gannet actual-game closure — final-ui01

**Scoped PASS: 4.04/5; lowest applicable item 3.8.** The new rendered MFD closes **G13-GAME-01**. Collection feedback now remains at the cut in the sampled mining interval. The original final13 report remains unchanged at **3.86 / changes requested**; this follow-up does not retroactively pass it or change the separate Art13 studio/silhouette grade.

Reviewer `/root/nomad_cutter` did not author Gannet, the medium light helper, or this MFD correction. Root ran the production game; I independently inspected all **11 original PNGs** and **17 ordinary full-size video frames**, read the recorded state, and calculated its container masses with the canonical production `itemMass` helper. No browser/GPU, production edit, service action or git mutation was performed by this review.

## Exact evidence

Runtime **3cf80ad**, development-enabled main build18 **main-4jz7U8ns**, as declared by root. All **26 capture-time source/model hashes** independently match their before/after record and current files. Gannet is unchanged Art13 `8da0bc2e3da7c8c2a2db7b29957b226fab0ba30eb0155f98d82a3f82c3995e6f` (3,169,484 bytes); clear-windscreen Burrow is `831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468` (2,175,556 bytes).

Originals: `/home/cees/projects/.medium-ships-qa/gannet-controller-final-ui01`. Chromium **151.0.7922.173**, ANGLE / **AMD Radeon 860M Graphics (radeonsi krackan1 ACO)** / OpenGL ES 3.2. Images/video **1440×900**; actual WebGL buffer **1152×720**, scale80%. Input is an injected W3C standard Gamepad plus native focus interruption, not physical controller hardware.

The finalized main VP8 video is **214.08s, 25fps**, SHA `917cac118c58620a4cc6ad4b06a8942749d13901b44340b99a91f44c9272e700`. Eight mining frames at **114.4–120.0s** in 0.8s steps and nine mechanism/flight frames at **72, 73, 74, 167, 170, 172, 201.4, 202.2, 203s** were decoded without cropping, resizing, grading, interpolation or annotations. Video PTS are not app pageTime. The auxiliary 1.4s focus-tab video is inventoried, not graded as game footage.

`/tmp/star-agent-gannet-final-ui01-game-review/evidence-manifest.json` pins every original, source and viewed frame. `/tmp/star-agent-gannet-final-ui01-game-review/frames.json` and `/tmp/star-agent-gannet-final-ui01-game-review/motion-frames.json` retain commands and timestamps. Original media and decoded PNGs remain at their listed paths; the small receipts archive excludes media.

## Closure from actual pixels

**G13-GAME-01 closed.** Original05 `05-controller-ore-transfer.png` visibly shows Backpack **1.6kg**, **0.60kg basalt**, and the successful transfer. Original07 `07-settled-gannet-pilot-return.png` now visibly reads **SHIP STORAGE 136.0kg / BACKPACK 1.6kg** on the physical CARGO MFD. Both agree with this run's committed contents:

- Transfer: **0.6017855069500966kg basalt**, rover bin to pack. With two rations, final pack mass is **1.6017855069500966kg**, correctly rounded to **1.6kg**.
- Ship: canonical construction resources **103kg** plus supplies **33kg**, total **136kg**, counted once.
- This is a new run; its transfer must not be substituted with the old final13 amount **0.5431160913443113kg**. Subsequent fresh-trigger checks add ore to the rover again; the final rover total is **0.49147340997016614kg**, while the transferred pack basalt remains unchanged.

`/tmp/star-agent-gannet-final-ui01-game-review/mass-closure.json` retains the exact nonzero container items, transfer and MFD state. The truthful total labels omit a misleading combined capacity denominator. The separate [independent source audit](/tmp/star-agent-medium-mfd-independent/review.md) established read-only live binding and authority preservation; this report adds the missing actual-image closure for this offline Gannet run.

**Collection presentation corrected in the examined interval.** Original04 and the eight mining frames show two distinct mint beams leaving the front tool region and contacting the outcrop. Bright impact feedback and collection motes remain around the rock/cut faces, with no cabin-directed stream visible in those samples. Ore increases in the actual panel. This closes the prior observed presentation concern for vehicle-bin mining in this view; sparse frames cannot prove every particle lifetime or all viewing angles. The cab partially hides the first millimetres of each muzzle, so no full bore-clearance claim is inferred.

**Clear view and physical result retained.** Originals00/07 keep the central forward windshield unobstructed and all four MFD titles, rows and footers inside the frame; original02 retains Burrow's clear windshield. Original01 mostly faces the aft hatch and does not establish the complete port-door mechanism. New frames72–74 show actual hatch opening. Frames167/170 show the loaded rover rising relative to the separate cargo banks; frame172 shows the hatch descending beyond it without observed gross intersection. Original06 shows the rover centered in the bay; originals08/09 show closed-hatch flight and landing. Frames201.4/202.2 show deployed visible feet and frame203 the beginning of retraction; these frames do not establish the whole gear stroke. The more extensive original final13 mechanism samples remain historical corroboration, not substituted new-run footage. The enclosed rover's continued identity in flight comes from the fixture state, not visibility through the hull.

## Applicable QUALITY scores

| Criterion | Score | Bounded basis |
| --- | ---: | --- |
| Silhouette and scale | N/A | The small rear flight view and cropped mining background cannot grade the full exterior silhouette. The stricter studio gate remains separate. |
| Materials and detail | 4.0 | Readable fitted cabin ribs, divided hatch, glass, dark recesses, rover panels and physical screen bezels. Broad interior surfaces remain simple. |
| Lighting and integration | 3.8 | Lamps make the enclosed loaded rover and lane legible. Strong ceiling/upper-wall pools, dark lower recesses and coarse exterior shadows still limit polish, especially frame170. |
| Cohesion | 4.2 | White armor, petrol structure, mint lighting/screens and amber details agree across ship, rover and inventory. |
| Information or physical function | 4.1 | The physical MFD now matches actual composed cargo and backpack contents; clear eyes, screens and visible loading mechanism support use. Remaining HUD overlap prevents a higher score. |
| Motion | 4.1 | Sampled hatch opening, loaded raise/closure and visible flight/gear poses remain attached without observed gross clipping. Local mining feedback now reads correctly. Full-time flicker, hidden joints and the complete gear cycle are outside this sparse follow-up. |

Mean of five applicable dimensions: **4.04**. Only information rises from the old score (3.2→4.1); there is no invented geometry, material or lighting improvement. No exception or waiver is used.

## Retained limits and disposition

**G13-GAME-02 remains nonblocking:** the upper resource card overlaps temporary onboarding/landing guidance, and navigation labels remain visible over opaque cabin walls. All four persistent MFDs and the relevant inventory controls remain readable. Bright bay light pools also remain recorded. No new required visual correction was found within this follow-up's scope.

The supplied journey records PASS, stable sources and empty error/warning/request arrays. Root reports the unchanged unloading, mining, transfer, five neutral gates, reverse loading, return, carried flight and landing case passed in3.6min (3.7min total), child0 and outer0; the independently read process JSON directly records **childReturncode0**. These fixture outcomes are separate from visual scoring. I independently ran only CPU metadata/hash/frame and mass checks, all successful. The earlier build17 wrong-entry capture remains a retained configuration failure, not evidence against this build18 journey.

This is a bounded **desktop offline actual-game visual PASS**, complementing separate studio, source and input reviews. No FPS/frame-time, GPU budget, physical-device, phone/touch/keyboard completeness, save reload, multiplayer, all lighting, all aim arcs, LOD or full exterior art claim is made. Existing online power-off legacy MFD behavior was unchanged by the source patch and is not certified here. Cees retains product acceptance.

Repository copy: local raw-receipt links are expanded above. The frozen original report is `/tmp/star-agent-gannet-final-ui01-game-review/report.md`, SHA-256 `8112d256daae318ff4917178057e97c8b5f09a320a6681e6e3e1d5f7317703ba`; its findings are unchanged.
