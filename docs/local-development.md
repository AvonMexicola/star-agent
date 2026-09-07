# All-features local development

The ongoing local test branch is `dev/all-features`. Cees explicitly requests new
features integrated here as they become coherent commits. It is separate from
main's production review/deployment process. Use an isolated worktree; do not
switch or overwrite another agent's dirty feature worktree.

## Run and use

```sh
npm ci
npm run dev:all
```

Open http://127.0.0.1:5178/. The launcher offers Nomad 02, Kestrel and the current
30 m Atlas, with station hangar/approach, Aeon coast/forest/highlands/polar/orbit,
Selene surface/rings, Pyre twilight/surface, Miasma approach/surface and stellar
observation starts. Choose a ship, choose a location, then Launch test flight.
F2 or controller Menu → DEV · Ship & location reopens the dialog after taking
control. D-pad/left stick selects; A confirms; B returns. Keyboard Tab/Enter and
touch use the same buttons. No account or ship-unlock milestone is needed.

Each launch reloads into an isolated temporary test inventory and unlocked fleet.
Normal browser progression is neither read nor written. Test-session cargo and
construction reset when reloading. The current seed is retained in the URL;
use `?seed=42` or the ordinary controls panel to choose a different world.
A copied test URL includes its ship and start. This selector is gated by
`VITE_DEV_TOOLS=1`, set by `dev:all`; ordinary production builds retain their entry.

The Atlas Mark II link opens the separate 64 m studio with its latest committed
geometry refresh. It is not the flyable 30 m fleet Atlas. Offline Kestrel has no cargo hold; its four mounts now carry S2 guns. Multiplayer currently uses the server's Nomad flight model;
joining it reserves a server-assigned hangar and places the pilot on its deck beside
the parked Nomad. It replaces the dev teleport, ship selection and test inventory.
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

## Integration snapshot

