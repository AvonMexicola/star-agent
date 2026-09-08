# All-features local development

**Personal transport missions** are checked on `feat/transport-missions` and ready
for local integration. Open **Menu → Contracts → Transport contracts**, or
**Trade → Freight**. Accept, fly to pickup, order your private crate at the terminal,
physically load and secure it, fly to delivery and deposit through its terminal.
Twelve routes join Aeon, Selene, Pyre and Miasma; rewards are350CR or800CR.
Acceptance creates no cargo. See the [player guide](transport-missions.md) and
[complete controller, native-touch and authority evidence](qa/transport-missions/README.md).

Burrow cutter/reverse follow-up is locally integrated at `b34bc69` (feature
`03704e1`). Refresh the preview and choose **Burrow surface** to inspect the
machined cutters and layered mining beams. **S** / controller stick-back reverses;
keyboard **X** / controller **LT** brakes. The rover now backs away from rock
contact instead of retaining a false collision stop. The
[current evidence record](qa/burrow-concept/cutters-and-reverse.md) covers the
actual reverse/mining checks, complete controller carrier journey and remaining
independent art/performance review. This is a local checkpoint, not a public release.

The ongoing local test branch is `dev/all-features`. Cees explicitly requests new
features integrated here as they become coherent commits. It is separate from
main's production review/deployment process. Use an isolated worktree; do not
switch or overwrite another agent's dirty feature worktree.

**HUD display**: press **Tab** during gameplay to cycle **Everything → Markers and
reticle → No HUD**. Controller and touch use **Menu → Settings → HUD**. A two-finger
tap on the view restores Everything on touch screens. Tab still moves focus inside
menus. Next hostile is available through **Next target / Menu → Ship**. The display
choice affects screen overlays; physical cockpit instruments remain visible.
See [the checked source and browser evidence](qa/hud-display.md).

**Foundation-first building** is available in the same local preview. Place a
foundation and build before fitting a mainframe; it can sit on the finished deck.
Doors remain open while the site has no mainframe. Square, triangle and curved
concrete foundations extend down to dry terrain up to **8 m**. Use D-pad or
keyboard Up/Down for quarter-metre height steps, and **Shapes → Cliff foundation ·
45° braces** for a supported cliff deck. Rotate its feet toward the hillside;
both must reach actual terrain. See [controls and limits](base-building.md).

Runtime `4396029` was combined with settlement/combat development and locally
integrated at `8b5ecd4` on 2026-09-08. The existing 5178/8087 client/API service was
gracefully refreshed, preserving its persistent database and unrelated handoff
edits; both health routes and the exact new asset hash passed. Full 149-file unit
suite, multiplayer/persistence checks, production build and two actual-game
controller/keyboard/touch browser cases pass. [Screens and detailed evidence](qa/terrain-foundations/README.md)
retain failed attempts and physical-device/independent-review limits.
Construction remains solo/account-backed solo; no public deployment is included.

Four **trade settlements** use the existing construction kit: Greenbank
Supply on Aeon, Stillwater Exchange on Selene, Ember Works on Pyre and Verdigris
Prospect on Miasma. Find them in **Map → a world → Locations** or the **Trade
settlements** signal filter. Each has a large pad and a walk-in exchange with
independent finite stock and real ship cargo trading. F2 / Dev → Ship & location
offers an approach above each pad. See the [player route](trade-settlements.md)
and [construction and validation record](qa/trade-settlements/README.md).
Settlement economy `d50bc56` is locally integrated at `dc578d8`. Each exchange
now has explicit **local supplies and logical needs**. Its Local
stock tab explains reserve targets and resource uses; deliveries consume cargo,
pay credits and reduce the remaining need. Full reserves refuse excess crates.
Map selections list current exports and shortages. Existing saved quantities
are preserved. See [settlement delivery guide](settlement-economy.md) and
[controller/keyboard/phone validation](qa/settlement-stock-needs/README.md).
The transport checkpoint pairs these authored exchanges with canonical server
geometry and authoritative commerce. Full rendered online settlement gameplay
remains a separate acceptance item; player-base shops retain their existing route. Settlement runtime `03a561e` is locally
integrated at `32966e3`; its 1,127-case unit suite and complete controller
landing/trading/reboarding journey pass. Independent art and physical-device
acceptance remain separate from this development checkpoint.

The passenger elevator repair keeps its hangar vestibule at human scale, exposing
the same pressure-door kit used in the lobby and a clear call-panel approach.
F / controller X / the touch Interact button calls the elevator; walk inside to
choose a destination. Closed doors can be called open from close range; an
occupied doorway still prevents closing. See the
[repair and validation record](qa/station-elevator-access.md).

The shared local preview at **http://127.0.0.1:5178/** includes the checked
medium-ship runtime **`3cf80ad`**, merged locally at **`b793921`** on 2026-09-08.
**Stratum M-05** is an 18 m miner; **Gannet T-06** is a 24 m transport carrying
Burrow. They join Nomad 02, Kestrel and Atlas in the launcher. Both new hulls are
solo/development features. The final normal suite passes **1,113 tests**; final
studio and scoped actual-game reviews pass. The
[medium integration record](qa/medium-ships/integration.md) keeps exact input,
source, visual and remaining performance limits separate.

The preserved direct-entry/model-cache update (runtime `fc676f9`) opens the
Nomad hangar after one preload; scene selection is optional. Its 44 focused
checks and development build pass. See the [startup evidence](qa/direct-entry-2026-09-08.md)
for that checkpoint's exact validation and browser coverage.

