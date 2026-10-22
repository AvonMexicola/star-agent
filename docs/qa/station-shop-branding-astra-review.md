# Independent Astra visual review — PR 20

Reviewed 2026-09-06 by **Astra (`gpt-6-astra`)**. Candidate verified with
`git rev-parse HEAD`: **435f116f4be1588cd21f54cfa7713892b9cf028b**.
The user explicitly authorized Astra in place of the previous reviewer. The
QUALITY.md numerical thresholds remain unchanged: mean at least 4.0, no item
below 3. This is an independent assessment, not an inferred user waiver.

**MERGEABLE: NO.** The affected station/shop presentation scores **3.50/5**.
The retail dressing is a substantial improvement, but the alcoves still read
as unfinished interiors above their attractive counters. Inherited whole-PR
performance and world-view issues remain separate acceptance concerns.

## Candidate and evidence

I read AGENTS.md, QUALITY.md, the shop-branding production and performance
records, the concourse production/asset records, relevant runtime graphics and
room code, and the hangar record's current status. Historical review results
belong to their historical candidates; the earlier 3.67 is not this score.

The actual preview at `http://127.0.0.1:5260/` serves
`/assets/index-Dy1CQeYC.js`. I fetched it and independently verified SHA256
`74cffbc24a8dcb4840d6e063666731750d918281e6744c24e0959ba1676e79fd`.
The first direct Node localhost fetch failed with sandbox EPERM; the approved
host execution succeeded. This was not a game failure.

I ran these jobs sequentially, then opened and read every listed image with
the image-viewing tool. These are my own captures of the game renderer, not
the production author's screenshots or Blender renders.

```sh
node scripts/concourse-review.mjs --url http://127.0.0.1:5260 --out /tmp/star-agent-shop-branding-astra-views
npm run test:browser -- -c /tmp/star-agent-concourse-browser.config.mjs scripts/station-shop.spec.js --output=/tmp/star-agent-shop-branding-astra-ui
node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5260 --out /tmp/star-agent-shop-branding-astra-context --extras --perf1440 --hardware
```

Captured and visually read:

- In `/tmp/star-agent-shop-branding-astra-views/`: `overview.png`, `armory.png`,
  `components.png`, `armory-interior.png`, `components-interior.png`,
  `armory-brochures.png`, `components-brochures.png`, `armory-banner.png`,
  `components-banner.png`, `elevator-closed.png`, `elevator-open.png`,
  `seating.png`, `hangar-elevator-closed.png`, `hangar-elevator-open.png`.
- In `/tmp/star-agent-shop-branding-astra-ui/`: the physical journey's
  `station-shop-walk-through--97abd-r-transfer-cargo-and-reload/shop-controller-desktop.png`,
  and the phone fixture's
  `station-shop-390×844-touch-042d1-in-a-controlled-hub-fixture/shop-mobile-top.png`
  and `shop-mobile.png` in that same per-test subdirectory.
- In `/tmp/star-agent-shop-branding-astra-context/`: `01-orbit.png`,
  `02-coast.png`, `03-forest.png`, `04-highlands.png`, `05-hangar-t10.png`,
  `06-cockpit.png`, `07-corner.png`, `08-gallery.png`.

I also read both capture directories' `evidence.json`, including environment,
fixtures, completion/errors, geometry counts, render scales and timing fields.
The concourse capture completed with zero browser errors/warnings. The context
tour completed with zero errors, warnings, failed requests or unexpected browser
lifecycle events. All five isolated context sessions closed intentionally.

Chromium **151.0.7922.173**, **AMD Radeon 860M**, **ANGLE OpenGL ES 3.2**.
Concourse and desktop UI: **1440×900**; phone UI: **390×844**; context images:
**1600×900**, with additional 1440×900 count/cadence samples for station views.
Concourse and context final captures use render scale 1. The context script
temporarily uses 0.4 during settling, then restores 1 before capture. UI captures
have native-resolution DOM at the stated desktop/phone dimensions, but the shop
test fixture renders their 3D background at scale 0.55. Those UI images establish
menu presentation, not full-resolution background rendering quality.

