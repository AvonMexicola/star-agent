# Base power, upkeep and server persistence

## Scope and ownership

SA-BASE-POWER branches from the content-review checkpoint7953bea. Existing bases
were browser-local; PostgreSQL previously stored accounts and multiplayer player
inventory/health, and construction was disabled in multiplayer. This slice adds
**account-scoped solo base saves**. It does not enable shared multiplayer building
or import client-authored solo inventory into authoritative multiplayer inventory.

`server/migrations/003-base-sites.sql` owns version3. Cargo reserves version2 and
social version4. Merge the migration registry in `server/database.js` rather than
replacing the other lanes' migrations. Never reset the established database or
account tables. The optional Prisma BaseSites model mirrors the SQL table; the
base adapter uses parameterized SQL and the existing transaction helper.

## Power rules

Energy is kWh; generation/load is kW; time is UTC milliseconds. The mainframe has
a 2 kWh emergency reserve on initial creation/migration. Each battery adds12 kWh
capacity **empty**. There is no battery refill button. Renewables meet site load
first; surplus charges storage. Fuel generators supply the remaining load and
charge deficit, burning nothing when no power is required.

| Piece | Rating | Conditions |
| --- | --- | --- |
| Solar array | 2.5 kW peak | Actual sun incidence; body night and roof/structure obstruction stop output |
| Wind turbine | 3 kW peak | Deterministic varying wind on atmospheric worlds; zero on airless moons |
| Battery | 12 kWh | Charges from surplus generators; supplements shortfall |
| Uranium generator | 4 kW | Uranium-bearing ore from rare Pyre outcrops |
| Helium-3 generator | 12 kW | Enriched regolith recovered during Selene surface mining |

These are game balance values, including enriched feedstock yield/energy. They
are not isotope-abundance or engineering estimates. Wind currently uses a bounded
procedural cycle rather than coupling to the visual weather system; solar checks
nearby building occlusion, not a terrain horizon ray trace.

Load is0.25 kW/mainframe +0.01 kW/piece, +0.15 kW/terminal, +0.1 kW/hangar door,
+0.04 kW/designated pad. Unpowered terminals and hangar motors refuse activation;
manual doors, directly accessed storage and the mainframe remain usable for recovery.
Power loss does not erase ownership or unlock storage. In this single-owner slice,
rights remain the original local-owner abstraction.

After stored energy is exhausted and generation cannot meet demand, health loses
100 points over72 real hours of total unpowered time. Restoring power halts loss;
it does not regenerate health. Mainframe repair spends5 kg metal stock for25 HP.
At zero, remove the entire claim, its pieces/collision/models, core/crate/rack
contents and box mounts. The monotonically increasing nextId watermark remains
so an old browser cannot resurrect an expired identity. Sandbox health loss is
paused; sandbox power still generates/charges and its inventory stays isolated.

`power.js` is the shared pure integrator. Constant-rate intervals handle depletion
partway through the interval. Offline integration samples environment every ten
minutes and stops permanently at zero health. `power-environment.js` uses canonical
body descriptors, saved body-fixed anchors, the star position and Pyre's epoch
frame. Server pruning runs each minute even with nobody connected. Reads also
settle elapsed upkeep; server downtime is caught up at restart/next access.

## Persistence and consistency

Authenticated same-origin GET/POST `/api/bases` uses the existing session cookie,
request limiter and origin checks. POST has a bounded256 KiB JSON body. Every
mutation locks the account and base row in one PostgreSQL transaction; the account
lock also serializes competing first inserts. Revisions reject stale commands.

The saved record contains validated anchored layout, base containers/box counts,
server-owned power, fuel, charge and health. Client-supplied power is ignored.
Existing site anchors and piece transforms cannot be rewritten by a snapshot.
Omitted sites are not demolition. Expired identities are discarded on upload.
Fuel/repair actions atomically debit mainframe supplies and update upkeep state.
Unknown accounts, invalid geometry/anchors, overfull containers and failed writes
must not publish successful mutations.

Solo mining/placement remain client-authored progression. The layout/storage
snapshot is **not an anti-cheat boundary**. Keep these records out of multiplayer
trade/combat until mining, construction costs, access, collision, synchronization
and demolition are validated through the authoritative room. This distinction
must stay visible in UI/docs and review claims.

`BaseCloud` connects explicitly from the mainframe, restores an existing account
save (retaining a complete local backup first), and saves every ten seconds while
connected. Subsequent startups reconnect the same saved account binding. Different
account bindings refuse automatic restoration. In-flight placements/transfers are
kept pending rather than overwritten by an older acknowledgement. Changed remote
layouts require reconnecting; network failures say **Server save pending** and
preserve local data. A disconnected browser can lose unsent changes: a local write
is not presented as a completed server transaction. Cloud-enabled upkeep is never
advanced/deleted using the browser's clock.

## Materials and controls

The original three density channels remain basalt/copper/ice. Named secondary
fuel resources live in the existing materials map, avoiding destructive voxel-save
migration. `miningFuelProfile` assigns Selene surface regolith (no ring yield) and
one in eight deterministic Pyre outcrop identities to uranium. A small fraction of
accepted basalt mass becomes fuel feedstock; total cargo mass and mining XP stay
conserved. Failed capacity/storage/revision checks retain both field and cargo.

B → LB/RB to Power → stick/A selects generators and batteries. Existing A place,
LT/RT rotation, LB snap, RB jump and X exit remain. X/F at a mainframe or power
machine opens health/load/charge/fuel/server status. Fuel comes from **mainframe
supplies**, not invented tank stock. Fuel and repair use native buttons/shared
controller routing with async duplicate suppression. Sandbox server connection
is disabled. The user can sign in through Online, return to solo, then connect
base saves; joining multiplayer still disables construction.

Original deterministic asset source: `blender/build_base.py`. Build using the
existing Blender command;26 total kit GLBs include five power props. Shared
material palette and exported render/collision bounds remain required. Independent
visual acceptance and physical Xbox testing are separate gates. Evidence and
failed checks belong in `docs/qa/base-power/README.md`.
