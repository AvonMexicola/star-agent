# Atlas production constraints and first-pass direction

The existing interior can remain while the exterior and gear are rebuilt. The
usable gear zone is outside the pressure bed and below the shoulders/drives.
The upper room enclosure sets a hard lower limit on the roof; reducing the
visible box requires changing the outer mass hierarchy around that enclosure.

This is an independent **CPU constraints audit**, followed by inspection of
five **inherited builder images**. No browser was launched for this task, no
production source or asset was edited, and no new silhouette or final approval
is issued. The previous independently captured baseline remains **3.0/5**.
The refresh still needs its own silhouette ≥4.5 and final average ≥4.2 with
every criterion ≥4, within 60,000 triangles and 4,000,000 bytes for the whole
visible ship.

## Measured identity and method

[measurements.json](measurements.json) records the original GLB, SHA-256
`a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa`,
and source hashes. [measure.mjs](measure.mjs) reads that asset and the original
layout/systems from Git `7b97f5a`, asserts their identities, then loads the real
geometry with Three.js. Material references alone are omitted to avoid image
decoding. It uses the existing Kestrel worktree's installed Three.js; no Atlas
dependencies were installed. Run from the worktree:

```sh
node docs/qa/atlas-fleet-refresh/production-constraints/measure.mjs
```

The working asset changed during this audit. Its identity assertion correctly
rejected it; the script now reads the immutable Git baseline and completed
successfully. Measurements below describe that baseline, not subsequent root
fixes. Group bounds include every transformed vertex, not just transformed
local boxes. Each ramp uses 401 actual runtime poses plus a derivative/radius
bound to cover intervals; lift/gate translation unions are exact. The eight
cargo overhead rays establish specific defects, not exhaustive head clearance.

## Preserve these spaces and load paths

All coordinates are metres, **+Y up, −Z forward**, origin on the landing plane.
Values below are construction limits; avoid cutting even a small clearance
sliver simply because the rendering hides it.

| Protected element | Bounds or contract |
| --- | --- |
| Cargo space | x ±7.2, y 2.6–8.8, z ±24; complete vehicle lane x ±4 |
| Pressure bed | x ±7.65, y 2.13–2.57, z ±24 |
| Cargo pressure walls | inner/outer \|x\| 7.34/7.62, y 2.6–8.84, z ±24 |
| Upper deck slab | y 9.28–9.5; x ±7.2, z −25…18 with tapered forward footprint and lift aperture |
| Upper pressure walls | inner/outer \|x\| 7.30/7.56, y 9.5–12.75, z ±18 |
| Upper circulation | central x ±1.3, floor 9.5, ceiling 12.75, z −12…18 |
| Crew enclosure | x −7.2…−1.28, y 9.5–12.77, z 0.92…17.16 |
| Galley/hygiene enclosure | conservative x 1.28…7.2, y 9.5–12.77, z 0.92…17.16 |
| Actual raked bridge shell | x ±7.5501, y 9.2100–13.4900, z −25.9949…−17.7000; preserve the wedge, not just this loose box |
| Pilot eye and approach | seated (−2.1, 11.05, −21.25), standing (−2.1, 11.25, −20.5) |
| Four MFD frames | x −2.97/−2.39/−1.81/−1.23, y 10.82, z −22.8; width .52, height .325, X rotation −.2 |

The bridge front ring is only ±4.9 wide near z −25.9 and rises through the
recessed glazing to y 13.25. Its aft ring at z −17.8 broadens to ±7.43 and
y 13.4. Do not use a rectangular bridge estimate to move the brow through the
actual eye or glazing.

The existing ceiling liners occupy **y 13.12–13.37 at z −18…−11** and
**y 12.77–13.02 at z −11…18**, across nearly x ±7.275. An outer roof's
*underside* must clear those, including its thickness. A narrow raised roof can
slope outward to a lower full-width pressure cap; a single diagonal through
the ceiling corners cannot preserve the rooms. Retain the step header at
z −11, the aft room ends near z 17.16 and the raked pressure bridge.

The existing transverse chassis frames are at z −21, −13, −5, +3, +11, +19,
with x ±7.4 and y 1.68–2.16. The load spines run at |x| 7.6–8.9,
y 8.76–9.4. New outboard gear carriers should visibly connect to these frame
stations. Route carriers outside the pressure wall or below the pressure bed;
do not make a diagonal bearing support cut through the occupied vessel.

Keep the useful narrow passages when simplifying geometry. After the existing
.3 m capsule expansion, the crew, galley and hygiene door centre intervals are
respectively z 2.52–3.48, 2.32–3.28 and 11.72–12.68. The bridge aft opening
allows centre x ±.98. The crew aisle between berth and fold desk leaves only
about .70 m for the capsule centre, x −3.45…−2.75; the proven route is near
x −3.1. A straight replacement aisle at x −2.5 would meet the desk.

