# Public entry points and frozen releases

`staragent.site` and `www.staragent.site` serve `site/`: the project introduction,
real game screenshots, two short ambient captures and a user-operated film, plus
links to solo, multiplayer, source and contribution guides. Motion is optional,
pauses offscreen/in the background, and defaults off for reduced-motion/data-saving
preferences. The landing page does not load the game engine or contact an API.

`play.staragent.site` is an explicit **solo** build from a frozen snapshot of the
local `dev/all-features` branch. `npm run build:solo` enables the development
launcher, content viewers and console list, excludes the multiplayer account UI
and its startup session request, and emits `dist/solo`. The ordinary development
build remains unchanged. The in-game Comms screen is omitted in solo. Browser
DevTools are also available as usual. Test-start saves remain separate from normal
browser saves; neither is a server backup or portable account.

The viewer packaging also bundles the standalone scripts formerly copied from
`public/dev` with unresolved source imports. It rewrites their production HTML to
real emitted script/style paths. The terrain material viewer uses ordinary module
imports instead of scraping Vite's transformed source at runtime.

Solo CPU/GPU simulation runs on the visitor's machine. Hosting serves HTML,
JavaScript, models, textures and optional films; transfer bandwidth and the first
asset download are the main server costs. Assets total about 117 MB on disk, but
are loaded by the relevant scenes/tools, not all by the homepage. This is browser
play, not video streaming or a hosted GPU session. It is not a service-worker
installation and does not promise uncached play without an internet connection.

`multiplayer.staragent.site` remains the existing dedicated authoritative server,
PostgreSQL database and account system. The public capacity release is separately
branched from the exact deployed `f7a30ef` revision. It increases admission to 20,
extends the suit palette to 20 distinct colours and reports the full-room limit
correctly. Twenty physical hangars already exist. Player 21 is rejected; a freed
slot can be reused. Client/server protocol and database schema are unchanged.
The more recent local shared-world protocol/economy changes are separate releases.

Twenty is a capacity limit, not a performance guarantee. The room currently
simulates at 30 Hz and sends whole-room snapshots at 15 Hz. All-to-all snapshot
traffic grows roughly with the square of the player count. Monitor actual tick
cost, memory, bandwidth and client frame time before raising the cap. No extra
hosting service, paid plan, cloud GPU, or server was provisioned for this release.

## Release procedure

1. Branch from a checked `dev/all-features` commit and retain the exact revision.
   Reconcile the explicit solo gates if changing the common main/UI hooks.
2. Run appropriate unit/build/browser checks, including static tools, no solo
   API/WebSocket request and actual images. Capture only game content from a fresh
   anonymous browser. Keep raw reports and recordings out of Git; curated public
   media lives in `site/media`, with provenance in the QA record.
3. Commit the source, then run `npm run build:solo`. `release.json` records the
   channel, source revision and build time. Run `node scripts/deploy/validate-public.mjs`.
4. `scripts/deploy/public-release.sh stage` uploads only the explicit solo output
   and homepage into `/opt/staragent/public-releases/<revision>`. It does not
   publish, overwrite another release, alter DNS or touch SQL.
5. On the first cutover, back up the existing `/etc/caddy/Caddyfile`, compare it
   to `scripts/deploy/public.Caddyfile`, validate the full resulting configuration,
   and reload Caddy only after the release exists. Preserve any new unrelated host
   blocks if the server has changed since this template was written.
6. `scripts/deploy/public-release.sh promote` atomically switches
   `/opt/staragent/public-current`. Verify all HTTPS hosts and the film byte-range
   response. Updating the local development branch never promotes this symlink.

The legacy main workflow still writes `/opt/staragent/current`. The new Caddy
roots deliberately use `/opt/staragent/public-current`, so an older main build
cannot silently replace the public solo snapshot or homepage. No GitHub main merge
is needed to publish a reviewed frozen release. Future automation must explicitly
implement the same release boundary.

Rollback the public snapshot by atomically restoring `public-current` to its
previous target. First-cutover rollback also restores the backed-up Caddyfile.
The multiplayer capacity update has its own server-side backup: restore its prior
`dist`, server entry, protocol and room together, then gracefully restart only
`staragent-multiplayer`. Check for active sessions before restarting. Existing
account/inventory data is retained; do not restore or reset the database for a
capacity rollback.

## Reproduce visual QA

Build solo, then run `node scripts/public-preview.mjs` (homepage 5568, game 5569).
Coordinate the single GPU slot before
`npm run test:browser -- -c scripts/public-launch.config.js`. It uses Chromium/ANGLE
OpenGL, one worker, and the real static output. Its first case produces the public
clips and posters; the second checks homepage links, playback, reduced motion and
1440×900/390×844 layouts. On the known runner Crashpad startup failure, stop and
use the approved command escalation; do not retry browser flags.

The September 2026 capture run encountered `/tmp` user-quota exhaustion. A
separate run on an SSD-backed temporary directory loaded both scenes cleanly; the
quota was subsequently raised by the machine owner. For large capture jobs use a
short `TMPDIR` path on disk and set `PWTEST_CACHE_DIR` alongside it. Do not interpret
a browser startup/storage failure as a game pass or change rendering code to hide it.
