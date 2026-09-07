# Contributor framework validation

Task SA-GOV-001, 2026-09-07. Implementation: Codex integration session, sponsored
by Cees. This is author validation, not independent human or asset acceptance.
The feature began at dev `571d781` and incorporated the hangar/gravity checkpoint
`8576e99` before running checks. No game renderer, gameplay or production deployment
code is changed by the framework itself.

## Local checks

- `npm run check:repo`: passes ownership/task metadata, 11 area contracts, managed
  local document targets and tracked/changed-file hygiene.
- `npm run test:development`: 12 passing regression tests. Includes malformed
  claims/metadata, overlap, Git ranges, read-only ref/worktree preservation,
  missing links, secret-file paths, escaping symlinks and conservative CI planning.
- `npm test`: 651 pass, no skips.
- `npm run test:multiplayer`: 87 pass, one PostgreSQL-only skip. The local machine
  has a database client but no available disposable server; Docker access was
  denied. No existing database or production credentials were substituted.
- `npm run build`: passes. Existing >500 kB chunk warning remains; no size-limit
  exception or performance acceptance is inferred from a successful bundle.
- Official actionlint 1.7.7, archive SHA-256
  `023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757`:
  workflow syntax/expressions pass. Shell/Python linters are not included in this check.
- `git diff --check`, read-only branch inventory and changed-area plan pass.
  Inventory summary and limits are in the development branch-triage record.

The helpers do not validate external URLs, Markdown fragment anchors, general
secret content, gameplay correctness or artistic merit. Claims are a cooperative
registry, not filesystem locks. Existing HANDOFF owners remain authoritative.

## Hosted validation and settings

First hosted run [34111156797](https://github.com/AvonMexicola/star-agent/actions/runs/34111156797)
at `db5b4c1`: source/planner pass and **88 multiplayer checks pass, no skips**, using
PostgreSQL 16. The browser job failed and the aggregate `verify` correctly failed.
The trace proves the app reached real WebGL: Chromium 153.0.8010.12 / ANGLE Vulkan
SwiftShader, 1440×900, scale 1, 37 rendered frames. It timed out during startup
warm-up, and the account-session request returned HTTP 500 because the test had
omitted its API. This was not a Chromium startup crash. The trace also records
the inherited missing `KHR_parallel_shader_compile` extension warning.

Correction: the harness owns a real disposable memory API on 4781, with database
and SMTP settings explicitly empty, alongside production preview 4780. The browser
uses the game's persisted 60% resolution option to bound software-renderer cost;
startup readiness, renderer errors, controller behavior and target assertions remain.
No app shader/physics bypass or synthetic server response is added. Follow-up
results will be recorded after execution. Software browser evidence does not
establish laptop FPS, full controller support or visual acceptance.

Second run [34112042481](https://github.com/AvonMexicola/star-agent/actions/runs/34112042481)
at `9eabc57` caught a harness working-directory error before browser launch:
Playwright resolved `node server/index.js` relative to `scripts/`. Both owned
servers now specify the repository root explicitly. No browser crash or shader
result is inferred from that startup failure. The branch then incorporated the
checked patrol-combat integration through dev `7bd4bd5`, preserving its runtime
and added test entry before the next combined CI run.

Third run [34112442304](https://github.com/AvonMexicola/star-agent/actions/runs/34112442304)
at `768f3f7`: source/database pass. The browser completes real startup, controller
assertions and all five map selections, with zero recorded page/console errors,
but exceeds its 300-second total deadline while capturing the scene. The retained
trace measures 168.5 s waiting for readiness and screenshots of 18.1/35.6 s; its
diagnostics show ready preload, no fallback assets, 91 frames and scale 0.6
(864×540 internal render, 1440×900 UI). The actual planet and map captures were
examined; this is still a failed test, not a passed or hardware-performance result.

The functional CI allowance is now 480 seconds overall and 240 seconds for startup,
based on that measured software-renderer workload. Every readiness, input, target
and error assertion remains. QUALITY's hardware/scene budgets are unaffected.

Before activation: private repository, default `feat/visual-fidelity`, main and
`dev/all-features` unprotected. CODEOWNERS is routing metadata; required reviews
and checks are GitHub settings. Hosted check results, any default/protection changes,
local integration and the still-running preview must be verified before claiming them.
No public release, repository publication, invitations or paid service changes
are part of this task.


## Activated hosted rules

API writes and separate reads confirm default `dev/all-features`, still private;
main/dev PR checks require `verify` from GitHub Actions app15368 with current base
and resolved conversations. Administrator bypass, force pushes and deletion are
disabled. The approval count is zero until another eligible human maintainer is
appointed. No legacy branch was deleted and no public deployment occurred.
See the repository-settings record for the current configuration and limitations.

Passing browser captures/diagnostics are written to explicit test output paths,
so the list reporter cannot discard in-memory attachments before CI uploads them.
Only temporary CI artifacts or deliberately curated images belong in the evidence
record; traces/generated test reports stay outside source history.
