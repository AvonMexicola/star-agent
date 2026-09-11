# Aeon retail promenade — production record

Task: open the concourse's aft wall onto a walkable retail promenade with four
storefronts and a sealed Deck 05 door, at the standard of the existing hub.

Owner: contributed change, submitted for review. Brief: extend the Deck 04 hub
aft so the far end of the concourse is a route rather than a flat directory.
Source: original geometry authored in this repository. No third-party model,
texture, font, external download or decoder dependency was used or added.

Read [`QUALITY.md`](../../../QUALITY.md), the
[asset production standard](../../asset-production-standard.md) and the
[station pipeline memory](../../../STATION-PIPELINE-MEMORY.md) before reusing
anything here. **This record is builder evidence. Independent review and Cees's
product acceptance are pending; nothing below claims either.**

## Player-visible result

Walking north up the central concourse, the flat `AEON / ORBITAL TRANSIT` panel
that used to close the far wall is now a suspended, double-sided gantry sign
hanging in front of a 9.2 m walk-through portal. Through it a 30 m promenade runs
aft: an entry bay, two storefronts, a glazed mid court with seating and planting,
two more storefronts, and a locked pressure door to Deck 05.

| Unit | Brand | Sells | Side |
| --- | --- | --- | --- |
| 1 | LONGREACH GALLEY | Hot meal tray, brew flask, field ration | Port, Z −25.7 |
| 2 | TIDEWELL OUTFITTERS | Insulated jacket, work gloves | Starboard, Z −25.7 |
| 3 | GREENSIDE HYDROPONICS | Seedling tray, culinary herb pot | Port, Z −38.9 |
| 4 | WAYPOINT SOUVENIRS | Scale hull model, printed system chart | Starboard, Z −38.9 |

Every purchase is stored cargo delivered to the station warehouse, exactly like
the existing armory and shipworks. Nothing here grants combat, ship, survival or
income effects, and stock is finite. The content is deliberately everyday and
suitable for any player: food, clothing, plants and souvenirs.

The Deck 05 door is locked and says so. Pressing interact in front of it reports
`DECK 05 SEALED · HABITAT TERRACES ARE STILL BEING FITTED OUT` rather than
silently stopping the player at an unexplained wall. It is a deliberate hook for
future work, not an unfinished path represented as finished.

## Contract

Game metres, X right / Y up / Z aft, in the existing hub frame. Floor Y −8,
shared with the concourse. Corridor X ±4.6 with its ceiling at −3.45; shop rooms
X ±4.6…13 with their own opaque ceilings, lowest underside −4.66 (3.34 m
headroom, matching the enclosed concourse shops). Mid court Z −34.6…−30.0 opens
to the full ±13 width and keeps the station glazing at X ±13.35. Sealed bulkhead
at Z −48.9; aft end cap at −49.9.

Required runtime nodes in the export: `GalleySign`, `GalleyScreen`,
`OutfitterSign`, `OutfitterScreen`, `HydroponicsSign`, `HydroponicsScreen`,
`SouvenirSign`, `SouvenirScreen`, `PromenadeDirectory`, `SealedDoorSign`,
`SealedDoorPanel`, `SealedDoorNotice`. All twelve survive material batching.

`src/station-promenade.js` owns the pressurised shell, glazing, gantry, portal
lining and lighting. `blender/build_station_promenade.py` owns storefronts,
fixtures, display stock and the locked door. Both repeat the same room planes;
the constants at the top of each file are the shared contract.

## Source and rebuild

```sh
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio \
  --python-exit-code 1 --python blender/build_station_promenade.py
```

Blender 5.2.1 LTS. Append `-- --render-dir <dir>` for CPU Cycles studio images.
The build is deterministic and rewrites only `public/models/station-promenade.glb`.
`build_station_concourse.py` and every existing station asset are untouched, so
the player-praised elevator and the current concourse remain byte-for-byte.

