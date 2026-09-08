# Working with coding agents

Read this with [AGENTS](../../AGENTS.md), [architecture](../../ARCHITECTURE.md),
[quality](../../QUALITY.md) and the latest HANDOFF. These instructions organize
project work; they do not override a host's tool permissions or current user direction.

## A reliable session

1. Establish the actual repository/worktree/branch and dirty state. Read current
   issues, PRs, source and relevant tests. Read the latest handoff on entry, before
   shared-file edits/integration, and before declaring completion.
2. State one concrete player result and excluded scope. Claim exact files and
   identify shared hooks. Use a separate worktree and port. Preserve unrelated edits.
3. Write acceptance before implementation. For a bug, retain a reproduction.
   For an asset, measure scale, axes, node names, collisions and material budgets.
4. Implement a narrow complete slice. Reuse world functions, controller commands,
   inventory transactions and asset pipelines. Do not invent duplicate state owners.
5. Run appropriate checks, inspect the real result and fix findings. A successful
   build does not validate GLSL, contact geometry, multiplayer authority or visual quality.
6. Hand off the actual commit with commands, evidence, failures, limits, owned
   processes and the next action. Create a reviewable PR; do not self-certify release approval.

Use a smaller/cheaper agent for a bounded, testable subtask when its capabilities
fit. Use a stronger specialist for difficult graphics, math, architecture or art
judgment. Verify output rather than treating model branding as quality evidence.
Delegation is allowed only when the user and host permit it. Give each delegate a
bounded task, disjoint file ownership, inputs, acceptance and reporting format;
the parent remains responsible for integration. Do not spawn duplicate task owners
or recursively delegate without need/authorization.

## Evidence and honest limits

- Separate proposed, implemented, tested, independently reviewed, integrated and
  deployed. Never claim a tool ran, a shader rendered, or a reviewer approved without evidence.
- Separate generated reference imagery, Blender views, studio views and actual
  gameplay captures. A reference image is not a screenshot of an implemented asset.
- Record seed and code/asset identity, browser/backend, resolution, render scale,
  input method and test setup. Injected Gamepad is not a physical-device test.
- Keep useful failure history and the final correction. Do not lower thresholds,
  disable tests or replace true physics with a test-only shortcut to get green.
- A reviewer must independently inspect the requested behavior and artifacts.
  Reading the builder's summary alone is not independent review.
- Keep credentials and private recordings out of prompts, public logs and commits.
  Do not spend credits, message people or change deployments beyond existing authorization.

## Browser and resource coordination

One focused automated browser job at a time on a shared GPU; use the existing
single-worker harness and coordinate its port. Close only your own processes.
Stop repeated matching Chromium startup failures and diagnose their actual signature;
see AGENTS for the known Crashpad case. Distinguish that from GPU allocation failure,
shader compilation and application errors. Do not change system security or claim
skipped checks passed. Continue useful unit/build work when browser validation is blocked.

## Copyable role prompts

### Implementer

> Implement the bounded result in `<brief>`. Read current HANDOFF and source, record
> base SHA, claim `<paths>` and preserve other work. Use existing engine contracts.
> Deliver actual behavior plus appropriate tests/evidence. Report failed or unavailable
> checks, exact commit and next action. Do not deploy or declare independent approval.

### Independent reviewer

> Review `<commit>` against `<brief>` using the affected architecture and QUALITY
> contracts. Read the diff, run the reproduction, inspect the actual runtime/asset
> and input route, and distinguish new failures from inherited ones. Cite concrete
> paths/evidence, rank blockers and state what you could not test. Score applicable
> visual criteria from your own captures. Do not change acceptance to fit the result.

### Integration steward

> Read current refs, PRs, claims and HANDOFF. Integrate the agreed coherent commits
> into `dev/all-features`, resolving overlapping contracts in an isolated worktree.
> Verify the combined result, preserve authorship, refresh the owned preview and
> update source heads/status. Prepare release candidates only within authorization;
> public deployment remains a separate decision. Leave a resumable handoff.
