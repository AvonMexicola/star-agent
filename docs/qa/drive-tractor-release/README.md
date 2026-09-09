# Planetary drive and starter tractor — paired release

Cees explicitly requested “merge to dev, play and multiplayer” on9September2026,
authorizing this promotion. Candidate `release/planetary-drive-tractor-20260909`
combines checked planetary drive `bcb71c9`, starter tractor `1c29454`, their local
delivery records and the preceding navigation-marker candidate `d63fab0`.
Two metadata-only merge conflicts retain the newer local integration records.
No unfinished ground-pirate work is included.

The drive can target surface locations and follow arcs around blocking worlds
with35km terrain-envelope clearance; arrivals are35km above the chosen site.
Fresh solo/multiplayer backpacks contain one cargo tractor, equipped through the
existing Tool slot. Saved quantities remain unchanged. Existing free Cargo-menu
tractor access remains available. Source gameplay evidence is retained in
[planetary drive](../planetary-drive.md) and [starter tractor](../starter-tractor/README.md).

Protocol11 requires matched browser/server code for curved-path prediction and
the new item catalog; [decision](../../decisions/curved-drive-protocol.md).
No dependency, SQL migration, persistence schema, world generator, seed or asset
change. Capacity20 and seed7291 remain. Prior same-schema backup/restore rehearsal
is recorded in [the compounds release](../compounds-release/README.md).

Release checks: full configured unit and serialized multiplayer suites, both
explicit build channels and static viewer validation; required hosted checks;
four actual browser journeys for solo entry, multiplayer account/offline entry,
far-side drive/abort/arrival and starter tractor use/return. Physical-controller,
independent art, SMTP/population and broad performance acceptance are not claimed.

Stage immutable directories under the existing public/multiplayer release roots,
verify all file hashes and unprivileged server startup, then serialize promotion
after the navigation-marker operator finishes. Record the actual preceding
symlinks as rollback targets. Check sessions before graceful multiplayer restart;
retain database, environment, Caddy/DNS and legacy main deployment configuration.
Verify public release IDs, compiled assets, API, authenticated WSS/owned tool and
browser journeys. Only the exact synthetic test account may be removed.

Status: frozen candidate preparation; checked build IDs, hosted merge and live
receipts will be appended after each succeeds. Private staging ports5696/5697/API8697.
