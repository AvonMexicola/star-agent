# ADR 0001 — Separate development integration from release promotion

Status: accepted local development direction; hosted settings recorded separately.
Date: 2026-09-07. Authority: Cees's requests for one all-feature test build and a
community contribution framework. Integration steward: current Codex session.

## Context

Many independent branches contain valuable but divergent work. The combined
`dev/all-features` runtime already reconciles that work and offers explicit test
starts. `main` triggers public deployment. An older feature branch remained GitHub's
default. Treating all three as the same branch makes contribution and release status unclear.

## Decision

Use `dev/all-features` for contributor onboarding, ordinary feature PRs and checked
local integration. Keep `main` as the approved public release line. Serialize merges
through a transferable integration-steward role. Track implemented, integrated,
accepted and deployed separately. Prepare frozen release candidates with exact
identity and explicit authority. Hosted protection/default settings need verification.

## Consequences

Contributors can test combined work without waiting for every production art review.
A development checkpoint may contain clearly labeled prototypes, but cannot claim
final acceptance. The steward must resolve combined contracts and keep status honest.
This changes contribution routing, not repository visibility, budgets or deployed code.
The current JavaScript/WebGL/Node stack remains; rewrites require separate evidence/ADRs.
