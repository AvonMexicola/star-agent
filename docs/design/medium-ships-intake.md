# Meridian medium ships: bounded intake and authoring contract

Read-only intake, 2026-09-07. Proposed ships: **Stratum M-05**, an 18 m dedicated mining spacecraft, and **Gannet T-06**, a 24 m transport carrying one Burrow M-04 rover. Root accepted these names and size bands as working designs. Burrow is the current payload assumption; carriage of another spacecraft is outside this first brief. The dimensions below are authoring targets, not claims of implemented or visually accepted ships.

## Source basis

The dimensions and system inventory were read from `star-agent-dev` at `20e9f1b50b3409cccda58a7db04d3d1d56797ec8` and final rover worktree `star-agent-mining-rover` at `641d5179a8aa72c2bf0e361c44fe2656c883c57b`. Dev advanced during intake to `0a18574f308ba343c86e7a96ccf9ed6ad4344793` through the player performance delivery; the inspected hull, fleet, cargo, mining and handling definitions did not change. Relevant navigation changes must be preserved during integration. The default `star-agent` working directory is an older, dirty controller branch and is not the source baseline for these designs.

No repository, branch, service, asset or GPU state was changed. Only this external report was created. One read-only call of the existing rover bounds/containment helpers checked the proposed bay dimensions; no browser acceptance or performance measurement was performed.

## Existing fleet: actual playable dimensions

All coordinates are metres, +Y up, -Z forward. Length is Z extent; width is X extent. Closed-flight bounds include the conservative gear envelope.

| Hull | Length × width × height | Authoritative bounds / entry | Existing capacity |
| --- | --- | --- | --- |
| Nomad 02 | **11.10 × 12.10 × 4.28** | `boarding.js`: min `[-6.05,0,-6.82]`, max `[6.05,4.28,4.28]`; deck 1.0; interior X ±1.65, Z -4.18…3.8; rear hatch at Z 4, width 1.8; ramp X ±0.9, Z 4…7.2, Y 1…0 | **6 SBU** physical freight, 120 kg supplies; mineral boxes are a separate store |
| Kestrel | **13.502 × 9.00 × 3.20** | `kestrel-access.js`: min `[-4.5,0,-6.752]`, max `[4.5,3.2,6.75]`; one-seat cockpit, port ladder/canopy, entry eye `[-2.45,1.75,-1.75]` | No freight or supplies |
| Atlas, flyable | **30.00 × 19.00 × 9.80** | `freighter-layout.js`: min `[-9.5,0,-16]`, max `[9.5,9.8,14]`; deck 4.0; interior X ±6, Z -12…10; main lift 8 × 10 m, X ±4, Z 0…10, Y 0…4 | **512 SBU** physical freight, 2,400 kg supplies; Burrow carrier |

The 64 m Atlas Mark II is a separate studio design, not the current playable freighter. The old `src/ship.js` Nomad is also not the current walkable model; use `src/ship-walkable.js`. Both proposed hulls sit between the actual 11.1 m Nomad and 30 m Atlas in length and below Atlas in beam and height.

## Working hull contracts for asset authoring

These exact envelopes leave some shape freedom inside them. Any change to floor, portal, vehicle bay or travel envelope requires a matching layout change before runtime integration. Do not scale an existing complete hull.

### Stratum M-05: dedicated miner

**Working band:** 17–19 m long, 12.5–14 m wide, 5–6 m high. **Initial contract:** 18 × 13 × 5.6 m; closed bounds min `[-6.5,0,-10]`, max `[6.5,5.6,8]`. Design an enclosed working hull with two forward outboard mining booms, protected operator glazing and a clearly readable ore/service section. It should look purpose-built for extraction, with a more compact aft volume than the transport.

