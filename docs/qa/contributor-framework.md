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

The PR workflow will exercise the same source checks, an isolated PostgreSQL 16
service, and one production WebGL/map/controller smoke journey. Results and exact
run/commit IDs are recorded here after execution. Software browser evidence does
not establish laptop FPS, full controller support or visual acceptance.

Before activation: private repository, default `feat/visual-fidelity`, main and
`dev/all-features` unprotected. CODEOWNERS is routing metadata; required reviews
and checks are GitHub settings. Hosted check results, any default/protection changes,
local integration and the still-running preview must be verified before claiming them.
No public release, repository publication, invitations or paid service changes
are part of this task.
