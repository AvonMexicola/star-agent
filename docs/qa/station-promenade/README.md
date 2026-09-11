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
| 1 | COSMIC CHICKEN | Hot meal tray, brew flask, field ration | Port, Z −25.7 |
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
sha256 `5d42bc53d89019ddffc9e5894a54a32c46611fc24670f919aba9f673ba945c0e`

| Measure | Value | Note |
| --- | --- | --- |
| GLB bytes | 4,318,192 (4.12 MB) | concourse kit is 3.80 MB for half the rooms |
| Triangles | 75,420 | including the tenant fit-out |
| Meshes / draws | 10 | one static batch per physical finish |
| Materials | 10 | Ivory, Petrol, Steel, Dark, Rubber, Mint, Ochre, Paper, Warm, Foliage |
| Independent assemblies | 32 | largest 4,480 triangles |
| Collision boxes | 99 | authored, not render triangles; see the walking-cost audit |
| Display stock items | 82 | 11 distinct kinds |
| Textures | 3 | the tenant's prints, ~235 KB of WebP |

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

## Tenant fit-out: COSMIC CHICKEN

The galley unit is dressed as a named tenant. `blender/build_station_promenade.py`
builds three print cassettes — recessed backplate, paper backing, folded edge
channels, captive fasteners, and a lit hood over the board — and
`src/station-cosmic-chicken.js` hangs the artwork on their anchors at runtime,
2 mm off the paper, exactly as the concourse campaigns work.

| Print | Wall | Size | Anchor |
| --- | --- | --- | --- |
| Wings poster | Fore party wall, Z −21.4 | 1.05 × 1.312 m | `CosmicPosterFore` |
| Sando poster | Aft party wall, Z −30.0 | 1.05 × 1.312 m | `CosmicPosterAft` |
| Menu board | Back wall over the service run, X −12.94 | 1.72 × 1.29 m | `CosmicMenuBoard` |

Each print is one plane and one material: three draws, no collider, no shadow
caster, and `Sign_` named so the room collider and the hub's shadow policy skip
them. A failed image leaves a plain printed board and never breaks the station.

Sources, provenance (ChatGPT with Imagen 2.5, the exact request quoted), the
1024-max WebP encoding and the **wordmark repair** — the supplied poster masters
read COSAIC CHICKEN, so the correct word is lifted from the menu master — are
recorded in [`assets/cosmic-chicken/README.md`](../../../assets/cosmic-chicken/README.md).

**Placement defect, found and fixed before submission.** The first build of the
runtime hanger read each anchor's *world* position and used it as the print's
*local* position. The two are the same only while the station sits at the
origin, which it does in a unit test and never in the game: the finish attaches
after the station has been placed and rebased, so every print landed roughly
2.7 million metres from its cassette and the player saw bare paper on all three
boards. `scripts/promenade-inspect.spec.js` reproduced it from fixed poses — the
`PRINTS` line reports each plane's distance from its anchor — and the prints are
now read back through the parent's inverse matrix, as the concourse campaigns
already were. `tests/station-cosmic-chicken.test.js` pins each plane to its
anchor under a parent placed at −416, −824, 435 m with the station's real base
rotation, and fails on the old code by 1,003 m.

The board is the tenant's dine-in menu and is decoration. The purchase catalogue
is still `STATION_SHOPS.galley`: sealed take-away delivered to the station
warehouse, with eating and drinking unimplemented and stated in the modal. Board
prices are set dressing and are not a second economy.

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

All seven lights follow the hub itself, on and off together with the concourse
lights. A first version switched the four unit lights on only as the player
neared the portal. That changed Three's light count mid-walk, which forces every
material in view onto a differently compiled program, and the driver paid for
those compiles as a visible freeze right before the new area — the profiler's
1.1 s frame one tick after arriving at "before the portal", repeated at 350–420
ms on every later crossing of Z −12. One light configuration for the whole hub
means one compile, at hub entry, where the concourse lights already cause it.
The four extra spot lights cost the concourse some fragment work; that trade is
deliberate. The walking-cost audit below has the paired measurement.

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