- Main deck Y **1.35**. Habitable route X ±1.8, Z **-6.2…7.0**; minimum clear ceiling Y **3.65**. Fitted cabin may occupy the forward portion, with ore handling and service space aft. Keep a continuous **1.1 m clear central aisle**. One pilot seat is required; an operator seat and two compact rest berths can be fitted outside this aisle.
- Pilot eye `[0,2.90,-5.8]`; standing eye `[0,3.10,-4.2]`. Use the actual seated camera/FOV and four readable physical MFDs when fitting the console. These are layout targets, not a reason to move the runtime eye to conceal obstruction.
- Rear portal: centre X 0, Z **7.0**, clear width **1.9**, clear height **2.2** above the deck. The full doorway and its approach stay clear of cargo, furniture, boom structure and actuator hardware.
- Personnel ramp: X ±0.95, Z **7.0…12.2**, Y **1.35…0**; run 5.2 m, angle **14.55°**. It extends beyond flight bounds only when deployed. Authored hinge and sill should have no more than **20 mm** protrusion into the walk surface. Closed ramp and all gear/boom poses must fit the stated flight envelope. Ground contact must derive from canonical terrain/support; no second floor.
- **384 kg dedicated ore bin** using eight existing 48 kg mineral boxes; name and persist this bin separately from the handheld pack and shared ship supply manifest. **32 SBU freight** in two 16 SBU banks: each has a 1.2 × 1.2 × 2.4 m clear cell volume, placed outside the aisle. Do not let freight capacity stand in for ore capacity. Suggested supplies: **240 kg**, explicitly a third ledger.
- Mining tools are functional equipment with named pivots and actual muzzle nodes. Proposed names: `MiningBoom_Port`, `MiningBoom_Starboard`, `Muzzle_Mining_Port`, `Muzzle_Mining_Starboard`. Freeze their actual axes and limits in the layout. Do not invent combat fittings or weapons to fill the silhouette.

### Gannet T-06: Burrow transport

**Working band:** 23–25 m long, 15–17 m wide, 6.5–8 m high. **Initial contract:** 24 × 16 × 7.2 m; closed bounds min `[-8,0,-13]`, max `[8,7.2,11]`. Use a broad protected rear vehicle bay, a distinct forward cabin and outboard drives. The silhouette should communicate loading access and stable carriage rather than mining booms.

- Main deck Y **1.4**. Forward cabin envelope X ±2.0, Z **-9.5…3.4**, minimum clear ceiling Y **3.8**. Keep a continuous **1.2 m aisle** from the forward edge of the vehicle bay to cockpit/rest space. Pilot eye `[0,2.95,-8.4]`, stand eye `[0,3.15,-6.8]`. One pilot is required; a passenger seat and two rest berths may occupy fitted side zones.
- Protected vehicle bay and platform clear dimensions: **5.0 m wide × 6.5 m long × 3.2 m high**. Ship-local X **-2.5…2.5**, Z **4.5…11.0**, raised floor Y **1.4**, ceiling no lower than **4.6**. These are net clear dimensions after rails, lights, hinges and bulkheads, not external panel dimensions.
- Use **one rear belly lift**, Y **0…1.4**, as both the rover and personnel boarding route. This reuses the proven Atlas moving-floor approach and avoids introducing a second vehicle-ramp solver in the first brief. Ground-facing rear opening at Z 11 must remain clear across the full bay width; no fixed aft sill or bridge may obstruct driving off the lowered platform. Raised rear portal clear height is 3.2 m. Hatch travel, lift rails and support beams stay outside the clearance volume. Lift and hatch are secured before flight.
- Initial Burrow park: `[-0.3,1.4,7.525]`, heading **π**, facing aft for unloading. Its port door then faces ship starboard; its ground-entry eye is `[2.1,3.15,7.625]`. Reserve that complete route, including the player's 0.25 m capsule and opening rover door. The entry point leaves only **0.15 m beyond the capsule** to the nominal bay wall, so no decorative intrusion is available on that side. The actual door-swing mesh remains a required geometry check.
- **128 SBU usable while Burrow is aboard**, in two separate 64 SBU banks outside the 5 m bay. Each bank requires 1.2 × 2.4 × 4.8 m clear cells. An initial placement is port X -3.7…-2.5 and starboard X 2.5…3.7, Y 1.4…3.8, Z 4.5…9.3. Mount structure must sit outside the net clear bay/cell volumes. Do not count the rover parking region as simultaneously available freight.
- Suggested supplies: **960 kg**. Burrow retains its own **96 kg** ore bin. Gannet itself has no mining beam in this brief. Its value is vehicle delivery, protected access and freight capacity.

## Burrow clearance and access evidence

Final candidate10 asset SHA256: `88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f`; 2,177,260 bytes, 21,570 triangles. Source is `assets/mining-rover/layout.json` plus `src/rover-{layout,physics,support}.js` and `src/mining-rover.js` in the final rover worktree.

