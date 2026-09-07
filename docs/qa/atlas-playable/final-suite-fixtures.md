# Current Atlas and station fixture corrections

Parent's configured normal suite on `c9416b0` passed 991 of 995 tests and exposed four old fleet assumptions in three files. This bounded follow-up preserves the current runtime collision, pad geometry and ship dimensions. The only runtime edits change the medium/large construction-pad label strings; `docs/base-building.md` now identifies the actual supported ships.

The current Atlas envelope is 36 × 64 m. The existing 48 × 72 m large pad provides 6 m of lateral and 4 m of longitudinal clearance on each side when centred. The 32 × 40 m medium pad supports Nomad and cannot contain Atlas. The old fixture assigned the retired smaller Atlas to medium and doubled that retired size for a future-heavy reference. The updated assertion checks current S/M Nomad and L Atlas clearance and explicitly rejects Atlas on S/M. No cost, footprint, polygon, pier, support or collision definition changed. The ongoing pad owner retains their independent source/studio work; the narrow label claim was recorded in the original and dev journals before editing the isolated branch.

The finished-prop Atlas sweep now wraps the actual bay with `fleetHangarAsset`, attaches human props outside that scaled frame, applies the current pilot X/Y/Z offsets, and approaches from beyond the whole hull and door. It retains closed-door rejection, open approach, docking, one-metre launch and departure. Original standalone prop fabrication/placement assertions remain unchanged.

The tilted twenty-bay fixture now uses `PLAYABLE_STATION_OPTIONS` and the current authored exterior and LOD. Its pilot position derives from the real pad attitude and complete seat offset. All forty Nomad/Atlas berth journeys check closed-door interception, fit, one-metre launch, departure, return approach and landing, including actual sweep endpoints. No hull bound, collider, door test, tolerance or set of berths was removed to obtain a pass.

## Verification

- `node --test --test-isolation=none tests/build-shapes.test.js tests/station-finish-props.test.js tests/station-opening-complex.test.js`: **16/16 pass**, zero skipped.
- `node --test --test-isolation=none tests/build-navigation.test.js tests/station-fleet-hangar.test.js tests/station.test.js`: **20/20 pass**, zero skipped.
- `npm run build`: **pass**, 313 modules, `main-D27xDIrO.js`; existing large-chunk advisory remains.
- `npm run check:repo -- --base c9416b0`: **pass**.
- `git diff --check`: **pass**.

The check planner was run against `c9416b0`; its broad industry suggestions were scoped to the two label strings and these geometry fixtures. No browser, GPU, database, service or shared runtime was touched. Parent owns the final full-suite rerun and browser/dev promotion. CPU geometry checks do not certify visual appearance, native input or the separately reported meadow ramp behavior.