`tests/station-cosmic-chicken.test.js`, 4 cases:

1. every print anchor survives material batching, hangs inside the galley unit,
   has `FinishPaper` directly behind it within 2 cm, faces open room for its full
   height, and keeps the masters' aspect ratios;
2. the prints become one plane and one material each, are `Sign_` named so the
   room collider and shadow pass skip them, and a failed image still leaves a
   printed board;
3. under a parent placed at −416, −824, 435 m with the station's base rotation,
   every plane is at 0 m from its anchor and its normal follows the station — the
   regression test for the bare-paper defect, which fails on the old code by
   1,003 m;
4. the galley is branded COSMIC CHICKEN on the fascia, in the prompt and in the
   modal, and the catalogue still states what is not implemented.

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

The committed evidence is from the final tree: the controller journey and the
keyboard journey were taken in separate runs of the same production build, both
passing with zero page, console, HTTP and failed-request entries. In the first
combined run the keyboard walker wedged itself in the corner between the galley's
standing rail, the fore party wall and the portal pier — a 0.68 m strip its
back-off-and-strafe recovery kept re-entering — while the controller journey
crossed the same room without incident, and the authored collision boxes were
checked against both routes and block neither. The walker now feels for the open
side when a strafe fails, as a player does, and the keyboard run passed on the
next attempt; the standing rail itself was not moved.

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

### Print captures

`scripts/promenade-inspect.spec.js` (run through `promenade-profile.config.js`)
places the camera at four fixed poses inside the galley unit on a production
build and captures each COSMIC CHICKEN print, after first reporting every
plane's distance from its anchor in hub metres. The captures in
[`browser/prints/`](browser/prints/) are from the build described under the
walking-cost audit: `fore-poster`, `aft-poster`, `menu-board` and
`unit-overview`, every plane at 0.000 m from its anchor, all three textures
`ready`, no page or console errors. This is a pose write, not an input journey,
and exists only to prove the artwork renders where the kit put its cassette.

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
| Standing inside the promenade entry | +34 | +79,988 | 50.0 / 49.9 ms |
| Standing in the concourse, looking aft | +44 | +80,008 | 33.4 / 33.4 ms |

The added triangles are the room's own geometry, once: 75,420 in the GLB plus the
procedural shell; the three prints add three draws and six triangles, and the
cassettes that carry them the rest of the difference from the earlier 73,724.
**Before the shadow-casting change** the entry pose measured
+82 draws and **+308,952 triangles** — roughly four times the room's own count,
because the station finish enables shadow casting on every material it replaces
and the room was being drawn into shadow maps it can never appear in. Whole-scene
counts across the in-world captures fell from 0.91–1.26 M triangles before that
change to **0.75–1.03 M** after it, at 178–376 draws.

The occupied hub still exceeds the repository's ≤900k hangar/cockpit triangle
target at the busiest poses; it did so before this change as well, and this room
contributes about 80k of that. Opaque modal captures record 0 draws, so the scene
is skipped entirely, matching the modal budget line.

A reviewer with a declared laptop GPU should take proper GPU timer medians for
the hub with and without this room; that measurement is not claimed here.

### Walking-cost audit

Reported symptom: two or three momentary freezes while walking the new section
and, after the first fix round, "a microfreeze before entering our new area".

`scripts/promenade-profile.spec.js` drives the route from **inside the page** —
a Playwright round trip per frame costs tens of milliseconds and would bury the
stalls being measured — samples every animation frame, and wraps the WebGL calls
that can block: program link, compile and query, `texImage2D`, `texSubImage2D`,
`texStorage2D`, `generateMipmap`, `bufferData`, `bufferSubData`, `useProgram`,
every draw call, `readPixels`, `finish`, `flush`, `getError` and `clientWaitSync`.