| Feature | Integrated source |
| --- | --- |
| Main world chain: Pyre, star, Miasma, seeded rocks | `origin/main` at `48a8468` |
| Consolidated flight, grass/terrain loading, mining/EVA/inventory, station opening | `integrate/main-2026-09-06` through multiplayer ancestry |
| Gear-limited flight, handling, drive, utilities, graphics, multiplayer | `feat/multiplayer-ten` at `f7a30ef` |
| Server-assigned hangar spawns and local station gravity | `fix/multiplayer-hangar-gravity` at `b7eefc5` (PR #51) |
| Persistent local accounts, sessions and inventory through PostgreSQL/Prisma | `fix/persistent-local-accounts` at `b100d8f` (PR #59) |
| Fitted S1 Nomad / S2 Kestrel / S3 Atlas guns, barrel-origin fire | `feat/ship-weapon-fittings` runtime `2faa71c`, review `7cc583c`, combined in `5842404` |
| Flyable Kestrel and shared Meridian identity | `feat/kestrel-flight` at `e4ec7df` |
| Nomad 02 hull, cabin, berth, cargo rack, folding gear | `feat/nomad-utility` at `385c138` (asset/gameplay `9a363cb`) |
| Construction, mainframes, recipes and polished building pieces | `feat/base-building` at `891c916` |
| Current station concourse/shop finishes and prop production records | `feat/retail-soft-props` at `9f02d24` |
| Surface mist, volcanic ash, toxic wisps and shallow lunar dust | `feat/world-atmospherics` at `8bcdcc3` |
| Textured, mineable Aeon stones for aggregate/binder/concrete | `feat/aeon-mineable-stones` at `554cb17` (PR #54) |
| Rare large Aeon landmarks, overhangs and stone bridges with physical contact | `feat/landmark-rocks` at `b4efa8f` ([PR #63](https://github.com/AvonMexicola/star-agent/pull/63)) |
| Six local soundtrack variants with scene transitions | `feat/suno-soundtrack` at `f29c30d` |
| Material footsteps, distinct weapons and mining sounds | `feat/gameplay-audio` at `5e1a21f` |
| Atlas Mark II geometry/gear checkpoint, studio only | `feat/atlas-fleet-refresh` at `d875a49` |
| Aeon exterior geometry preview, opt-in | `feat/station-exterior` at `eb5184d` (geometry `261ebab`, combined runtime `0880516`, draft PR #55) |

Atlas now includes its first committed geometry/gear refresh in the studio. Final
materials, review and flight integration remain open. Further character production
is still in its owner worktree without a new feature commit at this snapshot. Pending
Meshy retail soft-prop candidates are production records, not installed props.
Check shared HANDOFF.md and feature heads before updating this table.

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

The hangar-gravity integration also passed seven focused test files covering server
rooms, opening navigation, Kestrel flight, Nomad utilities, camera orientation and
station collisions, plus a production build and the production two-pilot browser
journey. That journey exercises assigned deck spawns, COMMS/transfers, controller
jump, physical EVA exit/return and held-input suppression across menu, focus and
controller reconnection. No browser errors were recorded. Feature-wide checks and
captures are in `docs/qa/multiplayer-hangar-physics.md`. Protocol version 2 requires
the frontend and API to be updated together; restart `dev:all` after integration.

## Space patrol combat

The local integration includes the offline patrol loop from `feat/space-combat`.
Choose **Nomad 02** or **Kestrel**, start in **Orbit**, then open **Patrol console**
(on-screen button or controller Menu) and accept. Fly to the amber beacon, brake,
and fight the Nomad/Kestrel pair. T / RT fires; 1–3 / Menu selects weapons;
Tab / Menu selects the next hostile. The physical hangar cargo terminal also opens
the console. File the combat report after both kills, or recover after ship loss.

Shields regenerate after six seconds without a hit; docking repairs hull damage.
Progress resets on reload. This first slice is offline and does not add persistent
contracts or credit rewards. See [combat controls and scope](space-combat.md) and
[verification evidence](qa/space-combat.md). The asset studios remain inspection
surfaces. The offline playable fleet now carries the fitted Meridian gun kit.

## Station exterior geometry preview

Use **Station exterior · geometry preview** in the launcher's footer, or open
http://127.0.0.1:5178/?dev=1&intro=0&ship=kestrel&start=orbit&stationExterior=1&exteriorView=overview&seed=7291.
It starts a Kestrel overview of the rebuilt habitat rings, bearings, support bridges
and spine. Ordinary flight controls remain active; F2 or controller Menu →
DEV · Ship & location selects another test start. That next launch retains the
new shell and clears the one-shot overview camera. The explicit `stationExterior=1`
flag keeps this geometry checkpoint separate from the inherited default exterior.

The 20 hangars, doors and concourse keep their existing frames and interiors.
Full-detail collision persists while distant geometry reduces rendering cost.
This is a first geometry pass: final painting, close surface/detail refinement,
complete art approval and frame timing remain open. See the
[production and review record](qa/station-exterior/production-record.md) for
exact source hashes, independent clearance checks and actual browser evidence.
The merged source passes all 664 unit tests, a production build and all three
Chromium cases: actual rendering/ring motion, controller/touch entry and a physical
Kestrel ladder, reboarding and departure. See the linked record for remaining gates.


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
Dev has Test starts and the console list. Comms uses the existing live station
roster, hangar request and account systems; no new text-chat transport is included.
[Gameplay menu QA](qa/gameplay-menu.md) records the checks and limitations.


### Fitted Meridian weapons

All three energy families now have original S1/S2/S3 gun models. Nomad carries
2S1, Kestrel4S2 and the flyable Atlas3S3; the separate MarkII studio also has3S3.
Raise and fully retract landing gear before firing: G or Menu → Ship → Gear.
Use1/2/3 or Menu → Ship → Ship weapon to select a family; T, RT/R2 or the touch
trigger fires from the actual barrel tips. Larger sizes increase damage, range,
impact scale and sound weight. Online combat authority is unchanged.

The combined source preserves the current gameplay menu, controller mapping and
persistent local accounts. 686unit checks, build and all three full RT controller
patrol journeys pass. The weapon branch also passed the physical Kestrel ladder,
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
Pyrebear growl and a sharper Sulphurhound snarl. Creature attack wiring is connected in the in-progress fauna worktree;
that feature is not yet integrated here. The audio callback record is in
[the handoff](qa/construction-audio/README.md). No new control bindings.

Navigation SA-NAV-001 is locally integrated at 894b660 (PR62 draft). Refresh
http://127.0.0.1:5178/ for the hierarchical map, signal filters, nose-lock ring
and solo targeted drive. Source endpoints were verified after the fast-forward;
705 combined unit tests and the build pass. No preview/database restart occurred.
Final controller/browser evidence and limitations: docs/qa/navigation-targets.md.
