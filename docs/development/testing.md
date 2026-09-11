# Testing and reproducible evidence

Use Node 22.12+ and `npm ci`. Start with the changed area and its existing tests.
The commands below are different levels of evidence, not interchangeable green ticks.

| Command | Scope |
| --- | --- |
| `npm run check:repo` | Managed docs/ownership/task contracts; tracked-file hygiene |
| `npm run check:repo -- --base origin/dev/all-features` | Also checks the changed commit range; worktree edits are included |
| `npm run plan:checks -- --base origin/dev/all-features` | Read-only changed-area and verification plan; does not run the suggested commands |
| `npm run test:development` | Meaningful regression cases for contributor tooling |
| `npm test` | Configured world, navigation, ship, inventory and gameplay unit/invariant tests |
| `npm run build` | Production JavaScript/assets bundle; does not compile all runtime shaders |
| `npm run test:multiplayer` | Auth/protocol/authority/room/remote-player tests |
| `TEST_DATABASE_URL=... npm run test:multiplayer` | Adds the isolated-schema PostgreSQL test against an explicitly disposable database |
| `npm run test:ci-browser` | Focused production startup/map/controller smoke with real WebGL; CI uses software rendering |
| `npm run test:browser` | Existing general browser suite; not a substitute for a feature's specific journey |
| `npm run test:browser -- -c scripts/dev-launcher.config.js` | Combined launcher/ships/worlds/controller/touch/audio journeys; requires `npm run dev:all` |
| `npm run test:browser -- -c scripts/inspect.config.js` | Production physical boarding journey |
| `npm run test:browser -- -c scripts/controller-gameplay.config.js` | Actual controller mining/boarding journey, distinct from a stub UI fixture |
| `npm run test:browser -- -c scripts/promenade.config.js` | Retail promenade: controller and keyboard journeys through the hub portal, all four storefronts, a purchase in each and the sealed Deck 05 door, with a fixed-camera on/off cost pair |

Feature-specific configs live under `scripts/`; the [area registry](../../project/areas.json)
points to relevant guidance. A new test must be reachable from a documented
command and CI profile where practical; an unused `.spec.js` is not a regression gate.

## Browser setup and shared machines

The existing local harness uses system Chromium with `CHROMIUM_PATH` override.
The CI smoke config can use a Playwright-managed Chromium when that variable is
absent; install it with `npx playwright install --with-deps chromium`. Run one focused
GPU job at a time, one worker, on your owned port. The CI smoke owns frontend 4780
and memory API 4781, and refuses to reuse an existing server. It uses the ordinary
saved 60% render-resolution setting at a 1440×900 viewport to bound CPU rendering
cost; it is a functional gate, not a native-resolution art/performance baseline.
It defaults to SwiftShader; an explicit
`CI_BROWSER_BACKEND=gl` selects an available hardware backend for local inspection.
Record the actual renderer from its diagnostics; the setting alone is not evidence.
 A failure before the browser
reaches the app is infrastructure evidence, not a shader diagnosis. Follow AGENTS's
startup-crash guidance and stop repeated matching failures.

Capture page errors and console errors; examine warnings and record any inherited
ones with reasons. Keep crash logs/traces in ignored test output or a private
artifact, not source history. Commit only intentionally curated, sanitized images
and concise QA records. CI artifacts are temporary diagnostics, not permanent art approval.

## Visual and performance records

Use seed 7291 for shared comparisons unless a seed bug needs another. Record tested
commit, asset hashes, viewport, device scale, render scale, quality settings,
browser/GPU/backend and input method. Distinguish cold preload, warm steady-state
and traversal. Record sample duration and median/p95 frame times, draw calls,
triangles and memory; online checks also record tick delay, bandwidth and loss/latency.

The standard scene set in QUALITY is six viewpoints. A narrow change uses affected
views plus regressions; broad rendering/release work uses the full set and affected
other worlds. Shader output must be seen in the actual renderer. Software rasterizer
numbers cannot establish laptop-GPU budgets. Use the [benchmark template](../templates/benchmark.md).

## Database and online tests

Use the isolated local memory server for exploratory accounts. Never substitute
production `DATABASE_URL` for `TEST_DATABASE_URL`. The durable test creates a random
schema and cleans only that schema; supply a disposable test instance anyway.
CI's PostgreSQL service has synthetic credentials and no production network target.
Forgotten-password tests use fake delivery; real email delivery needs explicit
operator authorization and is a separate release check.

## Failure reporting

State command, commit, result and whether the application loaded. Keep skips visible.
Fix the underlying behavior or correct a demonstrably wrong fixture with explanation;
do not force-click through overlapping controls, loosen thresholds or add teleport
hooks to manufacture a passed physical journey. Broaden/repeat checks only when a
new change, failure or unresolved concern justifies it.

CI also validates workflow syntax/expressions with actionlint 1.7.7, downloaded
from its official release and checked against a fixed SHA-256. This is separate
from local Node-only `check:repo`, which works without downloading another tool.
The stable `verify` job fails if any planned job fails, cancels or unexpectedly
skips; documented path skips apply only to optional browser/database jobs.