**What a wrapped call cannot see.** Chromium runs the graphics driver in its
GPU process. A shader compile or an upload that stalls there returns to the page
immediately and lands as a long frame with no event — the same signature as a
garbage collection. The first version of this profiler reported that every
walking spike carried zero driver time and concluded the cost was CPU
allocation. That was wrong in the part that mattered, and the record is left
corrected rather than rewritten: the 1.1 s frame at the portal was a driver
stall. The profiler now also records Long Tasks (time the page's own thread was
busy) and the JS heap every frame (a drop is a collection), so a long frame with
neither is time spent waiting on the GPU process, and each spike reports both.

**Finding 1 — the freeze before the portal.** The first build switched the four
unit lights on when the player reached Z −12. Three compiles one program per
material and light configuration, so changing the number of visible spot lights
mid-walk sends every material in view through a new compile and link, and on a
laptop driver that is a hard stall. Profile before the fix, ANGLE GL, quiet
machine: 1,100 ms one frame after arriving at "before the portal", then 350 ms
at "second entry" and 367 ms at "second return" — every crossing of Z −12, in
both directions. Fix: all seven promenade lights follow the hub, giving the hub
one light configuration and one compile, at hub entry, where the concourse
lights already cause it.

Profiles after the fixes — production build, ANGLE **D3D11** (the backend
Chrome uses on a Windows laptop), dev server stopped, nothing else rendering:

| Measure | Before (ANGLE GL) | Lights fixed (D3D11) | Lights and compile fixed (D3D11) |
| --- | --- | --- | --- |
| Walking frames | 2,009 | 1,839 | 1,820 |
| Median frame | 116.7 ms | 49.9 ms | 49.9 ms |
| p95 frame | 183.4 ms | 66.7 ms | 66.7 ms |
| Longest frame | 1,100 ms, at "before the portal" | 533 ms, first look into the galley | 116.8 ms, nothing attributed |
| Frames ≥ 35 ms and ≥ 3× median | 5 | 2, both that first look | **0** |
| Programs linked during the walk | not tracked | 8, all at the first look into the galley | **0** (162 before, 162 after) |
| Portal crossings with a spike | 3 of 4 | 0 of 4 | 0 of 4 |
| JS heap over the walk | not sampled | 456 → 545 MB | 493 → 482 MB |

The medians are **not** comparable with the first column: the backends differ
and that run had no prints in view. The comparable facts are the last four
rows. The third column's summary is committed as
[`browser/profile/profile-d3d11.json`](browser/profile/profile-d3d11.json); an
earlier pass of the same build, whose walker wedged at the souvenir unit after
the first pass, gave the same result over 5,179 frames (161 programs before
and after, longest frame 133 ms).

**Finding 2 — the first look into a unit.** With the lights fixed one stall
remained, at "walk galley lane": five programs linked in one frame — 105 ms
with a warm driver shader cache, **1,983 ms with a cold one** (355–422 ms per
link), and cold is what a private or incognito window gives every session. The
profiler now records program creation per frame and diffs each new program's
cache key against an older program of the same material, which named them:
`Nomad / cabin manufactured PBR`, the Nomad's reentry hull shader and its
directional glazing, `Meridian weapon / baked PBR` and `Meridian Bastion /
original swatch PBR` — the docked ship and the handhelds, not the station —
compiled for the hub's light configuration (spot lights 0 → 9, spot shadows
0 → 2). Three culls by frustum only; nothing culls what a wall hides. Facing
west from the galley lane sweeps the berth ring, so the docked ship enters the
frustum a kilometre away behind two walls, is drawn, and links its materials
under hub lighting there and then.

Two attempts that did not touch it are kept in the record. Compiling the hub
group at hub entry changed nothing: the ship is not in it. Binding the frame's
render target during that compile was necessary but not sufficient — Three keys
a program on the bound target's colour space and tone mapping, and the scene
renders through the atmosphere's target, so a compile against the bare canvas
prepares programs the frame never uses; the game's own startup `compileAsync`
had the same flaw. The fix compiles the **whole scene** for the hub's
configuration the moment the hub lights switch on (`station.onHubLit` →
`compileForFrame(scene)` in `main.js`, links completing in the GPU process
while the player is still riding the lift), and the startup compile is bound to
the frame target the same way. Whole-walk totals afterwards: three program
queries, 86 ms, all link-status reads on programs already built; no
texture, buffer or sync call over 4 ms.

