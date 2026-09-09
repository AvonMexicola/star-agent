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

## Checked candidate and current gate

Frozen source `0ea21d23f319070f3f7c5754f046d31a9ec28777` has passed165 configured
unit files;228 serialized multiplayer tests with two existing opt-in skips; both
explicit channel builds and47 viewer references per channel; all300 staged public
and1401 staged multiplayer file hashes; unprivileged server/memory-store startup;
and two release-artifact controller feature journeys in2.5minutes. The frozen
source remains clean. [Validation receipt](validation.json), [tractor selection](starter-loadout.png)
and [curved route](curved-route.png). Screenshots inspected; the jobs used
Chromium151/ANGLE GL with one worker,1440×900 and390×844, no page/console errors.

[PR113](https://github.com/AvonMexicola/star-agent/pull/113) source, multiplayer,
browser and plan jobs all passed. GitHub refused to start the final `verify` job:
its annotation cites failed account payments or a spending limit. It has no
runner, steps or application failure. Publication has not occurred: resolving
billing/re-running that job or explicit owner authorization of an admin merge
is required before proceeding. Both sites retain marker release `d63fab0`.
The prior operator completed and released its public/GPU window.

Local development includes the exact frozen runtime at `ccb2ed0`, while retaining
newer marker delivery records. Its managed preview/API was refreshed; served
protocol11 and both5178/8087 health routes pass. All539174 previous shared HANDOFF
bytes were preserved. [Local receipt](local-integration.json). The temporary
browser/API/preview jobs have exited; public entry checks remain pending cutover.

Recovery qualification: older catalogs reject the new tractor item in a saved
inventory. Once such saves exist, a rollback must retain the new catalog entry
or use a forward repair; do not point at an unmodified older inventory parser.
Do not reset or restore production data to reverse this application release.
SQL migrations and dependency lockfile remain byte-identical to the preceding release.
