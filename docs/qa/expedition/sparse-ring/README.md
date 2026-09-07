# Sparse Selene ring review — 2026-09-06

Implementation commit `0f7f1f1`; final production asset `index-N8I1Odnu.js`.
Dedicated preview: http://127.0.0.1:5213/ . This record supersedes the initial
20-million-descriptor ring screenshots for current appearance and population.

## Results

- All 26 numerical test files pass. New coverage checks 2 km clearance across
  every potentially nearest pair and the seam, exact legacy save coordinates,
  shape bounds/closed surfaces, LOD coverage, ice anchoring and finite ring edges.
- Five distinct production browser checks pass across the integrated run and
  targeted reruns: ring visibility/ice; remote Selene equip; ring yaw including
  held B; third-rock aim preparation/large-rock rejection; and Ring Survey,
  physical EVA exit/translation, injected RT mining and backpack collection.
- Final ring shader capture has no browser or WebGL console errors. It verifies
  the generated hero through 4/16 km LOD boundaries and at 60 km, and retains
  distant IDs across a coordinate boundary. About 430 instances are represented
  around these viewpoints, including overlapping LOD fades.
- The ring is 1,826.896 km in outer diameter around the 868.7 km moon, with a
  20 km radial width and 2 km vertical thickness. Its 14,336 generated bodies
  have at least 2,132.11 m of conservative clear space. Saved v1 edits retain
  their original coordinates and are exceptions to this spacing rule.
- The final ice view has 707 particles inside the bounded 104 m neighborhood.
  Hiding only the Points layer removes 166 brighter pixels (peak channel increase
  186); the screenshot shows fine glints, not a fog layer. Across a 32 m hash-cell
  boundary, 704 shared particles retain world anchors within the slow animation
  drift allowance. Outside the ring, presence/count/draw range are all zero.

The first space-mining rerun pressed RT before its injected controller replaced
an already enumerated device. The test now waits for its exact device identity
and a neutral armed poll. Mining, cargo and backpack assertions then passed.
No production input suppression was weakened to make the fixture pass.

## Visual evidence

- [Complete ring and moon](full-ring-and-moon-overview.png)
- [Large asteroid at 600 m](large-rock-600m.png), [3 km](large-rock-3000m.png),
  [60 km](large-rock-60000m.png), [view along the belt](belt-depth-wide.png)
- [Sunlit ice](sunlit-ring-ice.png), [same view with ice hidden](sunlit-ring-ice-hidden-comparison.png),
  [outside the ring](outside-ring-no-ice.png)
- [Actual space mining](space-mining.png), [collected backpack cargo](space-backpack.png)

The distant orbital view uses the unresolved aggregate band; individual asteroid
geometry is limited to 80 km. Large rocks use original procedural fractured gray
forms with surface variation; small editable shapes retain their mining field.
[Yela research and source links](../../../yela-ring-reference.md) describe the
reference direction. These are prototype graphics, with independent Fable/Claude
visual approval still pending.

## Provenance and limits

Chromium 151.0.7922.173, ANGLE/SwiftShader Vulkan, 1440×900. Ring captures use
render scale 0.8; mining uses 0.65. These are rendering checks, not hardware FPS
measurements. The ring test uses debug camera placement around actual generated
bodies. The targeting test uses three explicitly synthetic positions. The space
journey uses the Ring Survey UI, real hatch/EVA translation and debug orientation
for aiming. Controller input is injected standard Gamepad state, not a physical
Xbox button sequence. Earlier full controller-only surface journeys are recorded
separately and were not rerun for these visual changes.

`ring-review.json` retains selected review measurements; raw traces and particle
buffer dumps stay under /tmp. Large bodies and visual ice grains are not mineable;
small deposits and preserved saved cuts remain editable within the shared save cap.