## Ramps, lift and confirmed baseline defects

Retain both 11.6 m ramps, their independent root pivots (0,2.6,±24), 6 m leaves,
2 m tips, .18 m raised tip hinges and the layout-owned angles. Actual continuous
moving-geometry keep-outs, rounded outward to a millimetre:

| Assembly | Minimum XYZ | Maximum XYZ |
| --- | --- | --- |
| Front ramp and tip sweep | (−6.080, −.325, −32.051) | (6.080, 8.772, −23.272) |
| Aft ramp and tip sweep | (−6.080, −.325, 23.272) | (6.080, 8.730, 31.809) |
| Lift across both landings | (4.100, 2.280, −5.800) | (6.900, 10.821, −2.200) |
| Lower gate sweep | (4.136, 3.429, −4.750) | (4.264, 3.670, −1.500) |
| Upper gate sweep | (4.136, 10.329, −4.750) | (4.264, 10.570, −1.500) |

The lift aperture is x 4.1–6.9, z −5.8…−2.2 in the upper slab. Keep its
outboard guides near x 7.02 and both landing access routes. Gate travel extends
to z −1.5; reserve more than the closed 1.5 m bar length.

The baseline's constant-thickness ramp toe penetrates the ground. At the real
open transform, `RampFrontTip_dark` vertex 62 reaches y **−.297167** at
(5.7400, −.297167, −31.3843); aft is symmetric. This is not an AABB padding
artifact. Taper the last approximately one metre of underside toward a contact
wedge while preserving the nominal top route and full width. Check the whole
folded motion. The front tip also reaches z −32.023 during its swing, slightly
beyond the nominal closed envelope; keep apron space there. Do not clamp an
actually penetrating ramp's collision minimum to zero.

Two further defects must be closed without shrinking the cargo contract:

- Overhead frames/light stock are hit at y 8.58/8.5425 on the centre line;
  hanger stock at x 3.25–3.52 is hit at **8.3599997**, a .44 m intrusion below
  the declared ceiling. Move overhead services into the .48 m space between
  y 8.8 and the upper slab underside at 9.28. Include their brackets and light
  housings, not just the main pipes. The loading portal's old upper seal also
  begins at y 8.61; clear the route through both portals as well as the hold.
- The lower lift call housing at x 3.5, z −5.1 intrudes to x 3.275 in the
  vehicle lane and has no matching walking collider, as established in the
  [baseline review](../baseline-review/review.md). A viable new centre is
  **(4.45, −6.30)** in XZ, outside the lift aperture and lane, reachable from
  x 3.6 within the 1.35 m interaction radius. Move the runtime call location
  and collision with the visible fixture.

Root subsequently reported source fixes and passing sampled checks for the
overhead, call station and toe. Those are builder results; the measurements here
preserve the original failures and do not independently certify the replacements.

## Proposed gear allocation

Six pivots at **(±9.6, 4.3, z)** with **z = −21, +3, +19** align three existing
frames. These refine the first provisional suggestion of −18, +2, +20. Front
and middle legs fold aft; rear legs fold forward. That arrangement leaves the
ramps, cargo pressure walls, lift and each other clear at the allocation level.

The JSON contains one illustrative 3.95 m root-to-shoe link, a counter-levelled
2.7×.32×3.3 m pad and the following pockets, mirrored to port:

| Starboard pocket | X | Y | Z |
| --- | --- | --- | --- |
| Fore | 8.0–11.2 | 3.75–4.85 | −21.35…−15.20 |
| Middle | 8.0–11.2 | 3.75–4.85 | 2.65…8.80 |
| Aft | 8.0–11.2 | 3.75–4.85 | 13.20…19.35 |

The illustrative moving pad remains at |x| ≥8.25, .60 m beyond the pressure bed;
the inner pocket wall at |x|=8 leaves .35 m. Its ideal contact plane satisfies
`padBottomY = 3.95 × (1 − cos(foldAngle))`, hence stays at or above zero.
This formula is for the proposed rigid link and true counter-rotation about
the shoe joint. It does not certify the builder's different .56 m cross-pin,
oleo, braces, final mesh or animation.

An illustrative door hinges along local Z at outer x ±11.2, y 3.75. A 3.2 m
wide, .12 m thick leaf can swing downward to vertical outside the pad. Its
door-only sweep stays above y .5494 and within |x| 11.26. Open doors fully
before extending legs; retract legs completely before closing doors. Exact
hinges, latch stock and carrier contact regions still need their own geometry
check. Do not treat this ideal rectangle as a checked production door.

These are **replacement pockets**, not empty bays already present. They cut
through the old lower armour, conduits and clamps; reroute those services. The
baseline drive minimum is y **5.0053** at |x| 9.4738–16.7263, z 13.4–30.902,
so a y 4.85 pocket roof has only .155 m of vertical room. The changed shoulder
and engine mesh must be measured again. Keep the fixed carrier outside the
moving pad's path and tie its load into the vessel's frame, not a thin skin.