- Straight-wheel bounds: min `[-1.72,0,-2.55]`, max `[1.3,2.5,2.1]`: **4.65 × 3.02 × 2.50 m**. The asymmetry includes fixed port boarding steps.
- The actual `roverSweptBounds()` helper returns min `[-1.72,-0.22,-2.55]`, max `[1.5119415076,2.5,2.1]`: **3.2319415076 m steered width**, 4.65 m length and 2.72 m full suspension envelope. A 3.02 m opening is insufficient.
- Port door is 1.04 × 1.92 m. Entry eye is `[-2.4,1.75,-0.1]`; the route continues through the real steps and door to pilot eye `[0,1.78,-0.82]`. A bay sized only around wheels cannot provide physical boarding.
- The existing complete-assembly containment helper passed the proposed **5 × 6.5 × 3.2 m** bay with a **0.35 m hull margin** at the proposed relative park pose. The calculation used a translated bay Z range 1…7.5; adding 3.5 m to the bay and park yields the Gannet coordinates above. This checks the current steering/suspension envelope, not authored walls, rover door swing, player sweeps or floor support.
- Preserve four-wheel canonical support, 120 Hz fixed stepping, max step 0.26 m and current max slope 0.52 rad. Low ceilings already cause an abrupt Atlas chase-camera contraction; reserve camera clearance and test the transition deliberately in Gannet.

## Capacity and handling separation

SBU is a **0.6 m cubic cell**, not kilograms. Freight packing, mineral mass and supplies are distinct contracts (`cargo/grid.js`, `inventory/containers.js`, `mining/store.js`, `fleet.js`). Current mineral containers allow at most eight 48 kg boxes; the Stratum proposal fits that existing limit. Moving mined ore into trade crates must use the existing atomic resource-packing path and remove the source ore exactly once.

`ship-handling.js` explicitly states its profiles are gameplay response, not cargo-mass simulation. Nomad thrust/RCS/torque are 35/18/1.6; Atlas 14/7/0.55. Suggested initial tuning bands: Stratum **24–28 / 13–15 / 1.1–1.25**, Gannet **19–22 / 10–12 / 0.8–0.95**, with turn multipliers about 0.7–0.8 and 0.55–0.65 respectively. Keep cruise-speed differences modest; extraction positioning should feel easier in Stratum, while Gannet needs slower braking/turning and deliberate loading. These are untested starting values. Do not promise automatic mass-dependent flight from capacity metadata.

## Shared integration dependencies and named risks

1. **HULL-REGISTRY — explicit three-hull dispatch.** `fleet.js`, `main.js`, dev-launch options, model loaders, `Navigation`, multiplayer hull serialization and server room hull selection contain explicit Nomad/Atlas/Kestrel branches or fallback-to-Nomad behavior. Root should integrate the new IDs once and reject unsupported IDs deliberately. Keep lazy model loading, authored collision parts, fitted-tool bounds, fleet inventory constraints and save restoration consistent. Online authority must not interpret a new hull as Nomad.
2. **BOARDING-OWNER — floor and collision are not generic mesh physics.** `boarding.js` owns Nomad dimensions and movement; Atlas has `FreighterSystems`; Kestrel has its own continuous access adapter. A new layout alone does not create correct movement. Root needs explicit floor, swept obstacle, doorway, interaction and moving-support adapters tied to each authored hull. Use the real hull pose and canonical terrain; Navigation remains the movement owner.
3. **CARRIER-ATLAS — rover integration is presently Atlas-specific.** `mining-rover.js`/`rover-support.js` hardcode hull ID, lift ID `main`, support prefixes, obstacle coordinates, bay limits and ceiling 9.2 m; main creates the rover only for the Atlas dev option. Generalize a carrier provider for ship pose, platforms, ceiling, obstacles, park pose, support identities and securing checks. Preserve existing Atlas behavior, anchored motion, all-wheel support and no-lift-while-straddling guards. Do not copy Atlas's obstacle list into Gannet.
4. **MINING-DOMAIN — existing excavation is small-domain mining.** Reuse `MiningField`, `MineableRock`, worker/volume, `MiningStore`, and `effects/weapon-target.js`. Aim from actual named muzzles, check hull/terrain obstruction, publish ore only after the real worker edit commits, and use a named persistent destination. Existing ring mining promotes roughly 4 m excavation domains, keeps two live ring rocks and preserves at most 16 saved deposits. Larger 24–140 size-class ring asteroids are not made mineable by increasing beam range. The initial miner should support the currently mineable outcrops/small ring rocks; large-asteroid excavation or refining requires separate scope and budgets.
5. **MINING-AUTHORITY — tools are not decorative guns.** Reuse the rover's real contact/destination route and input guards, with explicit ship power, travel, speed and mining-mode conditions. A 30–50 m initial tool range is within existing nearby rock streaming, subject to real target tests. Match cutter effects to actual muzzle direction, and never run combat fire and extraction on one held action. Existing online handheld mining in `trading/mining-client.js` and `server/cargo-mining.js` must gain trusted hull/tool range/rate validation if ship mining is enabled online. Do not claim multiplayer support from an offline adapter.
6. **PERSISTENCE/CARGO — no invisible transfer.** Freight grids, ore containers, supply manifests, trade packing, fleet swaps and rover ownership must agree. Existing ship mineral/supply storage is not already a complete per-hull fleet inventory. A swap must not duplicate, strand or silently squeeze an occupied hold; define allowed transfer/refusal behavior before enabling it.
7. **STATION-FIT — smaller than Atlas is useful, not proof.** Station docking checks actual whole bounds and physical parts against authored hangar/deck/doors. Validate every gear/tool/closed-door pose, real entry clearance and occupied freight after integration. Reuse the current landing gear clock and Navigation's authority; no competing animation timer.

