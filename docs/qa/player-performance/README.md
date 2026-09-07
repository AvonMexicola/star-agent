# Player and multiplayer optimisation

SA-PERF-001 removes repeated CPU work in the combined local development build.
Runtime implementation: `a0eacba`; reconciled with wildlife development head
`20e9f1b` in `b25e867`. Comparison source: `4706d62`.

The change preserves meshes, textures, materials, shadows, animation cadence,
render resolution, interpolation, exact terrain samples, collision authority,
30 Hz simulation, 15 Hz state broadcasts and 20 Hz client input. There are no
dependencies, protocol changes, save migrations or public deployment.

## Changes and measured results

Measurements below are CPU workloads on Node 26.7 / Ryzen AI 7 350, with other
work on the shared machine. They are not whole-game FPS or worst-case guarantees.

| Work | Before → after | Evidence |
| --- | --- | --- |
| Character updates, 10 rigs × 1,800 frames | 151.46 → 127.02 ms median, 16% less CPU | [Character measurements](character-cpu.json) |
| Arm IK, 10,000 solves | 27.93 → 25.35 ms; 12 temporary Three objects removed per solve | [Character measurements](character-cpu.json) |
| Nine equipped remote pilots | 0.505 → 0.396 ms/update + matrices; 420 matrix compositions removed/frame | [Baseline](remote-cpu-baseline.json), [candidate](remote-cpu-candidate.json) |
| Server room + JSON, 10 pilots and 100 drops | 0.531 → 0.340 ms/tick; 36% lower paired median | [Paired measurements](server-cpu-paired.json) |
| Same server workload including current navigation | 1.111 → 0.859 ms/tick; 23% lower paired median | [Paired measurements](server-cpu-paired.json) |
| Public pose serialization over 1,080 server ticks | 54,000 → 5,400; same 5,400 packets and 115,568,640 JSON characters | [Paired measurements](server-cpu-paired.json) |
| UI, 150 unchanged snapshots | 13,950 element creations / 300 list replacements → 0 / 0 | [Browser measurements](ui-measurements.json) |
| Repeated altitude reads | Exact-position/seed cache replaces 20 terrain samples with 1 | [Per-body workload](navigation-cpu.json) |

Characters cache grip/action metadata and reuse IK/equipment scratch objects.
Remote hulls keep their static local matrices; gear matrices still update when
their scale changes. Player gravity/animation inputs are derived when snapshots
arrive. Reconciliation uses the same arithmetic without allocating temporary poses.
The server shares only public snapshot data within one synchronous broadcast;
inventory, commerce, hangar, health and nearby drops remain recipient-specific.
Door occupancy retains the original eight-corner collision calculation.
Hidden multiplayer manifests wait until opening, while unchanged visible controls
retain focus. Social presence still responds to roster, chat and account changes.

## Fidelity and functional validation

- Full pre-reconciliation unit suite: **857 passed**, zero skips. Multiplayer
  suite with a disposable PostgreSQL database: **123 passed**, zero skips.
  Two additional UI performance unit tests pass. After reconciliation with
  `20e9f1b`, **876 full unit tests and 125 SQL-enabled multiplayer/UI tests pass**,
  zero skips; production build and repository checks pass. These counts do not
  represent a human playtest.
- Exact character comparison covers **3,240 frames across 18 states**. Remote
  comparison covers **240 frames × nine peers**, including walk/EVA/dead/flight,
  weapons, recoil, gear and moving camera origins. Bone, morph, muzzle and hull
  results are byte-identical. Navigation tests cover tiny movement, body changes,
  vector replacement, zero radius and world-seed changes. Door equivalence covers
  240 rotated and distant-coordinate configurations.
- **Two Chromium browser cases pass in 7.4 seconds**, one worker. Chromium
  151.0.7922.173, ANGLE / AMD Radeon 860M / OpenGL ES 3.2, 1440 × 900 at scale 1.
  They use actual character, equipment and ship assets in focused fixtures.
  Browser page/console errors and warnings are empty. Vite reported an intentional
  dynamic-import analysis warning in the fixture; its imports now explicitly
  carry `@vite-ignore` without changing execution.
