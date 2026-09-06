# Regional mineral deposits — 2026-09-06

Implementation `baccba2`; integrated production asset `index-ChFNEySb.js`.
Selene now generates matching mineable outcrops beyond its five survey sites.
Approximately 180 m spherical cells contain a deterministic shape and mineral
profile. Copper/ice-rich cells have full occupancy; other cells have 40% occupancy.
Three local workers draw mineable rocks within 400 m. Established outcrops keep
an 80 m approach exclusion. This does not make the terrain heightfield excavatable.

## Verification

All 28 numerical files pass. Five new regional tests cover arbitrary copper-rich
sites and actual cut composition, seam/pole identity, slope/collision agreement,
nearest/aimed guidance, three-worker bounds, shared save limits, pending travel,
restoration and duplicate publication. A separate [coverage probe](coverage-probe.json)
found matching deposits within 160.26 m at all 44 selected copper-rich samples.
This is measured sample coverage, not a guarantee at every boundary or steep slope.

The integrated production run passed four journeys: existing Crescent controller
mining, existing named Copper Ejecta controller mining, the new regional controller
journey and physical EVA/space mining. The [ship recovery beacon journey](../ship-marker/README.md)
passed separately after its final layout changes, making five distinct checks for
this follow-up across the integrated run and targeted verification.

The regional journey uses only injected standard Gamepad actions: select Copper
Ejecta in the command menu, land, stand, open/exit the hatch, walk about 100 m to
`selene-deposit-v1-3626-2108`, aim, mine with RT, open/close the backpack and reload.
The chosen rock is 101.52 m from the nearest named site, and its composition is
93.5% copper, 4.5% basalt and 2% ice. Actual collection: 3.108 kg copper, 0.184 kg
basalt and 0.068 kg ice. Revision 8 and the exact saved field/cargo survive reload.
Finite cuts need not equal the whole rock's mineral proportions exactly.

Reload validation reads the persisted field and live backpack, then opens the
backpack again with the controller. It does not claim a second physical return to
the rock. Numerical tests cover eviction and remeshing of the saved cut. The shared
eight additional edited-deposit cap still applies; already edited rocks remain
editable when it is full.

## Screenshots and provenance

- [Route start](copper-region-route-start.png)
- [Generated outcrop](regional-copper-outcrop-before.png)
- [Controller RT and visible beam](regional-copper-controller-beam.png)
- [Collected cargo](regional-copper-backpack.png), [after reload](regional-copper-backpack-after-reload.png)
- [Measured state and route](evidence.json)

Chromium 151.0.7922.173, ANGLE/SwiftShader Vulkan, 1440×900, automatic render scaling
(the recorded 0.7225 is after reload and is not a fixed scale for all screenshots).
No browser/console errors. Screenshots were visually inspected. Debug state is read
for steering feedback; no gameplay position, orientation, interaction, mining or
inventory method is invoked by the fixture. No physical Xbox, hardware FPS or
independent manager visual approval is claimed.

Run: `npm run test:browser -- -c scripts/expedition.config.js scripts/regional-deposits.spec.js`.