## Asset and ownership plan

Use original authored Blender construction, editable `.blend`, deterministic builder, canonical layout JSON and named rig nodes. Keep metres/+Y/-Z, game ground contact at Y 0, clean rebuild, material/UV identity and traceable texture provenance. Preserve object wrappers introduced by material batching. Start with the existing ship budget **60k triangles / 4 MB**, maps at most 1024 px, while also checking the loaded Gannet + 21.6k-triangle Burrow + freight scene. Do not claim that passing a per-asset limit establishes frame performance.

Retain Meridian's fitted ivory ceramic, dark petrol machinery, restrained mint status and amber hazards. Stratum's booms/ore equipment and Gannet's clear rear loading volume should produce distinct silhouettes at thumbnail scale. Geometry/boarding gates should precede the final surface finish. Required later evidence includes complete keyboard/controller/touch journeys, parked and carried rover, full cargo, closed-flight and all access/gear poses, cockpit at the real eye/FOV, desktop/phone images and console/shader inspection. No visual score is assigned here.

Suggested isolated lanes, **not yet created or reserved**:

| Lane | Suggested branch/worktree | Exclusive initial ownership | Tentative preview |
| --- | --- | --- | --- |
| Stratum asset | `feat/meridian-stratum`, `star-agent-stratum` | New `assets/stratum/`, hull loader/layout adapter, hull-only studio/tests/docs | 5580 |
| Gannet asset | `feat/meridian-gannet`, `star-agent-gannet` | New `assets/gannet/`, hull loader/layout adapter, hull-only studio/tests/docs | 5581 |
| Root integration | `feat/meridian-medium-integration`, `star-agent-medium-integration` | Shared fleet/main/navigation/cargo/server and carrier interfaces after current acceptance | 5582 |

Recheck ports and register claims before starting. The listener inventory was unavailable in this sandbox; these numbers are suggestions only. Branch from the steward-approved latest dev after preserving active deliveries; do not start from the stale default checkout.

Active overlap inventory from HANDOFF/worktrees, requiring coordination rather than edits by asset authors:

- **Root community hub** owns station/hangar/navigation/main/server physical hub/security integration and protocol4; current acceptance continues independently.
- **SA-VEH-001 / root** owns final Burrow runtime, asset and review; preserve final rover worktree/PR66 and frozen user preview5417, final candidate5419.
- **SA-FX-001 fleet integration** owns narrow main hooks, `effects/flight-effects`, engine bindings, audio/music; candidate5576/5577. Provide actual new nozzle nodes and later profiles through that owner.
- **SA-CARGO-002 tractor / SA-ART-001 handheld tools** own mining/tool, equipment/calibration and related cargo hooks; tractor5537/5538, art5578. Reuse their final source rather than replacing the mining tool or assuming old equipment is current.
- **SA-PERF-001** delivered player/multiplayer caching and UI performance into current dev; preserve scratch/cache/private-snapshot and control semantics. Its actual isolated test port was5592.
- **SA-PUBLIC-001** owns public-launch/main dev gating, previews5568/5569; public release remains separate from local dev and must not be silently promoted.
- **Shopkeeper/concourse** work owns existing authored kiosk/merchant screens and runtime, preview5572; **base-power** owns base assets/definitions/support/power/UI. Neither belongs in these ship asset changes.

Root owns the shared integration seam. Asset lanes can begin with the above geometry contracts without waiting for every runtime question to be solved, provided they do not claim flyable, mineable or carrier acceptance before those adapters and real journeys exist.