This installation emits the inherited `Material.use_nodes` deprecation warning
that the concourse builder also emits. Process exit, the explicit
`PROMENADE_EXPORT` summary, asset parsing and actual browser rendering were all
verified; the warning is not evidence of a failed export.

## Measured export

`public/models/station-promenade.glb`
sha256 `f2a72e2dd0a5b8910519f2671c96042ae82652d328d0847e7e464a2246a3a6ed`

| Measure | Value | Note |
| --- | --- | --- |
| GLB bytes | 4,239,556 (4.04 MB) | concourse kit is 3.80 MB for half the rooms |
| Triangles | 73,724 | vertices 155,252 |
| Meshes / draws | 10 | one static batch per physical finish |
| Materials | 10 | Ivory, Petrol, Steel, Dark, Rubber, Mint, Ochre, Paper, Warm, Foliage |
| Independent assemblies | 29 | largest 4,480 triangles / 308,596 standalone bytes |
| Collision boxes | 210 | authored, not render triangles |
| Display stock items | 82 | 11 distinct kinds |
| Textures | 0 | no image maps ship with this kit |

Every assembly is inside the repository's default prop budget of 10k triangles
and 1 MB, measured as a real standalone GLB including its own JSON and materials,
not as a share of the aggregate buffer. The builder raises and fails the export
if any assembly exceeds either limit.

**UV ownership.** This kit ships no image maps, and `ensureStationMaterialUVs`
already generates metre-scale UVs at load for every finish the station replaces.
A second authored UV channel would have cost 8 bytes on each of 150,020 vertices,
so `export_texcoords=False` is deliberate; it took the export from 5.65 MB to
3.91 MB (4.04 MB after the garment and planting rework) with no change to the
rendered surface. This differs from the concourse
kit, which predates that decision and still ships its channel.

Materials are derived from the existing CSS design tokens exactly as the
concourse builder does. Two new material names are introduced, both from tokens
already in `src/style.css`: `FinishWarm` (`--station-warm`, the sealed-door
status lamp) and `FinishFoliage` (`--mint`, unlit, for planting). No new palette
entry was added, and neither name is registered in `MATERIAL_KEYS`, so both keep
their exported values rather than being replaced by a hull finish.

## Runtime integration

- `createHub()` composes the concourse and the promenade into one hub frame:
  one collision BVH, one rebase, one set of local metres.
- The hub now has **three** walkable volumes — the concourse box plus a corridor
  and a shop band. `hubFrameMethods()` in `station-hub-policy.js` replaces
  `Station`'s single-box `deckPoint`, `deckHeightAt` and `isInsideHangar` for the
  hub only; the twenty berths keep theirs unchanged. A single rectangular hull
  over the whole L would have handed the suit a floor out in open space beside
  the corridor.
- Each volume is authored 0.3 m larger than its walls because deck support insets
  by that margin; without it the player loses the floor before the wall stops them.
- Collision for the authored kit comes from its measured assembly boxes, added to
  `hub.staticBoxes` after the concourse. The room BVH is still built once in the
  constructor, before any finish asset loads, and is not rebuilt.
- Laid floor finishes, thresholds and borders are excluded from collision by the
  builder. They are a few centimetres of finish on the deck the body already
  stands on; as solid boxes they stopped the player dead in every shop doorway.
  This was caught by the new unit suite before any capture was taken.
- The four counters and the sealed door extend `StationComplex.interaction()`,
  so the existing single F / controller-interact action serves both rooms and the
  existing shop modal and dialog router are reused unchanged.
- `station-shop.js` gains four catalogues; `ship-inventory.js` gains eight items.

### Save compatibility

Adding items and shops to a version 3 manifest would have failed that manifest's
integrity check and locked existing players out of their own save. The loader now
distinguishes a value the save *predates* from a value it carries: anything in
`VERSION3_ITEM_IDS` / `VERSION3_SHOP_IDS` is still required and still validated
exactly as strictly as before, while a later catalogue addition is migrated in at
zero owned and full shop stock. A save that needed migration is rewritten once; a
complete save is still never rewritten and never regranted credits.