- Both rendered comparisons have identical raw RGBA hashes, all node matrices,
  PNG bytes, draw counts and triangles. Pilots: **64 draws / 616,121 triangles**.
  Hulls: **276 draws / 523,278 triangles**. [Comparison record](render-comparison.json),
  [before pilots](baseline-pilots.png), [after pilots](candidate-pilots.png),
  [before hulls](baseline-ships.png), [after hulls](candidate-ships.png).
- Native dialog checks cover inventory content, busy/ack changes, reopen with
  current quantities/health/drops, focused-button preservation, chat drafts,
  friendship presence and disconnect. Injected standard Gamepad and keyboard
  checks cover activation and held-input suppression. [Disconnect capture](ui-disconnect.png).
- A separate reviewer inspected the actual paired PNGs and exact comparison
  data, reviewed navigation/client/remote/server changes, reproduced the
  world-seed cache defect and verified its fix. No remaining scoped finding.

These fixtures establish rendering and state equivalence, not a complete online
flight/combat/commerce soak, phone journey, physical-controller test, independent
final art approval or six-scene hardware FPS acceptance. The production build
passes with its existing large-chunk advisory.

## Measurement and fixture failures retained

The first worktree checkout failed while writing assets in the shared temporary
filesystem; the isolated checkout was moved to the project filesystem. Vite initially could
not write through the shared dependency cache inside the sandbox; the approved
build path passed. Port 5572 was already used by the shopkeeper preview, so this
fixture uses 5592 and leaves that preview intact.

At 20:12:05 UTC Chromium aborted before page load because the test's long temporary
directory exceeded its Unix socket path limit (`process_singleton_posix.cc:313`).
The core records SIGABRT; this differs from the documented sandbox Crashpad SIGTRAP.
The initial two-test job attempted both before reporting; the harness now stops
after one failure. A short temporary path fixed startup without changing GPU or
security flags. The next run completed all UI assertions but failed on the
fixture's missing favicon; adding the existing favicon reference produced the
final two passing cases. Raw logs/full matrices remain outside Git in `/tmp`.

Separate sequential server timing runs were confounded by changing navigation
and machine contention; [baseline](server-cpu-baseline.json) and
[candidate](server-cpu-candidate.json) retain the later noisy run, including its
slower candidate result. The reported server gain instead uses alternating,
warmed baseline/candidate batches in one process with identical current
dependencies. Its individual samples retain an outlier where the candidate is
slower. Allocation and packet counts are stable; no p95/frame-time promise follows.

## Reproduce

```sh
npm test
node scripts/social-database.mjs tests/server-*.test.js tests/remote-players.test.js tests/multiplayer-ui.test.js tests/multiplayer-social-ui.test.js tests/multiplayer-ui-performance.test.js
npm run build
npm run test:browser -- -c scripts/player-performance.config.js
node scripts/prepare-player-performance-baseline.mjs
node scripts/character-cpu-performance.mjs --baseline .performance-baseline/src --baseline-label 4706d62
node scripts/benchmark-remote-players.mjs --poses-only
node scripts/navigation-performance.mjs
node scripts/server-room-performance.mjs --compare-ref 4706d62
```

Use the approved browser execution path on the restricted runner and a short,
writable `TMPDIR`. The browser configuration prepares the immutable comparison
source automatically. Default browser artifacts go to `/tmp/star-agent-player-performance`;
only curated captures and measurement records belong in this folder.

The first combined SQL rerun failed during PostgreSQL initialization, before
any test ran. Repeating with an owned project-backed temporary directory passes
all 125 checks. No shared database or application change was used to obtain this
pass. Final combined unit/build logs and both SQL attempts are retained in `/tmp`.

## Local delivery

Local `dev/all-features` now includes runtime **af419c7**, with the current
wildlife integration retained. The persistent preview was gracefully restarted
once at 20:36:52 UTC. Frontend 5178 and API 8087 return HTTP 200; all eight changed
client modules serve the expected optimisation code and the running service uses
the matching server source. The PostgreSQL cluster inode remains 947632. No
protocol/schema/database reset or production deployment occurred. Refresh the
local client at http://127.0.0.1:5178/. Exact reviewed assets are in
[asset hashes](asset-hashes.json).
