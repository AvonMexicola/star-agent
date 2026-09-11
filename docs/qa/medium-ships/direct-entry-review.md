# Independent review — checked direct-entry merge

**Disposition: no required changes found in this bounded semantic merge.** This is a read-only CPU/source review of startup integration, not approval of either medium ship's art or a new browser/gameplay acceptance result.

Reviewer: `/root/nomad_cutter`. Root authored and integrated the merge. I edited no repository file and launched no browser, GPU job, application service or database operation.

## Exact scope and identity

Reviewed `/home/cees/projects/star-agent-medium-integration` candidate `2638857`, with isolated merge `1f2f92787cbca47fb8bf0cf6277c1fc6703997f6` and root merge `ee50990997286f2077c46eefc37664e4f11435b4`. The medium parent is `1d3d9c39bfe9e5b2405c21a04ed7ed0853fd4cbb`; incoming is `9d9b3fe9355a5552155d54d1d3fcdd87a1cb0588`. Its tree is exactly checked `a7d08ee` (`6021b1e0929119f09e821c1b12494c8b239ffee6`). Root advanced documentation to `19e4ab0d6f416037410fd46b5b574a4cb746baec` during the review; the reviewed runtime bytes remained unchanged and the worktree was clean.

The identity receipt records all relevant full SHA256s. In particular:

| File | SHA256 |
| --- | --- |
| `src/main.js` | `6752f176965e072eaf536909acff79626251a3a58f649c4f830e88a1c3170b4f` |
| `src/dev-launch-options.js` | `08c88dc36731201e96560858e29fbd8313813e350a351058312f86c52c56737c` |
| `src/dev-launcher.js` | `0e7ff7d7b06ced2a60e2dac4558bd0be458ff0281fbdff28bd1eff84a629495f` |
| `src/model-cache.js` | `6d4e9c9c6ff7dbb09a5654aa7b11038036dcd422a924a9ee93ac9547af1e8cf4` |
| `vite.config.js` | `0deda9b6539f691155257e0b47da6b9ff5ce4cf6f2372b7cd5f9f43971e0a608` |
| `package.json` | `0b428e7082c4c735996dda61b68ea097628ccdbbe93019df789349bdea9f4f10` |

## Findings

- **Startup ownership is coherent.** `flightEntryOptions` retains the incoming policy while preserving both medium ships in `DEV_SHIPS`. Default development entry selects Nomad and uses temporary practice storage while enabling the ordinary opening. `testFlightReady` explicitly excludes an existing opening, so its delayed promises cannot reseat the opening's walking player. There is one `StartupPreload` coordinator. Explicit generated Stratum/Gannet links still select the requested hull/location, set `autoStart`, skip the opening and retain the existing preparation/transit flow.
- **The launcher is optional and reachable.** Removing unconditional `devLauncher.open()` avoids a forced scene menu. F2 and Menu → Dev still call the existing guarded opener. During the opening, controller Menu chooses the local launcher when available and retains the account route in connected/shared contexts. The opener still refuses transit/online use, suspends keys and Gamepad state, and closes through the existing neutral-input path. These are source/CPU conclusions; I did not replay native focus or controller input here.
- **Medium preparation and failure handling survive the merge.** The unchanged `modelFor`, awaited Fleet selection, `createMediumShip` failed-load rejection and failed-cache disposal remain in place. The merge does not move authoritative selection ahead of readiness. The existing Gannet rover preparation and post-selection placement distinction also remain intact. I did not re-audit all Fleet lifecycle behavior beyond verifying these previously checked paths were retained.
- **Mining, eye/aim and saves are retained.** The medium mining callbacks, current aggregate-input adapter, camera FOV/Stratum optical tilt and reticle compensation, and read-only `miningSaveSnapshot` body are unchanged by this merge. Practice sessions continue using the in-memory adapter; the diagnostic getter still requires DEV or an explicit debug query and reads that same adapter. Normal public entry retains the regular storage path. The merge introduces no second ore ledger, storage-key migration or protocol6 behavior.
- **Model cache ordering and URL scope are correct for this build.** The cache side-effect import is the actual first main import, before the eager asset modules. The incoming cache modifier and build-time revision collector remain byte-identical. Same-origin listed model URLs receive their content hash; existing non-version query data/fragments are preserved, repeated modification is idempotent, and bundled/external/blob/data URLs remain unchanged. The actual current Nomad, station, Stratum22bbf029 and Gannet51f5578c binaries produce matching revision entries. This does not claim a browser cache hit or live-server asset-reload behavior.
- **The merge boundary and test union are intact.** All342 other tracked source/server files match the medium parent in the isolated merge. At the later candidate,338 still match after excluding the four explicitly separate Gannet/Stratum studio files. The normal test command contains the exact143-file union of both parents, without duplicates; all other package fields and the lockfile match the medium parent. Shared protocol remains **5**, and server modules are unchanged.

## Executed evidence

Receipts and runnable probes are under `/tmp/star-agent-medium-direct-entry-independent/`:

1. `run-tests.mjs` imports the existing `dev-launch-options`, `model-cache` and `startup-preload` suites into the in-process node:test runner. **19/19 pass, zero failures/skips**,73.321 ms, Node26.7.0. This includes explicit ship/location URLs, temporary-save separation, cache channel/scope behavior, preload sequencing/fallbacks and held-key release.
2. `policy-probe.mjs` independently executes the exact source-extracted `testFlightReady` expression with delayed station/ship promises in six startup contexts. Default opening/sandbox/normal cases perform no practice re-park; explicit medium/hangar cases park once after both preparations resolve. It also verifies both medium URL policies, one preload coordinator, and four actual content-hashed model URLs. **Pass.**
3. `identity.mjs` checks parent blobs, the incoming checked tree, full test union, package/lock boundary and protocol version. My first local execution stopped at `spawnSync git EPERM`; no escalation or repeated runner attempt was made. Root executed the unchanged reviewer-authored script on the host, exit0. I inspected its completed `identity.json`: **all asserted identities pass**. Direct read-only git diffs also show the narrow startup changes.

I read `docs/qa/medium-ships/direct-entry-merge.md` and root's retained merge receipt. Its1083 normal tests,58 focused tests and production-build pass are root/operator evidence, not tests I independently reran. No broader suite or browser repetition was needed to close this bounded source review. Native asset, full physical journeys, online authority, performance and release acceptance remain separate gates.