The preceding fleet integration at **`c99736f`**, with runtime **`5f63893`**, added
the playable 64 m Atlas, enlarged default
station and community hub, ground Burrow and Atlas/Burrow meadow starts, fleet
particles/audio/music, roofs/lights/base power, animated shopkeepers and current
weapon/tool art. That checkpoint paired client and API at **protocol 5**. The paired local
refresh preserved the persistent PostgreSQL cluster and every existing table's
row count, applying only the missing additive base-site migration 003.

The complete normal suite passes 1,016 tests before the narrow meadow preset;
its owner passes 35 focused checks and the parent passes 16. All three engine/audio
journeys, the complete Burrow ground controller route, actual Atlas station
boarding/departure, and normal solo/authenticated opening pass. Cees also personally
tested loading Burrow and flying Atlas and recorded video. See the
[dated integration evidence](qa/fleet-engine-integration.md) for exact source,
input and acceptance limits. Public/main and multiplayer release are separately
tracked; a local merge does not identify what a public URL serves.

## Multiplayer chat and friends

Join multiplayer through Account / Flight link, then open **Menu → Comms →
Server chat** or **Friends**. Messages reach pilots connected to the same server.
Friends require acceptance and persist across reconnects and restarts. Online
pilots supplies request targets; Block removes friendship and stops chat between
both pilots. Controller players can compose text with the on-screen keyboard;
keyboard and touch use the same panels. Desktop and phone lists are paged.

Ordinary swearing is allowed. The small English-first moderation rules withhold
matched severe hateful abuse or extremist promotion before broadcasting and kick
the sender from the session. Neutral identity or history discussion is allowed.
There are no permanent bans, direct messages or archived chat in this slice.
See the [player guide](multiplayer-social.md), [social QA](qa/multiplayer-social.md)
and [combined integration evidence](qa/social-cargo-integration.md).

## Physical cargo and trading

The SBU cargo slice (runtime `3c7af88`, draft PR70) adds **6 SBU in Nomad 02**
and **512 SBU in the playable Atlas**. Walk to the station's **Cargo & Trade**
console, press F / controller X, select a resource, size and docked ship, and buy.
The purchased crates appear on the real grid. Only1SBU can be carried by hand.
Menu → Trade → Build creates a500CR player terminal with a36m landing pad;
land centrally, pack mined ore, list cargo and set prices for visitors.

Normal solo saves keep cargo with mining inventory; development test starts reset
on reload. Online cargo, stock, credits and common-outcrop yields persist through
additive PostgreSQL migration002. Joining supplies the server-owned ledger; local
saves are not imported. The original cargo checkpoint used protocol 3; the
current local candidate uses protocol 6 and requires a matching client/API pair.
Player shop sales continue when the seller disconnects. The physical tractor now
moves 1–64 SBU crates with swept collision, range and lease checks; the former
instant large-crate transfer is retired. Persistent offline wrecks remain open.
See the [player guide](sbu-cargo.md) and [actual QA record](qa/sbu-cargo.md).

## Constructed base trade terminals

The base-commerce checkpoint (integrated at `2607fe7`, runtime `4b36b50`, with latest elevator repair preserved)
adds **My shop** to the Storage & trade terminal. Link a base with a designated
landing pad, choose a real local container and commodity, offer only the selected
quantity, set its price and enable the public beacon. New deposits stay private.
The map shows stocked goods, prices and landing pads; new saves enable Bases by
default. Existing saved map filters remain yours to change.

For shared trading, join Comms and track your private unregistered base-plan
marker. Walk to the planned terminal location, then **Menu → Trade → Build →
Register shared** (500 CR). Registration validates a fixed layout and creates
empty server storage. Deposit actual docked ship cargo, then list the quantity in
**My shop**. Visitors can buy while you are offline; credits and cargo save in one
transaction. Shared sites are self-powered, at most 64 pieces, with doors open;
full multiplayer construction editing/upkeep and solo inventory import are outside
this checkpoint. Online hull support remains Nomad/Atlas.

This update requires matching **protocol 6** client/API. It changes no SQL schema.
The two controller browser journeys pass, including map discovery, physical base
access, partial offers, a seller-offline purchase, cargo and takeoff. Physical
controller hardware is untested. See the [delivery evidence](qa/base-commerce.md).

## Run and use

```sh
npm ci
npm run dev:all
```

Open http://127.0.0.1:5178/ after starting this source. After the initial preload,
the Nomad hangar opens with the shoulder camera behind the character. No scene
selection or second load is required. F2, the visible Dev button, or controller
Menu opens optional scene choices during the opening; after taking control, use
Menu → Dev. The launcher offers
Nomad 02, Kestrel, the current **64 m Atlas**, **Stratum M-05** and
**Gannet T-06 + Burrow**, with station hangar/approach,
**Burrow mining — Selene surface**, Aeon coast/forest/highlands/polar/orbit,
Selene surface/rings, Pyre twilight/surface, Miasma approach/surface and stellar
observation starts. To change scenes, choose a ship and location, then Launch test
flight. D-pad/left stick selects; A confirms; B returns. Keyboard Tab/Enter and
touch use the same buttons. No account or ship-unlock milestone is needed.

For immediate rover play, choose **Burrow mining — Selene surface** in Test
starts or its direct Dev link. Burrow starts seated on its four wheels beside the
canonical Crescent outcrop; the selected ship stays parked at the station.
WASD / left stick drives, T / RT mines, I / View opens ore bins, and F / X follows
the real door/step exit and re-entry. This is an offline temporary test session.
Its [CPU placement record](qa/mining-rover/surface-start.md) is complemented by
the passing combined ground mining, driving and physical exit/reboard journey. The **Atlas + Burrow mining rover · Selene**
link remains a carrier test, with Burrow on the new cargo deck and the actual
aft loading ramp. G / Y operates that ramp while aboard; no belly lift is used.