### Lighting and performance

Seven spot lights are added and **no new shadow map**. They are recessed
downlights aimed at the deck: a point light hung that close under a ceiling blew
the ceiling out in the first game captures, and a cone aimed down lights the
floor, fixtures and lower walls instead. The two concourse spotlights remain the
only shadow casters in the occupied hub.

Nothing in the promenade casts a shadow, and the room is explicitly taken back
out of shadow casting after the station finish runs, because the finish enables
casting on every material it replaces. Nothing in the room has a shadow-casting
light — the downlights are shadowless by design and the concourse spotlights are
20 m forward with a 22 m far plane — so the room was being drawn into shadow maps
it can never appear in. The room still receives shadows.

The three corridor lights follow the hub itself: seen from the concourse, an
unlit corridor behind the portal reads as a hole rather than a route. The four
unit lights switch on while the player is still short of the portal and cannot
see into a side unit, so their light-count change is never a visible pop.

The corridor is deliberately lit more moodily than the glazed concourse. That is
an art decision a reviewer should confirm or reject, not an accident.

The distant annex shell is two boxes owned by `StationComplex`, deliberately not
injected into either exterior kit, because both kits assert their own assembled
triangle and primitive budgets against their own manifests.

**Download.** The kit is fetched by `loadFinish` alongside the concourse kit when
the station loads, not on hub entry, which is consistent with every other station
finish asset but adds 4.04 MB to that batch. Deferring the promenade kit until
the player first rides to the hub is a worthwhile follow-up; it was deliberately
not attempted here because it changes when `hub.staticBoxes` is populated.

## Evidence

### Unit and invariant tests

`npm test` — see the handoff entry for the exact run. New suite
`tests/station-promenade.test.js`, 10 cases:

1. export budgets, per-assembly limits, manifest/geometry agreement, draw count,
   absent UV channel and overall bounds;
2. the aft wall is open, the corridor is walkable end to end, every unit can be
   entered, each counter is solid, the mid-court wings and their glazing;
3. the bulkhead is solid across both leaves and reports sealed rather than opening;
4. every unit has an opaque ceiling with 3.3–3.6 m clearance, sampled above the
   tallest fixture, plus oblique aisle rays that must not escape over a low wall;
5. the corridor shell is sealed overhead and underfoot at 1.5 m intervals along
   its full 29 m;
6. three hub volumes give deck support across both rooms and refuse to invent a
   floor beside the corridor;
7. counter approach points resolve to the right catalogue and the prompt ends
   within reach;
8. display stock is varied, human scale and backed by real geometry;
9. the suspended gantry clears a walking body and hangs in front of the portal;
10. the distant annex shell encloses both rooms, meets the concourse shell
    without a gap and contributes no collision triangles.

The test builds the room BVH **before** attaching the authored kit, exactly as
`StationComplex` does. Building it afterwards makes render triangles solid and
produces false passes and false failures; that mistake was made and corrected
during this work.

### Studio renders

`blender/build_station_promenade.py -- --render-dir …`, CPU Cycles, 24 samples,
1200×800: `studio/promenade.png`, `galley.png`, `outfitter.png`,
`hydroponics.png`, `souvenir.png`, `sealed-door.png`. **These are Blender studio
images, not game rendering, and establish geometry and silhouette only.**

### Game capture and input journeys

`scripts/station-promenade.spec.js` / `scripts/promenade.config.js`, run against
a production build:

```sh
CHROMIUM_PATH=<chromium> npm run test:browser -- -c scripts/promenade.config.js
```

**Controller journey.** Leave the ship, walk the berth, call and ride the
passenger elevator, cross the concourse under the new gantry, pass through the
portal, visit all four storefronts, buy one item in each through controller focus
and A, close each modal with B while a stick is held, reach the sealed door and
be refused, then walk the whole route back. The fixed-camera on/off cost pair is
taken at two poses inside this journey.

