# Player guidance and combined release

Deployed to [play](https://play.staragent.site) and
[multiplayer](https://multiplayer.staragent.site) on 9 September 2026 at
10:01:24 UTC. Source `f70eab95407f0fa4127b260774924ee8410193d3` passed all
five required checks in [run34336716635](https://github.com/AvonMexicola/star-agent/actions/runs/34336716635).
[PR113](https://github.com/AvonMexicola/star-agent/pull/113) merged normally into
`dev/all-features` as `006c6aee5b44615d6f2d769071974a9d4acce768`.
Cees explicitly authorized both public channels and requested a consolidated push.
[Machine-readable release receipt](release.json).

The release includes the step-by-step Nomad guide, curved planetary drive,
starter tractor, Greenbank, command wheel and character controller tuning.
It retains focused objective/selected-POI/owned-vehicle markers and distinct marker
styles from the preceding release. Unfinished pirate-camp and separate menu work
are excluded. The [guide evidence](../player-guide/README.md) records full
keyboard, injected controller and native phone touch opening/boarding/departure
journeys, including map/contracts and continuing objective guidance. Physical
controller hardware and a complete planet landing/exploration/combat loop were
not tested in this guide task.

Both exact release builds passed. Validation checked 18 homepage files and
47 packaged viewer references per channel. All 300 public and 1383 multiplayer
tracked/build files passed staged SHA256 verification; 21 generated database
client files were separately inventoried. Live HTTPS verified each channel's
source ID, index, and 42 entry/model assets against local bytes, plus both
homepage hosts. The public session API and WSS unauthenticated rejection passed;
no public account was created. These checks do not claim an authenticated live
multiplayer gameplay journey. A further public browser rerun was initially
deferred because foreign pirate-camp/menu jobs occupied the shared GPU. The
WebSocket probe completed its assertions but retained a handle; only that owned
probe process was terminated, then service health was verified separately.

The initial multiplayer startup failed because the staged tracked-file list
omitted ignored `server/generated/prisma`. The memory-store staging check did
not exercise that import. The guard stopped solo promotion. Prisma 7.9.1 was
then generated from the unchanged pinned schema/dependencies, its import was
verified as `staragent`, and service PID41754 became healthy before solo promotion.
The initial restart failures and corrective action are retained in the raw
receipt directory `/tmp/star-agent-f70-release`. Subsequent service logs show
normal startup and the pre-existing SMTP-not-configured warning.

Both channels and server now use protocol11, capacity20 and seed7291. The
previous release is `d63fab0d595424e622c073cdb576d01124094736`. There were zero
connections before restart. SQL migrations, schema and dependencies are unchanged;
existing PostgreSQL accounts, sessions and saves were retained. No Caddy, DNS or
service environment changes were required. Existing tabs should refresh.

For recovery, keep client/server paired and preserve PostgreSQL. After new tractor
inventory saves, the previous catalog is not a safe parser for a blind rollback;
use a compatible catalog or forward repair. Deployment preflight must generate
and verify the production Prisma client as well as initializing an isolated world.
