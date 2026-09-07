# Atlas heavy logistics

Atlas is the current **64 m playable freighter** in this source. The same ship
appears in the fleet, multiplayer and Atlas studio; the retired 30 m model is no
longer a second playable choice. The implementation is integrated in the fleet
candidate through `cee70b7`. Combined rendered acceptance and promotion to shared
development are still pending; see the [integration record](qa/fleet-engine-integration.md)
for the dated results and eventual delivery receipt.

Atlas has a **64 × 36 × 16 m** nominal hull envelope, a cargo deck at 2.6 m and
an upper deck at 9.5 m above its landing plane. It carries **512 SBU of physical
crates** and retains its separate **2,400 kg supplies inventory**, four live pilot
MFDs, three S3 weapon mounts and six folding landing assemblies. The default
station uses the enlarged fleet bays, without shrinking the ship.

In normal solo play, land on a surface and then dock at Aeon Orbital to unlock
Atlas. Open **Fleet with U** or **Menu → Ship → Fleet**, then select Atlas while
seated at the station. The exploration milestone and selected ship persist in
the browser without an account. Supplies transfer with ship selection; switching
to the 120 kg Nomad is refused while those supplies exceed its capacity. The
development launcher bypasses unlocks and uses temporary test inventory.

## Boarding, decks and controls

**F / controller X** operates reachable controls and enters or leaves the pilot
chair. From the bridge, walk aft to the starboard **crew lift**. Its call pedestal
summons an absent platform; enter through the open safety gate and interact again
to change decks. This is the ship's only lift, connecting cargo and upper decks.
It carries the rider physically and refuses lift motion while someone straddles
its edge. Wait for the platform and destination gates to stop before walking out.

The cargo deck has wide **forward and aft loading ramps**, each with an interior
control and a visible exterior ground call panel beside the doorway. Open a ramp,
wait until its main leaf and folding tip finish moving, then walk along it to the
ground. To reach the exterior call from the centreline, walk around the ramp toe
before turning along its side. For exact ship-local route coordinates, see the
[station boarding receipt](qa/atlas-playable/station-cargo-tests.md).

Main power is required to operate ramps and the crew lift. Loading ramps stay
locked in flight; the enclosed crew lift remains usable in a powered moving cabin.
Power loss freezes its motion. Close both ramps and stop the crew lift before
launching with **B / controller Y**. **G** controls the six folding landing
assemblies; their progress also governs flight limits and weapon readiness.

The cargo deck is fixed. There is no belly elevator or pair of internal cargo
lifts. The two saved cargo grid IDs and cell coordinates remain compatible,
retaining 512 SBU and a 5 m clear centre lane. Only 1 SBU crates can be carried by
hand; larger crates use the physical tractor. See [cargo and trading](sbu-cargo.md)
and [tractor controls](cargo-tractor.md).

## Development starts and studio

Run `npm run dev:all`, then use **F2 / Menu → Dev → Test starts**. Choose Atlas
and Station hangar for a parked pilot start. Normal solo and multiplayer entry
retain the shoulder-camera opening; explicit development starts skip it.

For immediate ground mining, choose **Burrow mining — Selene surface**. It starts
seated in Burrow beside the real Crescent outcrop, with all four wheels on
canonical terrain. The selected ship stays parked at the station. Drive with
WASD / left stick, mine with T / RT, inspect ore with I / View, and exit or reboard
through the rover's real door and steps with F / X. This start is offline and
needs no carrier unloading. The separate **Atlas + Burrow mining rover · Selene**
entry parks Burrow in Atlas and uses its actual aft ramp. Ground and carrier
checks are recorded in the [ground-start receipt](qa/mining-rover/surface-start.md)
and [carrier receipt](qa/mining-rover/atlas-carrier.md); combined browser routes remain pending.

`/dev/atlas-mark-ii.html` inspects the same current Atlas geometry and mechanisms.
The old `/dev/freighter.html` bookmark redirects there. A studio view is an asset
inspection surface, not evidence that the full gameplay journey passed.

## Authoring and integration

- Builder and source: `assets/atlas-mark-ii/build_atlas.py`,
  `assets/atlas-mark-ii/atlas-mark-ii.blend` and the adjacent `layout.json`.