## Low-poly engine and export constraints

Each original drive is 54,996 triangles. A reasonable construction allowance
is 4–5k per engine: an eight-sided shell with a few longitudinal rings,
16–24-sector recessed nozzle, a small set of thick petals and 6/8-sided actuator
rods. Bake fine bolts, grooves and repeated coolant rings. The old twelve
32×8 torus pieces per drive alone consume about 6,144 triangles; automatic
two-segment bevels on every small rod and bolt compound the cost.

Keep actual outlet depth and an open hole. A capped cylinder or filled ngon
will hide the throat; an emissive disc far upstream can disappear at rear
quarter angles behind the wall. Put a narrow visible inner liner near the lip,
retain the deeper core, and check mirrored winding and hard/curved normal
boundaries. Planarize both host skin and cover plates rather than creating a
warped shell with a separately triangulated cover that intersects it.

Preserving the interior means preserving its layout and enclosure, not all
143,508 original interior triangles. The whole-ship planning budget remains
22k exterior/drives, 10k cargo, 12k upper interior, 10k mechanisms, 2k mounts,
2k fittings and 2k reserve. Mesh/texture byte cost must be measured independently.
Keep dynamic pivot ownership when batching; four runtime MFD quads add eight
triangles beyond the static asset.

The original `batch()` reconstructs meshes without copying UV loops, and
`export_asset()` calls `uv_metres()` unconditionally. Make the unique painting
atlas after final batching, freeze it and preserve it on all subsequent exports
before matching Meshy maps. The exporter also disables animation export: direct
runtime transform ownership remains valid, but any intended embedded gear
clips need an explicit export path. Do not accidentally ship a rig that looks
correct only in Blender.

Keep the three empty S3 mating origins at (±11.2,8.9,−9) and (0,14.6,19.5).
The dorsal bores point −Z; the aft frame rotates its bore to +Z. All normals
are +Y. S3 docking diameter is 1.25 m, with eight .04 m bolt holes on a 1 m
pitch circle. Its clearance cylinder has radius .875, extending .25 m below
and 1.2 m above the plane. Preserve shared exact-size metadata; empty fittings
do not certify the provisional full weapon package or imply installed guns.

## Inherited first-pass massing critique

I inspected the builder's [exterior](inherited-shape-01/exterior.png),
[side](inherited-shape-01/side.png), [plan](inherited-shape-01/plan.png),
[bow](inherited-shape-01/bow.png) and [aft](inherited-shape-01/aft.png).
Copies, hashes and the original evidence record are retained in
[inherited-shape-01](inherited-shape-01/provenance.json). They show candidate
`893ff3cfb88e4f7fde8477e7deb12ce33597d0bc5814300e7f9aa79547000555`,
60,145 triangles / 4,844,132 bytes, Chromium 151 at 1440×900 on AMD 860M.
This is the first builder shape iteration with old gear, not the later reported
58,353-triangle candidate. No new numeric score is assigned from these frames.

The cleaner profile is progress, but the large continuous dorsal cap and tall
flat side still read as a long box. The broad shoulders reach full width too
early, and the loading brow retains its awning-like lip. Ranked next changes:

1. Keep the bridge transition near y 13.6, lower the middle roof at z roughly
   −8…+3 to y 13.25–13.35, then use a shorter aft rise to about y 14.7 at
   z +9…+13. Narrow only that raised aft cap to ±4–4.5 m and return its cheeks
   to the full-width retained pressure roof. Respect the ceiling underside
   limits above. This creates a roof hierarchy without cutting rooms.
2. Break the tall continuous exterior side with two substantial raked load
   buttresses around z −10 and +10, connecting upper casing to the shoulders.
   Their fixed supports must live outside the pressure wall. They should alter
   the quarter-view mass, not merely become contrasting painted triangles.
3. Move the shoulder width peak aft. A useful next station trial is outer
   half-widths **11.8, 13.2, 15.2, 17.7, 14.7** at z **−20, −12, −2, +8,
   +16.8**. Keep the S3 bases clear; refit radiators and lamps to the changed
   skin so they do not float outside a narrower forward shoulder.
4. Reduce the bow crossbeam's projecting lip and join its ends into the cheek
   ridges as a continuous protective mouth. Keep the measured ramp keep-out
   and the bridge shell. Do not close the central opening to solve the outline.
5. Correct the large host-surface diagonals as well as their covers. The huge
   dark flank's triangular shading is clearly visible in the side/quarter
   images and makes the hull look like an unfinished solid wedge.

This checkpoint delivers measured constraints and bounded art direction. Root's
subsequent gear, surface and clearance work needs a fresh candidate identity and
independent actual-renderer review; this report is not that gate.
