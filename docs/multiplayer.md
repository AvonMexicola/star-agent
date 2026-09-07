# Shared flight: first ten-player server

This branch adds an opt-in shared world. Offline play remains available without an
account. The first shared flight fleet is the Nomad; the other ship-building lanes
remain separate prerequisites/work in progress.

## Player flow

On https://multiplayer.staragent.site/, the account screen opens automatically
after loading. Choose **Create account**, register with a callsign, email and
password, and choose **Join multiplayer**. **Continue offline** resumes the
station intro without an account. A small **SIGN IN / REGISTER** or **ACCOUNT**
button stays available during the intro and after movement dismisses the launcher;
it becomes **COMMS** when connected. Controller **Menu** opens accounts during the
intro and the command menu during play. No real-name field or suit editor exists. The room assigns one of
ten suit colours and reserves a free hangar before admitting the player. The
player starts standing on that hangar's deck beside their parked Nomad. Rejoining
and respawning use the same allocation, independently of the suit colour slot.
One account may occupy one slot; the eleventh simultaneous player is refused
without disturbing the existing room.

Open **COMMS** (also available from the pilot's third MFD) to see the assigned
hangar. After releasing a berth, request another within 30 km of the station.
Follow the assigned pad marker, enter the open berth
at gear-limited speed and land with the normal landing control. Each reservation
belongs to one pilot. Leave the berth before cancelling it. Approach reservations
expire after three minutes; occupied berths stay reserved while the pilot remains
connected. A doorway occupancy sensor prevents closure on another player.

Hangars have bounded local gravity (9.81 m/s²) using the authored deck and room
orientation. Walking and jumping follow that deck even when the player's ship
is elsewhere. EVA entry settles onto the deck; walking through an open doorway
returns to EVA with the player's momentum. Closed doors remain solid. Gravity
does not grant docking or storage rights to another pilot's berth.

The multiplayer inventory dialog uses server manifests for pack, ship and station
storage. Transfers check quantity, capacity, revision and proximity. Dropped items
are listed in the server inventory dialog and can be picked up within three metres and are cleaned up after five minutes; at
most 100 loose stacks exist. Loose stacks are intentionally ephemeral and are
removed on server restart. Inventory, health and selected weapon are persistent.

Weapons are held in calibrated character hand sockets. The supporting arm reaches
the rifle/cutter grip; the character mesh's suit colour mask preserves head and
hands. Authoritative shots require an owned weapon, compatible ammunition and a
cooldown. Hits use character capsules, authored ship hull bounds, station/door
collision and canonical terrain. A hull protects its occupants. The mining cutter
is not a combat weapon.

## Development

Use Node 22.12 or newer:

```sh
npm ci
STAR_AGENT_MEMORY=1 PUBLIC_ORIGIN=http://127.0.0.1:5300 PORT=8084 npm run server
# In another terminal:
npm run dev -- --port 5300
```

Vite proxies `/api` and `/ws` to loopback port 8084. Memory storage is explicitly
for local tests: restarting it removes test accounts. Production refuses memory
storage and requires PostgreSQL. See [account configuration](multiplayer-auth.md)
for database, SMTP and password-reset setup.

```sh
npm test
npm run test:multiplayer
npm run build
```

The dedicated multiplayer frontend enables automatic account entry with
`VITE_MULTIPLAYER_ENTRY=1 npm run build`. Use the same environment variable with
`npm run dev` to check that entry locally. Ordinary builds retain the offline
opening and optional account access. The browser multiplayer configuration sets
this flag and tests the bare URL, including its default intro.

## Authority and current limits

The server runs the existing Navigation simulation at 30 Hz, with snapshots at
15 Hz and browser control packets at 20 Hz. The protocol accepts bounded controls
and named actions, never client positions, inventory totals, hit targets or damage.
The browser predicts normal movement and reconciles with authoritative snapshots.
All clients use seed 7291 and world positions remain double-precision metres.
Protocol version 2 identifies the occupied gravity frame and its up vector in
snapshots; clients reconcile frame transitions and keep remote boots and hit
capsules aligned with the same deck. Update the server and frontend together.

PostgreSQL writes serialize per account; departure establishes a reconnect barrier
before final persistence. Inventory mutations are confirmed after durable writes.
Combat state is checkpointed every ten seconds and on disconnect/shutdown. An
abrupt process/machine failure can therefore lose up to ten seconds of combat
state. There is no cross-process/shard coordination in this first room.

This is an initial multiplayer slice, not the completed economy: ship-mounted weapon fire, shared mining,
construction, station shops/concourse transit, ship trading and visiting another
player's cabin are not implemented. Existing local economy/fleet/transit controls
are blocked in shared flight. Ship-vs-ship rigid-body collision and lag-compensated
combat rewind are not implemented. Ship hit detection uses conservative hull
bounds; terrain occlusion samples at 0.5 m intervals. Session reconnect returns a
pilot to a newly assigned hangar deck rather than restoring an unattended ship.
Hangar frames are stationary; this does not implement nested moving-ship grids
or multiplayer visits to other ships' interiors.

Password-reset emails require configured SMTP. A uniform forgotten-password
response is not evidence that mail was delivered. No SMTP service was configured
on the server during initial development; automated tests use a fake mail adapter.
