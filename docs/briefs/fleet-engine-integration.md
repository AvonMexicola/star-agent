# Fleet and station development integration

Cees requests the latest coherent content in the local development build, with
working engine particles, sound and music on Nomad, Kestrel and Atlas. The scope
also includes the new station and playable 64 m Atlas, a ready-on-ground Burrow
mining start, roof/ceiling-light building technology, animated shopkeepers, and
the checked weapon/tool art. Preserve the initial shoulder camera and opening
hangar doors in normal solo and multiplayer entry; explicit dev test starts may
skip that presentation. The Kestrel climb clips are not yet connected to boarding.

Use actual simulation acceleration, hull pose, power and travel state for engine
emission and sound. Bind the current assets' real nozzles and preserve Kestrel's
authored afterburner cones, moving-muzzle fixes and projectile velocity. Audio
starts from accepted user input, retries temporary autoplay denial and respects
explicit mute. All mixer paths suspend across menus, focus loss and graphics
failure. Engines remain audible from a powered moving walkable cabin.

Replace the retired 30 m Atlas loader, fallback, remote model and invisible
belly elevators with the existing 64 m authored asset and real forward/aft
ramps, crew lift, six folding landing assemblies, four pilot MFDs and three S3
mounts. Keep saved ship ID `atlas` and the two 256-SBU grids' cell coordinates;
move their physical origins to the real 2.6 m cargo deck with a 5 m vehicle aisle.
Use the same mechanism state and geometry for rendering, walking, cargo, tractor
collision, vehicle support and server authority.

The authored station exterior becomes the normal station. Enlarge the bay shell
and deck in both hero/LOD and server geometry, preserving the floor at -8 m and
service wall at +26 m. Human props, terminals and lifts keep their dimensions.
Keep twenty berth IDs; this integration does not increase the ten-player room cap.
The ready community-hub/security/finite-market branch must be combined semantically
with current tractor ledgers and private multiplayer snapshots, not substituted
for them. Protocol 5 carries the complete contract on client and server.

The separate surface start settles Burrow's four wheels on canonical Selene
terrain next to the existing Crescent outcrop. Actual driving/mining, ore bins
and physical door/step exit and re-entry remain available. The carrier test
parks it in Atlas and uses its real aft ramp with vehicle/cargo occupancy guards.
Roof/light/base-power saves use additive migration 003 alongside current 001,
002 and 004. Preserve all existing accounts, inventories and the SQL cluster.

Feature owners work in isolated files/worktrees; the parent owns composition,
combined verification, current documentation and serialized local promotion.
Run focused CPU/invariant and real SQL tests, the production build, actual
rendered controller routes, native audio activation and phone UI checks. Retain
failures and record browser/backend/resolution. Asset studio, physical gameplay,
independent art review and release acceptance remain distinct. Known unfinished
station/ship material work stays labelled as a development checkpoint.

Deliver to local `dev/all-features` at port 5178 with one coherent frontend/API
refresh. No public deployment, database reset, new paid services or replacement
of another owner's uncommitted work is authorized by this integration.