- Runtime asset: `public/models/atlas-mark-ii/atlas-mark-ii.glb`, selected by
  `ATLAS_MODEL_URL`. The hero contains 59,443 triangles / 3,859,404 bytes; source
  identity and geometry limits are in the [asset checkpoint](qa/atlas-fleet-refresh/iteration-01/review.md).
- Coordinates remain ship-local metres, +Y up and -Z forward. Named ramps,
  folding tips, seals, crew platform/gates and landing nodes follow the authored
  systems; no world coordinates enter the GLB.
- `src/atlas-gameplay.js` supplies the gameplay adapter and full-size collision
  parts. `src/freighter-layout.js` retains existing import names for that adapter.
  Navigation advances mechanism/rider state; the renderer consumes the same state.
- `src/freighter.js` loads the current hull, pilot displays and physical controls,
  with a matching procedural fallback. Multiplayer uses the same asset and
  canonical ramp, crew-lift and gear snapshots. Protocol 5 requires paired
  frontend/API integration; existing account and cargo saves are retained.
- Authored twin engine mouths use actual forward acceleration and boost. Coasting
  keeps idle cores; power-off retires exhaust. Fleet engine voices and local music
  respect user activation, explicit mute and menu/focus/transit suspension.

The [playable adapter receipt](qa/atlas-playable/README.md) records CPU geometry,
gear, walking, MFD, weapon and engine checks. The reusable authoring workflow is
in [Ship pipeline memory](../SHIP-PIPELINE-MEMORY.md).

## Verification commands and limits

```sh
node --test tests/atlas-playable.test.js tests/freighter.test.js tests/opening-navigation.test.js tests/station.test.js tests/sbu-cargo.test.js
VITE_DEV_TOOLS=1 npm run build
npm run test:browser -- -c scripts/fleet-development.config.js --grep 'atlas:'
```

The compatibility invocation
`npm run test:browser -- -c scripts/freighter.config.js` selects that same single
Atlas case. Both browser commands use the already built developer-enabled `dist`
through the shared fleet configuration; they do not build it automatically.
Use `--list` to verify selection without launching Chromium. Coordinate the one
browser job with other agents before running the journey.

The current fixture starts parked through the supported development URL, then
uses an injected standard Gamepad to leave the chair, call/ride the crew lift,
walk the forward ramp, operate its ground panel, return to the chair and launch.
It reads state to steer; it does not write player/ship poses. It captures the
actual MFDs, cargo deck, ramp and departure and collects page/console errors.
This replaces the old belly-lift tests; it does not establish the retired unlock,
missing-asset or inventory browser assertions on the new hull. CPU fallback and
save checks, physical hardware, native touch, final art and whole-scene performance
remain distinct from this injected-controller route. No new browser pass is
claimed by this documentation/configuration update.

## Historical 30 m Atlas record — 2026-09-06

The former hull used `assets/ship/build_freighter.py`, `assets/ship/atlas.blend`
and `public/models/atlas.glb`. Its 30 m envelope, 4 m cargo deck, 8 × 10 m belly
elevator and two internal cargo lifts describe the retired asset only.

That checkpoint recorded 76 unit checks, a production build, four production
browser checks and two studio checks, with [PR #14](https://github.com/AvonMexicola/star-agent/pull/14)
submitted for review at the time. Browser fixtures seeded landing/docking
approaches before exercising the old lift, inventory and launch routes. Chromium
with ANGLE/SwiftShader used 1600 × 1000 studio and 1440 × 900 game views; those
were correctness checks, not hardware FPS results. They do not validate the
current 64 m ship or its combined development build.

The old mesh-budget follow-up reduced that asset from 84,580 triangles /
5,652,816 bytes to 58,460 triangles / 3,770,128 bytes by using two bevel segments.
Its recorded focused tests covered the old three-lift layout; visual review of
that reduction was pending. These captures predate that reduction and show the
retired geometry:

![Historical 30 m Atlas exterior](images/atlas-exterior.png)
![Historical belly elevator](images/atlas-elevator-lowered.png)
![Historical internal cargo lifts](images/atlas-cargo-lifts.png)
