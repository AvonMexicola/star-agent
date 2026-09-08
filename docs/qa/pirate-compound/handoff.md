# SA-PIRATE-002 — checked handoff, 2026-09-08

Status: checked development checkpoint; parent garage agent owns serialized local
integration and draft export. No public deployment. Branch
`feat/pirate-trade-compound`, base23ca6199d2b5f0ee5cbfa9f914612320e8d8e684.
Runtime/assets2c2f2fb49fcfbfc65bcfbc4bf012d78d66491375; complete browser09 tested
clean201588c with only fixture/documentation changes above that runtime.

Worktree `.worktrees/pirate-trade-compound`, private5676/API8676, disk TMPDIR
`.browser-cache/p2`. Browser09 released21:48:06UTC. No owned servers or browser
remain running. Raw evidence is in this worktree's ignored `test-results`.

## Result and scope

Hush Exchange is a solo secret Selene salvage compound with a real large landing
pad, terrain approach, supported building-kit ramps, cover crates and warehouse.
An original Blender cylinder carries the unchanged station-defense model at35%
scale. The tower warns300m out, engages within180m and disengages beyond220m.
Five-second warning,1.2s charge,3×18damage at0.75s intervals, then a full5s rest;
no accumulated fire after pause/retreat. Every supported full-health ship survives
the54damage burst with hull intact. Actual Nomad renderer evidence retained
hull240 and reduced shields180→126; retreat left the shot count at3.

The tower targets occupied aircraft in flight, landed or ship-cabin walk mode;
actual roverOccupied cabins are excluded. Exterior walking is safe. The nearby
isolator disables the tower and unlocks the existing trade UI for this visit.
Existing cargo transactions and atomic solo market saves remain authoritative;
finite stock is seeded once, with no read-time refill. No database/schema/server
or protocol change. Normal public settlement catalog still has four entries.

Four user-supplied Crimson GLBs are incorporated: generator, tripod floodlight,
workbench and crate. Original sources, hashes and reversible texture/normal
derivation records are retained in `assets/pirate-props`; all four runtime props
are under1MB with three512² lossless WebP maps each. Only twelve zero normal
vectors across lamp/workbench are repaired; other geometry and UV data is exact.
The original4551-triangle tower source/manifest is in `assets/pirate-tower` and
`blender/build_pirate_tower.py`. No shade-sheet file was present in the latest
Downloads inventory. Ground pirate NPC combat remains SA-PIRATE-001's separate
ownership; no pending enemy modules are copied or claimed as implemented here.

## Validation

- `node --test tests/pirate-compound.test.js`:15 checks PASS0.463s on2c2f2fb,
  actual building-pad/wall/door/ramp collision, source budgets/normals, real prop
  collider route, finite market/save invariants, light pool bounds and all-five
  ship burst/retreat/LOS/focus/rover gates. Raw `rest-normal-unit-01.log`.
- `node --test --test-reporter=spec tests/pirate-compound.test.js tests/space-combat.test.js tests/combat-momentum.test.js`:
  three files PASS3.403s on2c2f2fb, `final-focused-01.log`.
- Latest author normal155-file suite PASS59.449s on ce033b9 before the narrow
  normal/cooldown corrections, `unit-all-08.log`. Parent combined159-file suite
  PASS48.325s on73a7be8 includes checked runtime2c2f2fb, Garage, Transport and
  Handheld. No claim that the earlier155-file run covers later changes by itself.
- `npm run test:browser -- -c scripts/pirate-compound.config.js --grep 'keyboard and native phone|controller physically|work yard diagnostic'`:
  browser09 all3 PASS5.7min with included production build. Native phone47.7s,
  full controller3.6min, HDR1.2min. Native phone uses declared nearby poses; the
  controller route uses only Gamepad movement/interactions after the explicit
  developer start, including actual purchase, Cargo, resale, return and held-input
  focus/modal/disconnect/replacement/unsupported-device gates.
- Browser04 tower/art case PASS1.4min, actual three-shot shield decrement and
  retreat. Subsequent normal and cooldown changes have focused invariants and09
  rendered evidence; the precise tower case was not repeated unnecessarily.
- Parent combined04 PASS2.0min on16c73a5/runtime73a7be8, with production build:
  shared Garage X and isolator X/A/B routes, all four garage services, own yard
  and overview captures. Zero application errors/warnings in both author09 and
  parent04. These controlled placements do not replace the complete controller
  journey above.
- `npm run check:repo` and `npm run plan:checks -- --base origin/dev/all-features`
  ran; repository checks and `git diff --check` passed. Plan suggests broad
  multiplayer/database checks through shared commerce paths; this feature changes
  no server/schema and remains solo. Parent preserves checked online normal sites.

Chromium151.0.7922.173, ANGLE AMD Radeon860M/radeonsi krackan1 ACO OpenGL ES3.2,
desktop1440×900 and phone390×844. Actual-launch executable+argv guard serialized
one worker, no retries or GPU fallback. Original startup deferral, export/budget,
quota and application/fixture failures are preserved in the production record.
No physical controller or physical phone tested.

The final same-scene normal comparison measured0 nonfinite HDR RGB samples after
repair and102 after restoring only six original zero lamp normals; it reproduced
the exact black rectangle and removed it again on repair. Parent own captures
independently show the corrected lamp and workbench. Formal scored art review is
still pending. The older04 warm sample measured29.3ms median/31.7ms p95,773 draws
including shadows and2.16M triangles at0.85scale; project frame/triangle targets
remain unmet. This is not performance acceptance.

## Integration boundary

Parent already privately merged2c2f2fb into73a7be8 and resolved the narrow package
test inventory plus two main blocks. Consume the final branch commit for fixture,
curated evidence, guide and status additions; retain those existing resolutions.

- Keep pirate `attachInteractions()` AFTER garage `baseAction`/hint assignments
  following `ensureRover`, preserving both actions and all four normal garages.
- Preserve Transport's online normal-settlement enabled predicate. Hush stays solo.
- Preserve both debug/disposal fields and all registered tests. The pirate wrapper
  exposes one extra layout without a garage; garage filtering must remain explicit.
- New `occupiesShip` helper and `receiveExternalHit` adapter are the bounded combat
  boundary. Keep later independently checked enemy/vehicle contracts separate.
- Own source is `src/pirate-compound/*`, `src/combat/ship-occupancy.js`, tower/Crimson
  assets, fixture/tests and guides. Small coordinated shared edits are in main,
  dev-launch-options, build/floodlights, combat/space-combat, settlements/catalog,
  trading/local and trading/terminal-frames. No other owner's unfinished files.

Use **Hush Exchange · secret Selene compound** in the developer launcher, or
`/?dev=1&ship=nomad&start=pirate-hush&intro=0&seed=7291` with `VITE_DEV_TOOLS=1`.
Land on the outer pad, leave the hatch, follow the terrain to the lit core ramp,
isolate the tower with F/X, then enter the warehouse and open trade with F/X.
Phone uses the visible interaction action and Pilot Interface Resume.

Parent may now integrate this checked checkpoint under the standing local-testing
authorization. Source ownership transfers only for that serialized integration;
formal art, hardware/performance, missing shade sheet and separate ground enemies
remain explicitly pending. Cees retains public-release authority.