**Keyboard and phone journey.** The same room with the gamepad removed: WASD and
the arrow keys, F to interact, Tab/Enter in the modal, Escape to close. It
captures the corridor and the catalogue at 390×844 as well as 1440×900, and ends
refused at the sealed door.

Neither journey writes a pose, teleports, or sets inventory; every metre is
driven through real input. Injected `Gamepad` input is **not** physical hardware
testing and is reported separately. The walkers step around obstacles with the
strafe axis when progress stalls, exactly as a player does; no collision is
bypassed.

Results, exact commands, environment, per-capture draw/triangle counts and the
captures themselves: `browser/controller/` and `browser/keyboard/` in this
directory. Each `report.json` there is a trimmed projection of the harness
report — the per-step `starAgent.state` is reduced to the fields this record
cites, because the full snapshot is a quarter of a megabyte of unrelated
subsystem state per run. Errors, warnings, failed requests, environment, scene
metrics and every alternation pair are kept verbatim; re-running the config
regenerates the complete dump.

### Measured room cost

The controller journey alternates the promenade group on and off at one fixed
camera pose, five pairs each, and keeps every pair in
`browser/controller/report.json`. Both halves run in the same session against the
same scene.

Conditions: Chromium 151.0.7922.34, ANGLE / AMD Radeon integrated, 1440×900 at
render scale 0.8, **with Playwright recording 1440×900 video throughout**. The
frame figures are RAF cadence under that load — a paired relative reading, not an
FPS claim and not a GPU timer result. The pipeline memory's separation of RAF
cadence, CPU callback time and GPU timing is deliberately preserved here.

| Fixed pose | Draw calls | Triangles | RAF median with / without |
| --- | --- | --- | --- |
| Standing inside the promenade entry | +34 | +78,292 | 66.7 / 50.0 ms |
| Standing in the concourse, looking aft | +41 | +78,306 | 50.0 / 33.4 ms |

The added triangles are the room's own geometry, once: 73,724 in the GLB plus the
procedural shell. **Before the shadow-casting change** the entry pose measured
+82 draws and **+308,952 triangles** — roughly four times the room's own count,
because the station finish enables shadow casting on every material it replaces
and the room was being drawn into shadow maps it can never appear in. Whole-scene
counts across the in-world captures fell from 0.91–1.26 M triangles before that
change to **0.75–1.03 M** after it, at 178–376 draws.

The occupied hub still exceeds the repository's ≤900k hangar/cockpit triangle
target at the busiest poses; it did so before this change as well, and this room
contributes about 78k of that. Opaque modal captures record 0 draws, so the scene
is skipped entirely, matching the modal budget line.

A reviewer with a declared laptop GPU should take proper GPU timer medians for
the hub with and without this room; that measurement is not claimed here.

## Known gaps

- Independent review and product acceptance are pending. No score is claimed.
- Physical controller hardware has not been tested; only injected Gamepad input.
- No shopkeeper characters stand in the four new units. The existing merchants
  are Meshy-sourced assets outside this contribution's scope.
- The Deck 05 door is scenery with a runtime label. It has no animation, no
  interior behind it and no unlock path, and is labelled accordingly in game.
- No GPU timer measurement. The fixed-camera on/off pair below is RAF cadence
  taken while Playwright was recording video, on an integrated AMD part through
  ANGLE; it is a paired relative figure, not an FPS claim and not a GPU result.
  A reviewer with a declared laptop GPU should take proper medians.
- The concourse kit's own UV channel was left as it is rather than rebuilt, to
  keep that asset byte-for-byte.
- The promenade kit is downloaded with the rest of the station finish rather than
  on hub entry; deferring it is a worthwhile follow-up, described above.
- The print rack in WAYPOINT SOUVENIRS reads as a card rack from the aisle but
  is chunky at arm's length in the studio close-up. Noted rather than iterated.