For the new medium ships, select **Stratum M-05** or **Gannet T-06 + Burrow**
and **Selene · landing site**, then Launch test flight. Direct starts:
[Stratum](http://127.0.0.1:5178/?dev=1&intro=0&ship=stratum&start=moon&seed=7291)
and [Gannet with Burrow](http://127.0.0.1:5178/?dev=1&intro=0&ship=gannet&start=moon&seed=7291).
Use B / controller Y to land, then F / X to leave the chair. Follow the reachable
ramp/elevator prompts and secure access before launching. Stratum holds T / RT
(or its visible cutter control) to mine within 40 m, with a 120-second battery,
30-second recharge and separate 384 kg ore bin. In Gannet, walk aft to Burrow's
side door, board it, lower the elevator and drive out. Its 128 SBU freight banks
remain beside the rover lane. These development inventories reset on reload.

Dev → Content review collects the expedition character studio, both Burrow
starts, construction sandbox, current Atlas studio, station exterior overview,
Kestrel counter prop and sound studio. The location pages also include Pyre's
Pyrebear habitat and Miasma's Sulphurhound habitat. Habitat starts place the ship
35 m above the ground: land, leave the chair, open the hatch and walk down the ramp.
The newer character is the default local and remote pilot, including its corrected
hips and calibrated weapon grips. Press 4, or LB + RB + D-pad right, for third person.

Only an explicit scene launch reloads the page. The default opening and selected
test starts use an isolated temporary test inventory and unlocked fleet.
Normal browser progression is neither read nor written. Test-session cargo and
construction reset when reloading. The current seed is retained in the URL;
use `?seed=42` or the ordinary controls panel to choose a different world.
A copied test URL includes its ship and start. This selector is gated by
`VITE_DEV_TOOLS=1`, set by `dev:all`; ordinary production builds retain their entry.

Vite generates content hashes for known gameplay `/models/` assets at startup and
build time. Changing model bytes requires the frontend's Vite process to reload
its configuration so its development manifest updates; API and PostgreSQL do not
need a restart. The medium integration refreshed this frontend manifest and
verified the served model hashes while leaving the API and database running.

The supplied construction sandbox is an exception to temporary test inventory:
it uses its own saved namespace and a refillable 4,608 kg materials bank. Reload
retains its bases and remaining stock. The ordinary save is separate. B near an
owned mainframe opens its wheel; LB/RB changes piece categories, A selects/places,
LT/RT rotates, LB cycles snap and RB jumps during placement. The original kit
includes structural shapes, storage facilities, hangar doors, ramps and S/M/L
pads. The current build adds the reviewed roof skins, ceiling lights and
power kit described below; the original 21-piece count is historical.

Flight now preserves momentum under finite thruster authority. V / R3 selects
fly-by-wire or unlocked flight; hold X / LT to brake. Z or Menu → Ship → Combat /
cruise changes the speed regime. Retract gear and slow into combat limits to fire;
landing assist requires less than 10 m/s. Atlas needs the most stopping room.

Atlas is one current ship: **64 × 36 × 16 m**, with front/aft loading ramps,
a fixed 2.6 m cargo deck, 9.5 m upper deck, one crew lift and six folding landing
assemblies. It retains 512 SBU physical cargo, 2,400 kg supplies, four pilot MFDs
and three S3 mounts. F / X operates reachable controls; close both ramps and stop
the crew lift before B / Y launches. The [Atlas guide](atlas-freighter.md) includes
boarding, save compatibility and exact physical-test commands. The Mark II studio
inspects this same hull; `/dev/freighter.html` redirects to that current studio.
Offline Kestrel has no cargo hold; its four mounts carry S2 guns. Multiplayer starts new pilots in
the server's Nomad. Cargo & Trade can call a Nomad or Atlas to an assigned berth
while the pilot is on foot with empty hands; the chosen hull persists. Joining
reserves a server-assigned hangar and places the pilot on its deck ahead of the
complete parked hull. Normal solo and multiplayer entry retain the initial
shoulder camera and opening hangar doors; multiplayer replay keeps the server's
pose and door authority. Explicit dev starts skip that presentation. Joining
replaces the dev teleport, ship selection and test inventory.
Hangar gravity follows the occupied bay, including EVA entry into another pilot's
hangar; crossing an open deck edge returns to EVA. Local construction is not replicated.

The runner starts Vite on 5178, the API on 8087 and native PostgreSQL on loopback
51224. Optional registration/login works through ACCOUNT. Accounts, sessions and
server inventory persist across runner restarts. Prisma uses the existing SQL
tables and authentication contracts. The runner drains API save queues before
stopping PostgreSQL. A database failure stops startup; it never falls back to RAM.
Forgotten-password emails require SMTP and are unavailable in this local mode.
Ports in use cause an explicit failure rather than killing another preview.
Override `DEV_PORT` and `DEV_API_PORT` when needed. Ctrl+C stops the owned frontend,
API and local database after queued saves finish.

The default database directory on Linux is
`~/.local/share/star-agent/postgres/star-agent-local/` (or under `XDG_DATA_HOME`).
It contains `cluster/` and a private `credentials.json`; keep both outside Git and
browser assets. Changing worktrees or reinstalling dependencies does not replace
this directory. `DEV_DATABASE_NAME` selects a separate named database and
`DEV_DATABASE_PORT` chooses its loopback port. `DEV_DATABASE_URL` explicitly selects
an already running local PostgreSQL database. An inherited production
`DATABASE_URL` is never used by `dev:all`. No root access or Docker is required;
the pinned development dependency supplies native PostgreSQL 16.14 binaries.

For a cold backup, stop the runner and copy the entire named database directory,
including `credentials.json` and `cluster/`, to private storage. Restore the copy
under a new `DEV_DATABASE_NAME` and start with that name; the restart/restore test
verifies that its accounts, cookies and inventory still work. Keep the original
until the restored instance is verified. PostgreSQL major-version changes require
an explicit upgrade or dump/restore; the runner refuses mismatched clusters.
Never delete the database directory as part of a routine restart.

`npm run db:local` starts just this SQL service. `npm run prisma:generate` regenerates
the server-only Prisma client; `npm ci` does this through `postinstall` too.
`npm run db:migrate` requires an explicit `DATABASE_URL` and applies the existing
transactional SQL migrations. Do not use `prisma db push` or `migrate reset` on this
schema: its expression indexes/checks and deployed migration history are retained.

## Source checkpoints

This table identifies included source and historical predecessors. It is not a
receipt for the pending combined promotion or a claim that old browser results
cover the new Atlas and refitted station.

| Feature | Integrated source |
| --- | --- |
| Main world chain: Pyre, star, Miasma, seeded rocks | `origin/main` at `48a8468` |
| Consolidated flight, grass/terrain loading, mining/EVA/inventory, station opening | `integrate/main-2026-09-06` through multiplayer ancestry |
| Gear-limited flight, handling, drive, utilities, graphics, multiplayer | `feat/multiplayer-ten` at `f7a30ef` |
| Server-assigned hangar spawns and local station gravity | `fix/multiplayer-hangar-gravity` at `b7eefc5` (PR #51) |
| Persistent local accounts, sessions and inventory through PostgreSQL/Prisma | `fix/persistent-local-accounts` at `b100d8f` (PR #59) |
| Server chat, mutual friends, blocking and private session kicks | `feat/multiplayer-chat-friends` runtime through `006c35c`, final browser fixture `99fa858` |
| Physical cargo, Nomad 6 SBU / Atlas 512 SBU grids and durable player shops | `feat/sbu-cargo-trading` runtime `3c7af88`, reviewed evidence `7b3bed8` (PR #70) |
| Fitted S1 Nomad / S2 Kestrel / S3 Atlas guns, barrel-origin fire | `feat/ship-weapon-fittings` runtime `2faa71c`, review `7cc583c`, combined in `5842404` |
| Flyable Kestrel and shared Meridian identity | `feat/kestrel-flight` at `e4ec7df` |
| Nomad 02 hull, cabin, berth, cargo rack, folding gear | `feat/nomad-utility` at `385c138` (asset/gameplay `9a363cb`) |
| Construction sandbox, original 21-piece kit, facilities and landing pads | Historical base `feat/base-building` at `33b33f2` |
| Rounded roof skins, ceiling lights, base electricity/storage, removal and account-scoped solo saves | Roof review `7e34acd`, combined roof/power source `05f83d1`; [roof](qa/base-ceilings-roofs/README.md) and [power](qa/base-power/README.md) receipts |
| Station concourse/shop finishes and installed Kestrel maintenance roll | `feat/retail-soft-props` at `a40baad` |
| Surface mist, volcanic ash, toxic wisps and shallow lunar dust | `feat/world-atmospherics` at `8bcdcc3` |
| Textured, mineable Aeon stones for aggregate/binder/concrete | `feat/aeon-mineable-stones` at `554cb17` (PR #54) |
| Rare large Aeon landmarks, overhangs and stone bridges with physical contact | `feat/landmark-rocks` at `b4efa8f` ([PR #63](https://github.com/AvonMexicola/star-agent/pull/63)) |
| Layered landmark grain, relief and seeded weathering/mineral variation | `art/landmark-weathering` runtime `4f9d472`, reviewed images `f88c497` |
| Sparser giant landmarks with quieter, cheaper stone shading (supersedes the first weathering pass) | `art/landmark-restraint` runtime `bb75c4c`, checked source `92dadad`, locally combined at `6e548ad`; [images and measured limits](qa/landmark-restraint/README.md) |
| Six local soundtrack variants with scene transitions | `feat/suno-soundtrack` at `f29c30d`, retained by the fleet audio candidate |
| Actual-thrust engine particles, hull-specific engine voices, gesture/mute/pause handling | Effects `bcd46d1`, audio `9690fe3` + `5e0cf4b`, new Atlas socket binding `8cd5c0e`; [owner effects](qa/fleet-engine-effects.md) and [audio](qa/fleet-engine-audio.md) receipts |
| Footsteps, weapons, mining and spatial flybys | Historical `feat/gameplay-audio` at `5a128f3`, construction/fauna audio through `6d3abb0`, retained by current integration |
| Expedition character, corrected hips, hands, animations and studio | Preserved owner checkpoint `0bb6a6a`; combined local/remote binding in `3bd7d61` |
| Ground-ready Burrow and real 64 m Atlas cargo/ramp carriage | Surface `634f39c`, carrier `c7b7dd3`; original rover source/evidence through `643a7d3` is historical |
| Finite ship momentum, combat/cruise mode and moving muzzle effects | `fix/combat-momentum` through `6f8b195`; controls explanation `f5c6933` |
| Pyrebear/Sulphurhound habitats and medical recovery; Aeon Tidebacks/Mallow; repaired deer studio asset | `feat/pyrebear` reviewed `e904192`, combined wildlife `c160ece`, local runtime `c4f6b5b`; [combined wildlife QA](qa/wildlife-integration.md) |
| Current playable 64 m Atlas, physical decks/ramps/crew lift/gear, MFDs and mounts | Geometry `0b2d852`; runtime `8cd5c0e`, cargo/network `43fadf1`, real-floor collision/route `b81cec0`, saved-opening route `cee70b7` |
| Default authored Aeon exterior and full-size fleet hangars | Exterior source `9d0728f` (draft PR #55); shared client/server `PLAYABLE_STATION_OPTIONS` and `fleetHangarAsset` |
| Animated Watchkeep and Kestrel shopkeepers | Runtime `35a7a93`, checked delivery `3624efd`, combined at `3321747`; [scoped merchant review](qa/station-shopkeeper-browser.md) |
| Physical tractor and current rifle, sidearm, cutter and tractor art | Checked handheld/tractor source retained through `40a0fb4`; [tool record](qa/handheld-tools.md) |

The 64 m Atlas now replaces the old playable hull; its source/CPU checks do not
establish final art or combined browser approval. Station finish/performance,
physical-controller testing and the remaining creature/rover visual and touch
limits remain scoped to their own receipts. The original rover controller
mining/return/flight-carriage pass used the retired Atlas carrier; the new ground
and ramp routes need their combined checks. Rover, construction and wildlife
remain offline gameplay rather than new multiplayer replication features;
optional account-scoped solo base persistence is distinct. The deer remains a
rig-viewer asset. The [earlier combined review](qa/dev-content-review.md) is
historical and does not override the newer source/checkpoint descriptions here.
Read shared HANDOFF.md and feature heads before updating this table.

## Updating the shared preview

Commit coherent feature work in its own branch. Merge that branch into
`dev/all-features`, preserving the combined runtime contracts. Resolve overlaps
explicitly; never replace main/navigation/world wholesale with a single older
branch. Run appropriate unit and browser checks, including the controller journey,
then refresh the running local preview and record the new source head here and
in HANDOFF.md. Do this without waiting for a production merge. Refresh feature refs
from origin before integration; review local owner commits as well as pushed heads. Public publishing
and main merges are separate actions; this dev branch is not a release sign-off.

The initial integration preserves both canonical seeded rock relief and parent
triangle terrain morphing, authored Nomad/Kestrel gear with all-ship speed limits,
physical berth/ladder access, build occlusion and attached third-person weapons,
and multiplayer account entry with offline fleet tooling. Cargo follows the
construction branch's 48 kg mineral capacity per installed box and 120 kg Nomad
supplies limit. Normal flight remains continuous; only explicit dev/quick-transit
starts teleport.

## Validation

See `docs/qa/local-development.md` for exact checks and limitations. Do not infer
whole-scene visual approval, physical controller testing or public deployment from
the presence of a feature branch in this test build.

Aeon's former decorative white pebbles are now textured basalt stones. Start at
Forest or Coast, land, leave the ship and equip the cutter (3 / D-pad right).
Aim within 8 m and hold T / RT. Menu → Field recipes turns recovered basalt into
aggregate or dry binder; 8 kg aggregate + 2 kg binder produces 10 kg concrete.
The stones share the existing finite inventory/save system and avoid seeded tree
trunks. The launcher still starts a fresh temporary test session on reload; normal
offline saves retain cuts. See [stone evidence](qa/aeon-stones.md).

The historical hangar-gravity integration passed seven focused test files covering server
rooms, opening navigation, Kestrel flight, Nomad utilities, camera orientation and
station collisions, plus a production build and the production two-pilot browser
journey. That journey exercises assigned deck spawns, COMMS/transfers, controller
jump, physical EVA exit/return and held-input suppression across menu, focus and
controller reconnection. No browser errors were recorded. Feature-wide checks and
captures are in `docs/qa/multiplayer-hangar-physics.md`. That checkpoint used
protocol 2; the later tractor delivery used protocol 4 and this candidate uses
protocol 5. The frontend and API must be updated together; restart `dev:all`
after integration.

## Space patrol combat

The local build offers **15 regional enemy ship sorties**: Easy, Standard and
Hard contracts around Aeon, Selene, Pyre, Miasma and Selene's asteroid belt. Fly an
armed Nomad, Kestrel or Atlas to the region and open **Menu → Contracts** (or the
Patrol console button / station security terminal). Choose a tier, read the
advertised flight and accept. Follow the nearby amber beacon; surface dispatch
requires climbing into orbit. Acceptance never teleports the player.

Easy has one weakened contact; Standard has two full-strength ships; Hard has
five reinforced enemies in two waves, with a ten-second reinforcement warning.
File the report after clearing every wave, or abandon / recover through the
console. Controller: D-pad / A select, B resumes, sticks fly/aim, RT fires and
right stick scrolls the report. Existing ship weapon/target commands remain in
Menu → Ship; page through that menu to reach the weapons.

This is an offline, session-only development checkpoint. Reports reset on reload;
there are no currency/cargo rewards or multiplayer NPCs. Five complete regional
controller journeys plus keyboard/native-phone UI pass; physical-controller and
independent balance/visual acceptance remain pending. See [encounter guide](space-combat.md)
and [exact QA, limits and original failures](qa/enemy-encounters.md).

## Default station and exterior overview

The authored exterior and enlarged fleet bays are the default in this source.
The clear bay deck is 42 m wide and 124.8 m long, with approximately 25.04 m of
height. The landing plane stays at its original elevation; terminals, people and
service fittings keep their own scale. The 64 m Atlas retains its full size.
Rendering, LOD and server collision consume the same refit.

Use **Station exterior · overview** in the launcher's footer, or open
http://127.0.0.1:5178/?dev=1&intro=0&ship=kestrel&start=orbit&stationExterior=1&exteriorView=overview&seed=7291.
It starts a Kestrel overview of the rebuilt habitat rings, bearings, support bridges
and spine. Ordinary flight controls remain active; F2 or controller Menu →
DEV · Ship & location selects another test start. That next launch retains the
same default shell and clears the one-shot overview camera. The retained
`stationExterior=1` URL parameter is no longer required to select the new exterior.

The 20 berth IDs, door mechanisms and concourse remain; the fleet bay shell/deck
is enlarged around the fixed service wall and floor.
Full-detail collision persists while distant geometry reduces rendering cost.
This is a first geometry pass: final painting, close surface/detail refinement,
complete art approval and frame timing remain open. See the
[production and review record](qa/station-exterior/production-record.md) for
exact source hashes, independent clearance checks and actual browser evidence.
The exterior owner's historical checkpoint recorded 664 unit tests, a production
build and three Chromium cases: rendering/ring motion, controller/touch entry and
Kestrel boarding, reboarding and departure. Those results predate the fleet-bay
refit and do not certify this combined source. The Kestrel climb clips remain
unconnected to playable boarding; see the linked record for its exact prior scope.


## Contributor framework

PR52 introduced the [contributor handbook](development/README.md), expanded
[roadmap](../ROADMAP.md), [branch stewardship](development/branches.md), templates,
11-area/task registry and executable `check:repo`, `plan:checks`, `branches` and
`test:development` helpers. GitHub defaults to dev/all-features; main/dev require
checked, up-to-date PRs and resolved discussions, with force-push/deletion disabled.
The original Chromium guidance is retained. See [framework QA](qa/contributor-framework.md)
for actual CI/hosted settings and their limits. This changes contribution routing,
not the local account/save model or public release authority.

### Controller trigger and layout update

Ship fire is **RT / R2**, brake/drive cancellation is **LT / L2**, and vertical
thrust is **A/B (✕/○)**, matching EVA. Open **Menu → Settings → Controller layout** or
**Help → View controller layout** for the labeled controller diagram and the
Flight, On foot, EVA and shortcut views. Menu A-confirm/B-back remains unchanged.
Verification and retained captures: [controller layout QA](qa/controller-layout.md).


### Gameplay terminal

Escape, controller Menu, or the on-screen Menu button opens the fixed gameplay
screen. Tabs: Comms, Map, Contracts, Inventory, Loadout, Ship, Settings, and Dev
on the development build. LB/RB or bracket keys changes tabs; B/Escape resumes.
Long lists have page controls instead of scrolling. Ship contains fleet, weapons,
utilities, construction and recipes; Settings contains graphics, sound and controls.
Dev has Test starts, the console list and Content review. Comms contains Flight
link for the station roster, hangar and account controls, plus Server chat and
Friends. Nested controller text entry keeps its own focus and tab controls.
[Gameplay menu QA](qa/gameplay-menu.md) records the checks and limitations.


### Fitted Meridian weapons

All three energy families have original S1/S2/S3 gun models. Nomad carries
2 S1, Kestrel 4 S2 and the current Atlas 3 S3. The Atlas studio inspects the same
authored mount geometry as that playable hull.
Raise and fully retract landing gear before firing: G or Menu → Ship → Gear.
Use1/2/3 or Menu → Ship → Ship weapon to select a family; T, RT/R2 or the touch
trigger fires from the actual barrel tips. Larger sizes increase damage, range,
impact scale and sound weight. Online combat authority is unchanged.

The historical weapon checkpoint preserved the gameplay menu, controller mapping
and persistent accounts, with 686 unit checks, build and three RT controller
patrol journeys passing on that source. The weapon branch also passed Kestrel boarding,
launch and Selene landing/exit route and Atlas touch controls. The final visual
and frame-time acceptance status is recorded in [weapon QA](qa/ship-weapons/production-record.md).
No service/database restart or public deployment accompanies this integration.

Navigation-target development adds a centred star/planet map, paged surface sites,
filterable HUD bearings and a three-second nose-lock ring. M or Menu → Map opens
it. Hold the nose on a visible destination, then N/J or both bumpers + D-pad up
engages a continuous20km approach (stellar thermal stand-off remains500,000km).
The menu and ring use existing RT weapon controls. Local base/Comms/patrol signals
come from their live systems; targeted drive is currently solo-only. Lore lives
in docs/lore.md and the in-game help field note. QA uses port5493 independently of
the persistent preview5178/API8087/database51224; it never restarts that service.

### Construction and creature audio

Successful building placement now plays a settling/locking sound. The
[sound studio](http://127.0.0.1:5178/tests/gameplay-audio.html) includes a deep
Pyrebear growl and a sharper Sulphurhound snarl. Creature attack wiring is integrated into the offline fauna simulation; attacks
play once when the creature commits to a bite, and interruption clears the voice. The audio callback record is in
[the handoff](qa/construction-audio/README.md). No new control bindings.

The historical navigation SA-NAV-001 delivery used 894b660 (PR62 draft), adding
the hierarchical map, signal filters, nose-lock ring and solo targeted drive to
5178. Source endpoints were verified after that fast-forward; 705 unit tests and
the build passed. No preview/database restart occurred at that checkpoint.
Final controller/browser evidence and limitations: docs/qa/navigation-targets.md.

### Combat momentum checkpoint

Fly-by-wire now uses finite thrust to correct drift and brake on release. V / R3
unlocks coasting; rotate and fire while travelling backwards. Hold X / LT for full
braking. Z or Menu → Ship → Combat / cruise selects speed independently of assist.
Combat caps are Kestrel220, Nomad180, Atlas120 m/s; cruise, boost, overspeed and
lowered landing gear lock weapons. Landing assist requires speed below10 m/s.
All ships carry momentum through turns, with Atlas taking the longest to recover.
At100 m/s in vacuum, full nose-axis braking to below1 m/s takes approximately
58m/1.5s,97m/2.4s and251m/7.4s respectively. The HUD estimates stopping distance
at the current attitude; it is not a collision-avoidance guarantee.

Moving rifle pulses and ship lasers follow the actual muzzle. Ballistic shots
inherit launch velocity; collision and lead prediction use that trajectory.
[Momentum QA](qa/combat-momentum.md) records the exact checked source, failures,
evidence and limits. This is a local development checkpoint, not release approval.



### Integrated creature development checkpoints

The development build includes offline Pyrebear and Suloher encounters. With development
tools enabled, use Test starts → Pyrebear habitat or Suloher habitat, land, exit
the ship physically, and approach wildlife. Carbine/pistol rounds use the real
loadout; Pyrebear has 240 HP and Suloher 90 HP. Both have authored walk/death clips.
Both Pyrebear and corrected Suloher controller journeys passed. The Suloher
route includes biting, bandage use and inventory-preserving medical evacuation.
Final actual-world motion/art review remains pending. These checkpoints are not a claim of
complete gameplay acceptance. See [hostile fauna QA](qa/hostile-fauna.md).

The supplied deer has a repaired, calmer walk and preserved skin/bind rig. On a
Vite development server, open `/scripts/fixtures/creature-rig.html?model=deer`
for an orbitable animation preview. This is an asset viewer; deer spawning is
not implemented. The [deer repair record](qa/deer-rig.md) retains source, Blender
file, exact export identity and before/after evidence. Reuse the
[creature pipeline](development/creature-pipeline.md) for future animals.
Hostile checkpoint `5a3cf0b` was included in local promotion `2f3249f`. Deer
checkpoint `b3eedc0` and the later reviewed wildlife source `e904192` are now
integrated at local runtime `c4f6b5b`.


The development launcher includes **Aeon · Tideback beach** and
**Aeon · Mallow grassland** to Test starts. Tidebacks inhabit dry low coastland
and retaliate after injury; the large Mallow grazers inhabit grassland and flee
instead of attacking. Both use the existing ammunition, health and animation
systems. These are offline, session-local encounters. See the
[Aeon wildlife record](qa/aeon-wildlife.md) for exact habitat and validation scope.
Refresh http://localhost:5178/ and press **F2** to open the ship/location launcher.
Select Nomad and either named Aeon habitat, then launch, land and walk out of the
ship. Both physical controller encounters passed on the wildlife checkpoint, including the grazer
terrain-edge retreat fix. The repaired deer viewer is also served by this local
build. See [integration evidence and captures](qa/wildlife-integration.md).
Animals remain offline and session-local; public hosting was not updated by this
integration.


### Player and multiplayer CPU optimisation

The checked player optimisation preserves current assets, animation cadence,
rendering quality, network rates and physical authority. It removes duplicate
server snapshot construction, rig/equipment allocations, static remote hull
transform composition, repeated exact-position terrain sampling and unchanged
multiplayer manifest rebuilding. The cache includes the world seed. Measured
CPU workloads improve while before/after nine-player and nine-hull captures
remain pixel-identical. See [measurements, regressions and limitations](qa/player-performance/README.md).
No protocol/save migration or public deployment accompanies this change.

The historical player-optimisation delivery used runtime `af419c7` on 5178.
The preview/API restarted once with the same persistent database. That checkpoint
passed 876 unit tests, 125 SQL-enabled multiplayer/UI tests and the production build; two focused
browser comparisons preserve exact pixels and controller/state behaviour.

## Cargo tractor and handheld finish

The physical tractor and four-tool Blender pass were delivered to 5178 from
runtime `638a5e4` and remain in the candidate. Open **Cargo & Trade → Cargo → Equip
tractor**, aim at a crate and hold **RT** to move it. Use D-pad up/down for distance,
left to align, **X** to secure to a nearby compatible grid, and right to holster.
Only 1 SBU boxes can be carried by hand; the beam handles 1–64 SBU, with larger
crates moving more slowly. See [all controls and limits](cargo-tractor.md).

The tractor now has its own open induction head. It, the mining cutter, laser
rifle and sidearm use authored textures, contact shading and service plates, with
preserved grips and muzzle positions. Editable Blender sources are in
`assets/handheld-tools/`; [before/after views](qa/handheld-tools/comparison.png) and
[rendered gameplay checks](qa/handheld-tools.md) are available for review.

That historical paired client/API restart used protocol 4 without a schema
migration or save reset. Four browser cases passed, including physical controller mining,
both weapons and cargo securing. At that delivery, the four served GLB hashes and
eight source modules matched the checked candidate. This is builder-tested local development;
independent visual and physical-controller acceptance remain separate.

## Compact builder and K-17 rotating cutter

The isolated handheld candidate adds a compact Meridian field builder with a
live piece/status display and a brief projection from its emitter after a
successful placement or removal. On foot outside the ship, open **Menu → Build**
on a controller, **B** on a keyboard or the visible **Build** button. Choose a
piece, then **A / Enter / Place** confirms it; **X / Esc / Exit** restores the
previous equipment. Existing recipes, material costs and placement rules apply.
The supplied construction sandbox is available from the development launcher.

The yellow **K-17 Mk1** replaces the handheld mining cutter. Its three-pod head
spins up with the actual beam and coasts down when released or cooling; its
central lens and muzzle remain fixed. Equip with **D-pad right / 3**, then hold
**RT / T / Hold to mine** within 8 m of a mineable surface. **View / I** opens
the collected-material inventory. Only Mk1 is playable; the common cartridge
mount prepares later heads, without adding tier bonuses or an upgrade menu.

Editable sources and reproduction scripts are in `assets/builder-tool/` and
`assets/field-cutter/`. The supplied bandage and injector have normalized native
models in the prop library; medical equip/use animations are still pending.
See the [builder record](qa/builder-tool/README.md) and
[cutter record](qa/field-cutter/README.md) for source and acceptance status.
Final cutter gameplay/phone validation and local integration are pending.

## Fleet audio, merchants, roofs and power in the candidate

Nomad, Kestrel and Atlas consume actual acceleration, boost, power and hull pose
for engine effects. Coasting does not create cruise-speed flames, reverse/side
thrust does not ignite aft exhaust, and Kestrel retains its authored engine cores
and cones. Powered unseated cabins keep a quieter engine bed; occupying Burrow
does not activate the selected parked ship's engines. Six bundled score variants
remain local. Sound begins after accepted user input, respects explicit Sound-off
and suspends across menus, focus loss and transit. [Audio](qa/fleet-engine-audio.md)
and [effects](qa/fleet-engine-effects.md) receipts record owner CPU checks; their
earlier Atlas geometry references are historical. Current hull/socket checks are
in the [playable Atlas receipt](qa/atlas-playable/README.md). Combined rendered
activation, listening and propulsion checks remain with the parent integration.

The Watchkeep and Kestrel shops use the corrected animated merchant assets.
Their [owner browser review](qa/station-shopkeeper-browser.md) covers physical
controller approach/purchase/return and sampled desktop idle motion. It keeps
phone visibility and broader station performance limits explicit; it is not a
new pass on this combined station. The rifle, sidearm, cutter and tractor retain
their checked art, real grips and moving muzzle behavior.

Construction adds supported rounded roof tiles and switchable ceiling lights,
alongside solar/wind generation, batteries, fuel generators, upkeep, repair and
guarded removal. Account-scoped solo saves use additive migration 003 while
preserving cargo 002 and social 004. Construction is still disabled in shared
multiplayer; the supplied sandbox keeps its separate saved materials bank.
Use the construction **Roofs** and **Power** tabs and the mainframe's power view.
See the [roof guide](base-ceilings-roofs.md), [power pipeline](base-power-pipeline.md)
and [roof](qa/base-ceilings-roofs/README.md)/[power](qa/base-power/README.md) source
receipts. Their owner controller/SQL evidence and remaining art limits are
retained; combined browser validation and shared promotion are pending.


### Atlas + Burrow meadow

Open **F2 → Aeon · Atlas + Burrow meadow → Start meadow adventure**, or use
**Menu → Dev → Test locations** with a controller. The preset selects the 64 m
Atlas automatically, parks Burrow beside it and starts you on foot in the same
Aeon meadow used for Cees's successful rover loading and takeoff playtest.
A fresh launch restores both vehicles and the reviewed terrain seed 7291.
Normal fleet, construction and mining saves remain separate.

Direct development link: `/?dev=1&ship=atlas&start=atlas-meadow&intro=0&seed=7291`.
This needs the development build (`VITE_DEV_TOOLS=1`); public entry ignores it.
Use LS / WASD to walk, X / F to interact and A / Space to jump. Drive Burrow up
Atlas's loading ramp, park aboard, then board Atlas and fly. Initial setup uses
the existing rover door and steps, so let that brief animation finish. Switching
tabs or opening a menu pauses setup safely.

The terrain ramp fixes and clear Burrow windscreen are included in the preset's
fleet dependency. Cees manually verified driving aboard and flying away with the
rover; this records local solo gameplay, not multiplayer rover replication.
See [scene verification](qa/atlas-meadow-launcher.md) for checks and limitations.


## Burrow concept cabin checkpoint

The Burrow upgrade follows the approved exterior/interior concepts with five flat LCARS-style instrument faces, fitted ivory cabin panels, warmer coves, deeper tyre tread and manufactured shell details. The steering wheel, column and pedals are removed; the clear windshield and physical boarding route remain. Screens show actual cutter reserve, ore and driving state. Existing keyboard/controller/phone controls still operate the vehicle.

Use **F2 → Burrow mining — Selene surface** for the explicit seated developer start; F / controller X exits and physically reboards. WASD / left stick drives, arrows / right stick aims, T / RT mines, X / LT brakes, and I / View opens ore bins. Select **Gannet → Selene** for the full pilot-to-rover elevator journey. The [production record](qa/burrow-concept/production-record.md) separates passing gameplay checks from pending independent art/hardware/performance acceptance. This remains a local development checkpoint.

Burrow concept runtime is locally integrated at `ab418ca` (2026-09-08), with final controller, keyboard and native-touch evidence. Refresh the preview to load the new GLB; independent art and hardware/performance acceptance are still pending. [Draft PR92](https://github.com/AvonMexicola/star-agent/pull/92) preserves Cees’s review gate.


## Outdoor construction floodlights

The floodlight candidate adds six twin-head masts around each of the four trade
settlement pads. Build your own through **Build → Power → Floodlight**. Each costs
8 metal stock, 3 conductor and 2 glass and uses 600 W while switched on. Walk to
the service box and press **F / controller X**; the setting survives a reload.
Ceiling lights remain in **Roofs**. The same normal power and placement rules apply.

Use **F2 → a settlement** to inspect the commissioned lights, or **Build sandbox**
for construction. The [asset and gameplay record](qa/outdoor-floodlights/README.md)
contains night before/after views, controller/phone evidence and measured costs.
Integrated locally at `8566a43`; the existing5178 preview/API refreshed together
and served asset/source checks passed. Refresh the page to load the masts.
Independent art and hardware/performance acceptance remain pending.


## Projected trade terminals

Settlement and base consoles project the exchange name and the normal **F /
controller X** connection prompt. Interacting opens a crisp trade dashboard with
local stock, cargo, shipment quantities, credits and settlement needs. Owners
retain **My shop** controls for offered stock, prices, shop opening and the public
beacon. No account or password is required.

Use **F2 → Stillwater Exchange** for the explicit approach, then land and walk to
the console. The shared Pilot menu, keyboard navigation and phone controls remain
available. The [terminal QA record](qa/projected-terminals/README.md) separates
actual gameplay evidence from the owner presentation fixture and physical-device
acceptance. This is a development feature; no public deployment is included.

Checked terminal checkpoint `3bf082b` is integrated locally. Refresh
[the development preview](http://127.0.0.1:5178/?dev=1) to load the new interface.
The existing API remains healthy; no service restart or save migration was needed.
