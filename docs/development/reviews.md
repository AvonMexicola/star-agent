# Review gates

The author self-checks; an independent reviewer examines the actual result; the
steward checks integration. CI cannot decide whether a ship looks finished or a
mission is enjoyable. [QUALITY](../../QUALITY.md) remains the quality/budget authority.

## Match the evidence to the change

| Change | Required evidence |
| --- | --- |
| Documentation/process | Working commands, valid managed links/metadata, consistent authority and no unsupported capability claims |
| Simulation/world | Meaningful invariants, seeded repeatability, precision extremes, collision/worker parity and impacted continuous travel |
| Renderer/shader/material | Real browser compilation, image and motion inspection, before/after, affected scene metrics |
| Ship/character/asset | Provenance/source, exported bounds/node/LOD/material checks, actual game fit/attachments and complete physical journey |
| Input/UI | Semantic controls, keyboard/controller/touch where reachable, full journey, focus and held-input suppression |
| Server/auth/inventory | Unauthorized/malformed/repeated intent, concurrency, durability failure, reconnect and disposable database tests |
| Economy/mining/building | Atomic consumption/grants, idempotency, world/version consistency and saved-state recovery |
| Audio | Gesture gating, actual audible/mixer output, state transitions, mute/focus/disposal; listening review distinct from event counters |
| Performance | Same scene/seed/hardware/settings, warm/cold phases, distributions and bounded memory/network growth |
| Dependency/schema/release | Decision and compatibility record, upgrade/rollback plan and relevant isolated verification |

For a small reversible fix, use proportionate checks; do not invent tests that only
mirror the implementation. For a shared contract, test meaningful failure cases.
A listed command that was not run must be `not run`, with its reason and owner.

## Development checkpoint

A coherent feature can enter the authorized dev build when it builds, passes its
relevant functional checks and launches without new errors. A new playable route
needs the controller contract; a stub callback is not its acceptance. Unfinished
art or disconnected studio features must be plainly labeled and contained in a
development/inspection route. Known inherited failures stay recorded with ownership.
A checkpoint is not a waiver of final acceptance.

## Release acceptance

The combined candidate passes its relevant unit, database, browser/input, visual
and performance gates at the exact promoted commit. Independent visual review
uses the rubric: average at least 4.0, no applicable item below 3, or an explicit
scoped Cees decision. A stricter accepted brief still applies. Tests alone do not
approve release. [The release runbook](releases.md) records human authorization.

## Reviewer procedure

Read the brief, dependencies and baseline first. Reproduce the original issue or
route; inspect actual exported assets/scene and the diff. Test failure paths and
regressions across shared boundaries. Examine resource disposal and lifecycle,
including menu/focus/disconnect transitions. Record blockers with path, evidence,
impact and a concrete correction. Distinguish a new defect from inherited debt.

Use [the review template](../templates/review.md). Report exact tested code/assets,
commands, captures and excluded scope. Review changes after fixes; do not reuse an
old score for an altered export. An author may fix and self-check but cannot relabel
that independent approval. If the independent reviewer is unavailable, retain that
limit and prepare the reviewable result without inventing a score.

## What the automated checks do

Repository checks validate managed documentation links, area/task metadata,
conflict markers, forbidden generated/secret-file paths and GitHub-sized file limits
for the inspected diff. The plan helper classifies changed paths. Unit/build,
PostgreSQL and browser jobs exercise actual code. They do not prove provenance,
complete game design, visual quality, absence of secrets, or that a claimed manual
test actually occurred. Code changes to the checks themselves need review too.