Four CPU changes on the walking path this room made hotter, kept because each
strictly removes work, not because a measurement credits them:

| Change | Was | Now |
| --- | --- | --- |
| `constrainStep` collision list | a fresh array built by spread every frame, for each of 21 station frames; the hub's was ~295 entries | one reusable buffer per frame |
| `elevatorBoxes` in that path | an array, 2 `Box3` and 4 `Vector3` per frame **per frame object**: 126 objects a frame for two doors | `updateElevatorBoxes` writes into the lift's own pair; the allocating form stays for tests |
| `stationPhysicsAt` | a `Vector3` for each of 20 berths on every query, several times a frame | one shared probe, allocating only the result a caller keeps |
| Promenade collision boxes | 210, over half of them ceiling skins, beams, downstands and fascias | 99; anything entirely above 3.1 m is dropped at export |

That last one is a geometry decision, not a fudge. The suit's eye is 1.75 m up,
its head 1.9 m, and a 4.5 m/s jump under 9.81 m/s² peaks at 1.03 m, so nothing
above 3.07 m can be touched; those boxes were being swept against the walking
body every frame for nothing. The pressurised shell above them is separate
procedural geometry and still stops a ship. The hub's per-frame sweep list falls
from 287 boxes to 173, and roughly 190 object allocations per frame leave the
station walking path. No frame-time improvement is claimed for them.

**Limits.** The profiler runs on an integrated AMD part through ANGLE, so its
absolute numbers are not a frame-rate claim; the paired marks and the program
counts are the evidence. On this machine an ordinary frame is about 50 ms, so
the Long Tasks API flags most frames; only the per-spike attribution is used,
never the raw count. Link times swing an order of magnitude with the driver's
shader cache — Playwright launches a fresh profile each run, so any run may be
cold — which is why program *counts* are compared rather than milliseconds. A
single run per configuration is one sample, not a characterisation, and the
reporter's own laptop was not instrumented. `PROMENADE_ANGLE=gl` reproduces the
documented Linux-style backend; `d3d11` is the one a Windows laptop actually
uses and is what the "after" row was taken on.

## Known gaps

- Independent review and product acceptance are pending. No score is claimed.
- Physical controller hardware has not been tested; only injected Gamepad input.
- No shopkeeper characters stand in the four new units. The existing merchants
  are Meshy-sourced assets outside this contribution's scope.
- The Deck 05 door is scenery with a runtime label. It has no animation, no
  interior behind it and no unlock path, and is labelled accordingly in game.
- No GPU timer measurement. The fixed-camera on/off pair and the walking
  profile are RAF cadence on an integrated AMD part through ANGLE; they are
  paired relative figures, not an FPS claim and not a GPU result. A reviewer
  with a declared laptop GPU should take proper medians.
- The concourse kit's own UV channel was left as it is rather than rebuilt, to
  keep that asset byte-for-byte.
- The promenade kit is downloaded with the rest of the station finish rather than
  on hub entry; deferring it is a worthwhile follow-up, described above.
- The compile at hub entry prepares every scene material for the hub's light
  configuration, including materials the player may never see from the hub;
  that is the price of Three culling by frustum only. An occlusion or per-berth
  visibility rule would let it shrink to the station's own materials, and would
  also stop the docked ship being drawn through two walls.
- The in-page profiler's walker is coarser than the acceptance walkers and can
  wedge itself against furniture; it is measurement, and the storefront legs it
  misses are reported rather than failed.
- The print rack in WAYPOINT SOUVENIRS reads as a card rack from the aisle but
  is chunky at arm's length in the studio close-up. Noted rather than iterated.