Both shop tests passed: physical keyboard walking through passenger transit,
simulated controller purchase, cargo transfer and reload (**41.2 s**), and
controlled phone fixture with touch purchase, scrolling and closing (**7.0 s**).
Total runner time was **51.3 s**. The runner printed its inherited
NO_COLOR/FORCE_COLOR environment warning. Functional success is not the visual
score. Phone placement is a fixture, not a physically walked touch journey.

## Rubric

Scores apply to the affected station/concourse/shop presentation, including
the inherited station work being accepted with PR 20. World context findings
are reported separately rather than silently folded into a shop score.

| Criterion | Score | Observed basis |
| --- | ---: | --- |
| Silhouette & scale | 4 | Counters, three-place seating, elevator rails and brochure pockets read at plausible human scale. Banner hardware has visible attachment and bottom rails. Shop stock categories are recognizable, although repetition weakens individual product identity. |
| Materials & detail | 3 | Carpet has visible pile and mottled wear; campaign paper, metal frames, trim and counter surfaces are differentiated. The nine repeated rifles and repeated canisters remain very simple against the much richer printed products. Large wall/ceiling regions lack the detail needed to complete the room. |
| Lighting & integration | 3 | Counter and carpet receive convincing local pools and contact shadows; paper avoids looking emissive. Rear stock and especially the ochre Kestrel wordmark lose contrast. The upper alcove reads as exposed black space with exterior structure, rather than a convincingly enclosed shop. |
| Cohesion | 4 | WATCHKEEP petrol/ivory and KESTREL ochre/paper form coherent tenant identities within the station. Posters, banners, folders, shelf labels and menus agree. The everyday paper/carpet language adds character. |
| Information design / function | 4 | Desktop and phone clearly state credits, prices, warehouse delivery and implementation limits. Purchase feedback is readable. Brochure faces fit their supports without evident crop/stretch errors. Phone content scrolls under a persistent close header; the long text-heavy catalogue remains usable. |
| Motion | 3 | Automated physical travel, menu interaction and door endpoint captures succeed. No motion defect is demonstrated here, but I inspected stills and automation results, not a continuous frame-by-frame recording. This supports only a conservative motion score, not a claim of universally flicker-free animation or terrain transitions. |

Arithmetic: **(4 + 3 + 3 + 4 + 4 + 3) / 6 = 3.50**. No item is below 3;
the mean nevertheless fails the 4.0 threshold. The motion evidence limit is
a reviewer limitation, not an invented runtime bug.

## Ranked findings and concrete fixes

1. **Affected station acceptance issue, inherited from pre-branding alcoves:
   the upper room does not read as enclosed.** In `armory.png`,
   `components.png` and both interiors, the upper half is dominated by black
   starfield, beams and exterior station structure. `src/station-concourse.js`
   does contain opaque side roof slabs and central glazing, so the screenshot
   alone does not establish missing geometry. The visible composition is the
   defect. Add a readable low shop soffit/ceiling at the alcove wall top, with
   proper fascia returns and mounted lighting below it; preserve deliberate
   glazed panorama in the central circulation space. Verify both entry and
   interior angles after the change. Do not alter the praised elevator for this.

2. **Affected retail acceptance issue: rear merchandising hierarchy is too
   dark.** `components.png` and `components-interior.png` show a subdued brown
   KESTREL wordmark and dark stock behind a bright counter and carpet. WATCHKEEP
   rifles also merge into their dark backing. Relevant elements are
   `makeWordmarkAtlas` in `src/station-shop-graphics.js` and the down-facing
   shop lighting in `src/station-concourse.js`. Use a higher-contrast existing
   paper/ivory token for the Kestrel wall letters, retaining ochre in accents,
   and aim/rebalance the mounted light to reveal rack stock and upper wall.
   Keep paper physically lit and remeasure cost rather than adding broad
   emissive surfaces or unbounded lights. This is a new branded-wordmark issue
   combined with inherited lighting, not a defect in the generated artwork.

