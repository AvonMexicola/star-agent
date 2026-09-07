# SA-VEH-001 — Meridian enclosed mining rover

User: Cees, 2026-09-07, after the fitted weapon handoff. Build a wheeled mining
vehicle to the Kestrel production/design standard, comfortably transportable by
Atlas, with a closed cabin and two long-duration mining beams.

## Bounded player result

An original compact four-wheel Meridian mining rover, approximately4.65m long,
3.02m wide including fixed boarding steps and2.50m tall. Target actual current30m Atlas: its belly lift is8×10m
and the cargo floor/ceiling are4/9.2m. The rover fits with ample side/end/headroom;
verify the exact export, ramp/door sweep and lift travel. The64m MarkII remains a
separate studio and is not silently made flyable.

Provide a reachable offline development start with Atlas and the rover aboard.
Walk to its door, board physically into the enclosed cabin, lower the Atlas lift,
drive to an actual mineral deposit, aim and sustain two visible mining beams from
their real emitters, inspect collected minerals, return and drive back aboard.
The shared keyboard/controller/touch routing must support the full affected route.
RT/T or the touch trigger sustains mining; LS/WASD drives, RS/arrows aims, LT/X
brakes, X/F interacts in context. Display unambiguous driving/mining/lift/cabin state.

## Art and physical contract

Original Kestrel-family ivory/graphite/steel/petrol forms, angular framed glazing,
beveled wheel fenders, real four-wheel axles/suspension, service panels, readable
Meridian identity, enclosed rear mineral storage and paired exposed cutter heads.
A hollow single-seat cabin with a physical door, sealed glazing, seat/controls and
live telemetry. Closed cabin supports use on airless worlds; no new atmospheric
fluid or pressure simulation is claimed. Author in Blender with source/provenance,
intentional UV/PBR maps, named moving wheels/steering/door/cutters and exact muzzles.

Game axes:+Yup, -Zforward, ground contactY0. Closed-cabin, straight-wheel envelope
[-1.72,0,-2.55]…[1.30,2.50,2.10]. Four wheels atX±1.08,Z±1.35, radius.52m.
Cabin sits between fenders, floorY.46, pilot eye aboutY1.8,Z-.75. The complete steering sweep widens this to3.232m; keep the canonical rig/cabin
dimensions in assets/mining-rover/layout.json. Atlas parking isX-1.60/Z5, facing+Z
for forward unloading, clear of its actual call pedestal.
Target<=30k triangles,<=4MBGLB,1024²WebP maps; measure rest draws and loaded cost.

## Simulation and storage

Canonical bodySurfacePoint/normal and actual Atlas floor/lift support are the
only support sources. Keep planetary positions as doubles and render relative to
camera origin. Wheel steering/spin/suspension follow actual movement; reject steep
steps, walls and unsupported loading transitions. Do not create a second terrain.

Twin continuous beams remain visible while held (target120s continuous duty from
full charge); both origins follow their actual emitter nodes. Use the existing
validated rock excavation and inventory transaction, with no duplicate yields or
mining through glass/hull/walls. Storage-full/save failure stops extraction safely.
A supported remote mineral container may be reused for a real rover cargo bin;
no paid service, new network authority or multiplayer rover replication.

## Verification and delivery

Freeze source/export hashes, validate full Atlas loading dimensions and moving
clearances, inspect the human reference correctly (prior weapon review caught
cloned-skeleton/bounds errors), exterior/cabin/beam motion in the actual renderer.
Test collision/precision, real carving+inventory, sustained beams, focus/modal/
disconnect neutral safety, physical boarding and Atlas loading/unloading.
Full relevant unit/build/repo checks and complete injected-controller journey;
separate hardware and final art/FPS acceptance. Draft PR plus checked local dev
integration under standing user authority, no main merge or deployment.

Base4d38827, isolated feat/meridian-mining-rover. Local dev now includes weapon
runtime2faa71c/review7cc583c and current RT/menu/persistent accounts. Remote dev is
older: retain a clearly described stacked dependency boundary when publishing.
