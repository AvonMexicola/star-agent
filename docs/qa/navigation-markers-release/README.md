# Focused navigation markers — paired release

Status: authorized candidate; deployment and final artifact receipts follow validation.
Cees explicitly requested “merge to dev, play and multiplayer” on 9 September 2026.
Operator: Codex in that session. Promotion targets protected `dev/all-features`,
`https://play.staragent.site` and `https://multiplayer.staragent.site`.

The frozen `release/navigation-markers-20260909` branch combines focused arrow
runtime `b99658b`, delivery `724ab12`, and marker styling `3fbfc74` (the clean export
of `c7adec1`). The promotion PR records the exact final candidate SHA. Startup
arrows now show the selected POI, next active contract objectives and owned
vehicles/ship. Amber objective diamonds, white POI pins, mint ship outlines and
blue rover outlines distinguish their roles on and off screen.

Only these two marker changes advance from the preceding public runtime
`ea234d2cb71cb26b53c3671a3a6db962a0da5273`. Separately integrated planetary-drive
routing remains local; unfinished ground-pirate work remains excluded.
Server, dependencies, SQL migrations, save formats, world generation and assets
are unchanged. Protocol 10, capacity 20 and seed 7291 remain compatible with
existing clients and data. Existing tabs need refreshing to receive new markers.

## Evidence and validation

[Focused arrow evidence](../focused-location-arrows/README.md) records objective
progression tests and two production browser journeys. [Marker styling evidence](../navigation-marker-styles/README.md)
records the unchanged controller/keyboard journey, desktop/phone captures and zero
page/console errors. These are author checks, not independent or physical-device
acceptance, a new graphics benchmark, or multiplayer population/SMTP certification.

The release harness `scripts/navigation-release.config.js` runs the same marker
journeys plus actual solo and multiplayer account entry against `dist/solo` and
`dist/multiplayer`. `NAV_RELEASE_LIVE=1` and
`MULTIPLAYER_RELEASE_ORIGIN=https://multiplayer.staragent.site` repeat those checks
over public HTTPS. `DIRECT_ENTRY_OUT`, `NAV_EVIDENCE` and `COMPOUNDS_RELEASE_OUT`
select separate evidence directories. One Chromium/ANGLE GL worker uses injected
standard Gamepad input and keyboard, with 1440×900 and 390×844 marker captures.
Hosted required checks and exact artifact hashes will be recorded after completion.

## Promotion and recovery

Build the committed candidate with `npm run build:solo` and
`npm run build:multiplayer`, validate with
`node scripts/deploy/validate-public.mjs --multiplayer`, then stage immutable
release directories and verify every transferred file against local SHA256 hashes.
The protected promotion PR must pass `verify` before merge and publication.

Both current rollback symlinks resolve to the preceding `ea234d2` release above:
`/opt/staragent/public-current` and `/opt/staragent/multiplayer-candidate`.
Keep those immutable directories. Switch the symlinks atomically; gracefully
restart only `staragent-multiplayer` after checking active sessions. Preserve
`/etc/staragent/multiplayer.env`, existing PostgreSQL and Caddy/DNS configuration.
The four unchanged migrations and previous same-schema backup/restore rehearsal
are recorded in the [preceding release receipt](../compounds-release/README.md);
this client presentation update requires no SQL migration or database rollback.

Verify public release IDs and entry asset hashes, actual rendered pages, API
health and a synthetic authenticated WSS hangar request, deleting only the exact
probe account. Check service logs. On failure restore the preceding symlinks,
restart the service and repeat health/entry checks; retain database contents.
