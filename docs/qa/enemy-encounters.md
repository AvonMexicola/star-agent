# SA-COMBAT-001 — Regional encounter verification

Status: implementation under validation, not independently accepted or deployed.
Branch `feat/enemy-encounters`, base `c766544`. Existing Nomad 02 / Kestrel hulls,
textures and fitted weapons are reused unchanged. No server, save, generator or
controller binding changes. Owned preview port: 5398.

## Implemented scope

Fifteen named local sorties across two planets, two moons and Selene's belt.
Easy / Standard / Hard changes real NPC integrity, handling and firing cadence.
Advertised rosters contain one, two or five enemies; Hard dispatch has two waves
with a ten-second warning. Each mission must be accepted through Contracts.
Beacon placement stays above the current canonical surface or above the belt
plane. Combat report filing is single-use; reports freeze actual finish state.

## Checks so far

- Focused actual unit cases: 18 pass with
  `node --test --test-isolation=none tests/space-combat.test.js`.
- `npm test`: all 146 test-file entries pass (29.9 seconds). A second run
  inserts `--test-isolation=none` immediately after `node --test` in the exact
  package script: **1,119 individual cases pass**, zero skips (92.96 seconds).
  Log: `/tmp/enemy-encounters-final-unit.log`.
- Development build passes (4.60 seconds); inherited Vite large-chunk advisory.
- Repository checks pass: 11 areas, 28 tasks, 38 managed documents.
- Suggested plan against `origin/dev/all-features` includes already integrated
  medium-ship changes (221 paths); this feature owns the bounded combat diff.
- Combined current-station/input/combat checks: **42 cases pass** after merging
  local station repair `76aa45e` into the feature branch.
- Actual browser/controller and 390×844 native touch checks: queued. UI01 was
  deliberately interrupted during world readiness when an earlier queued GPU
  owner started during approval latency; exit 130, no validation pass. Its page
  rendered the loading screen. Trace/screenshot remain in
  `/tmp/star-agent-encounter-results-ui01`; log `/tmp/enemy-encounters-ui01.log`.

## Failures and corrections

The first build could not write Vite's temporary config through the shared
node_modules symlink inside the sandbox (EROFS). The same build passed through
approved execution. No application change was used to mask this infrastructure
failure. Source review also caught report drift after a post-completion repair or
ship change; report values now freeze on the final kill, covered by a regression.
Recovery also clears pending reinforcements and targets, including a simultaneous
wave-clear/player-loss edge case. The longer contract screen gets local vertical scrolling so phone controls and
report history remain reachable within the existing fixed menu chrome.

## Limits

Offline/session only; no credits, loot or durable rewards. Existing spherical
combat hits and weapon/asteroid occlusion remain. No NPC asteroid avoidance,
ship-to-ship collisions or multiplayer NPC authority. Browser injection will not
establish physical-controller hardware, Bluetooth or full-scene FPS acceptance.
Independent review remains pending. No production deployment is authorized by
this feature work.