3. **Affected asset polish issue, inherited stock: repeated display objects
   retain a prototype appearance.** `blender/build_station_concourse.py`
   repeats the same three rifles in three racks, and similar boxes/canisters
   across the component shelves. Distinct shelf categories therefore advertise
   variation the geometry does not communicate. Author a small set of visibly
   different stock configurations: sidearm case, long-arm silhouette, boxed
   field kit; different end caps/handles/labels for component families. Use
   shared materials and existing budgets. This is more valuable than adding
   more identical stock. Carpet wear and A5 supports already read successfully.

4. **Inherited whole-PR performance blocker: budget compliance remains
   unresolved.** The context evidence independently reproduces orbit at
   **477 draws / 304,642 triangles**, over the 300-draw limit. The provided
   latest canonical hangar timing is **10.687 ms GPU median / 11.7 ms CPU
   median**, exceeding the 10 ms frame allowance. Relevant work is station/world
   visibility and batching in `src/station.js` and the render loop, with
   reproduction through `scripts/station-performance-check.mjs`. Profile the
   actual passes and reduce hidden or repeated submissions; repeat hardware
   timing under documented conditions. The retail group is not drawn in that
   hangar view, so neither the cost nor the fix should be assigned to posters.

5. **Inherited world/context acceptance issue: the required coast view does
   not communicate a coast.** `02-coast.png` is predominantly a nearly flat
   grassy field with scattered rocks and a thin horizon; no clear shoreline
   is readable. The fixture's chosen look direction samples terrain heights
   approximately 49, 23 and 3 m at its three forward distances. Review destination
   selection from `src/world.js` together with `seaDirection` in
   `scripts/hangar-integration-tour.mjs`: choose an actual coast using the shared
   terrain function and verify a visible land/water boundary and horizon relief.
   Do not invent a separate floor or quietly move the camera solely to conceal
   an invalid destination. Forest also has an abrupt visible detail-band change,
   and highlands show coarse smooth facets; these are inherited follow-ups,
   not retail regressions. Stills do not establish temporal popping.

## What is working and what is not claimed

Campaign subjects are recognizable; poster and folder proportions look natural,
print margins remain inside the frames, brochure pockets visibly support the
paper, and banner mounting hardware is present. The carpet provides visible
material variation and use. The elevator has a legible threshold, receiving
pockets, lined cabin and supported rails in both lighting contexts. The hangar
service corner and overhead gallery include purposeful equipment and visible
ceiling diffusers. These strengths should be preserved.

Desktop WATCHKEEP and phone KESTREL menus consistently disclose that purchases
are stored cargo. Combat, equipping and installation are not represented as
implemented by this review. Decorative A5 holders are not interactive inventory.

My tour observed approximately 16.7 ms RAF cadence in short eight-interval
samples. That is not a GPU timer result or proof of the 10 ms budget. At 1440×900
the tour measured hangar 505 draws / 684,953 triangles and cockpit 524 draws /
676,572 triangles, within their count budgets. Shop views ranged from 178 to
311 draws depending on angle. I did not rerun GPU elapsed-query profiling.

The supplied retail ON/OFF investigation reports mixed GPU differences
−0.048, +0.403, +0.574 and −0.540 ms; its median +0.177 ms is noisy, not a precise
feature cost. Canonical hub GPU median 4.578 ms and slower p95 11.570 ms both
remain relevant. I do not replace them with the context tour's RAF values or
attribute host contention to a measured cause. Other host browser activity was
not controlled, and no user process was stopped.

No new unit/build run, screen-reader audit, physical controller hardware test,
continuous flight descent review, night-tour review or complete ship-exterior
review was performed by me. Those limits must not become implied passes.
The prior author's unit/build reports remain attributed to that author.

The review is complete for the requested bounded capture/test brief. A bounded
shop enclosure/lighting/material follow-up and richer motion evidence can be
reviewed independently; inherited world/performance blockers still need an
explicit disposition. No merge, waiver or external message is authorized or
performed by this report.
