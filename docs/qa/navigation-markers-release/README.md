# Focused navigation markers — paired release

Deployed **9 September 2026, 07:47:38 UTC** to
[play](https://play.staragent.site) and [multiplayer](https://multiplayer.staragent.site).
Exact tested source: `d63fab0d595424e622c073cdb576d01124094736` on frozen
`release/navigation-markers-20260909`. Protected [PR112](https://github.com/AvonMexicola/star-agent/pull/112)
merged into `dev/all-features` as `88389274efe9608fde8db9ac500fb0951b4ae5b0`.
Cees explicitly requested “merge to dev, play and multiplayer”; Codex operated
that authorized release. [Machine-readable receipt](release.json).

HUD arrows now show the selected POI, each active contract's next objective, and
owned ships/vehicles. Amber objective diamonds, white POI pins, mint ship outlines
and pale-blue rover outlines distinguish their roles on and off screen.
The release combines focused arrow runtime `b99658b`, delivery `724ab12`, and
marker styling `3fbfc74` (the clean export of `c7adec1`). PR110 is merged; PR111's
exact head is included through PR112 and its redundant review was closed.

Only these marker changes advance from the preceding `ea234d2` public runtime.
Separate planetary-drive and starter-tractor changes remain local; unfinished
ground-pirate work remains excluded. Server, dependencies, SQL migrations, save
formats, world generation and assets are unchanged. Protocol 10, capacity 20 and
seed 7291 remain compatible with existing clients/data. Refresh existing tabs.

## Checks and actual evidence

- All 165 configured source test files pass; both explicit channel builds and
  packaged-viewer validation pass. Existing chunk-size advisories remain.
- [Required hosted run34324823917](https://github.com/AvonMexicola/star-agent/actions/runs/34324823917)
  passes plan44s, source5m6s, multiplayer3m23s, browser7m52s and verify3s.
- Four exact-artifact browser cases pass in5.1m: solo Nomad opening, unchanged
  saved fleet and scene launcher; multiplayer account/Continue offline/neutral
  controller flow; complete controller POI/patrol selection, change, clear,
  abandon and saved all-filters reload; keyboard rover exit and parked Burrow/Sentry
  bearings. Desktop1440×900 and phone390×844 captures were directly inspected.
- Chromium151.0.7922.173, AMD Radeon860M, ANGLE/OpenGL ES3.2; one GPU worker.
  Injected standard Gamepad and keyboard. The two public HTTPS entry cases pass
  after promotion with zero page/console errors. This is not physical-device,
  independent art acceptance, new performance or multiplayer population testing.
- All300 public and1010 multiplayer staged files match SHA256 manifests. Pinned
  `npm ci` reports0 vulnerabilities, generates Prisma, and the world initializes
  as unprivileged `staragent` with an isolated memory store. Server, schema and
  dependency files match the preceding active release.
- HTTPS release IDs, HTML and41 entry/model paths per channel match the local
  artifacts. Both homepage hosts match. Public API health, synthetic registration,
  authenticated WSS welcome and hangar assignment pass; the exact probe account
  was deleted. Service logs show a normal graceful restart and the existing
  `SMTP_NOT_CONFIGURED` warning, with no new application errors.

[Focused arrow evidence](../focused-location-arrows/README.md) and
[marker style evidence](../navigation-marker-styles/README.md) retain the original
source checks, visual references and known positioning limits. The inherited ship
label can be covered by an existing panel at the sampled parked pose; the driving
capture shows its mint badge clearly. No marker-position change is claimed.
Raw release logs, screenshots and receipts: `/tmp/star-agent-navigation-release`.
Curated actual public pages: [solo](public-solo.png), [multiplayer](public-multiplayer.png).

The first solo bundling succeeded but the sandbox denied its Git revision subprocess
with EPERM; the unchanged build passed with approved escalation. Initial local
staging hard links crossed filesystems, so copies were used. The first final staging
assertion expected `client.ts`, while Prisma generates `client.js`; installation
and hashes had passed, and the correct file plus world startup were then verified.
These execution corrections required no application change; original logs remain.

## Deployment and recovery

Both symlinks atomically switched to the exact release above. Multiplayer restarted
with **0 connected clients**, preserving graceful account checkpoints and the
existing database; service PID39010 became healthy before the solo switch.
No environment, Caddy, DNS, schema or database contents were replaced.

Rollback both `/opt/staragent/public-current` and
`/opt/staragent/multiplayer-candidate` to their retained respective release directories
for `ea234d2cb71cb26b53c3671a3a6db962a0da5273`, gracefully restart only
`staragent-multiplayer`, then repeat HTTPS/API/WSS checks. Preserve PostgreSQL.
The four identical migrations and same-schema backup/restore rehearsal are retained
in the [preceding release receipt](../compounds-release/README.md). This presentation
update requires no SQL migration or database rollback. Existing SMTP limitations
remain unchanged.

Reproduce the four artifact journeys with `scripts/navigation-release.config.js`.
Set `DIRECT_ENTRY_OUT`, `NAV_EVIDENCE`, `COMPOUNDS_RELEASE_OUT` to separate evidence
folders. For public entry checks add `NAV_RELEASE_LIVE=1`,
`MULTIPLAYER_RELEASE_ORIGIN=https://multiplayer.staragent.site` and
`--grep 'one initial load|dedicated multiplayer'`. The frozen source and exact
build metadata remain unchanged after those checks.
