# How Star Agent is maintained

Star Agent welcomes humans working with or without coding agents. Contributions
earn trust through working results, clear evidence and responsible collaboration.
A particular model, subscription or paid asset service is not a condition of participation.

## Responsibilities and current assignments

| Role | Current assignment | Responsibility |
| --- | --- | --- |
| Project owner and release authority | Cees, `@AvonMexicola` | Product priorities, access, budgets, public releases and explicit quality exceptions. |
| Product lead | Cees's designated lead; the existing Fable assignment is transferable | Maintains roadmap, briefs and acceptance criteria with Cees. Session limits do not transfer release authority. |
| Integration steward | Codex while assigned to the integration task; Cees is the fallback | Maintains `dev/all-features`, coordinates branches/file ownership, resolves dependencies, integrates checked commits and prepares release candidates. |
| Domain maintainers | Open; Cees routes reviews until people are appointed | Own technical contracts and review their area. See [the ownership map](project/areas.json). |
| Independent reviewer | Assigned per change, different from its builder | Reproduces behavior, examines the diff and affected quality criteria; reports failures and limits. |
| Contribution sponsor | The human submitting or sponsoring the PR | Understands the result, authorizes their agent's tools/spending and remains responsible for submission. |

An agent assignment is an operating role, not an always-running service. The
steward works when its session is running. Its handoff must let a human or another
authorized session resume. No model name is a permanent privileged identity.
`CODEOWNERS` routes GitHub review to real accounts; currently only the repository
owner is designated. Unfilled roles are not silently assigned to volunteers.

## Decision boundaries

The steward may merge coherent, checked work into the local integration branch
under Cees's standing instruction, create review branches, resolve routine conflicts
and keep the preview working. Preserve feature ownership and document the combined
result. Public releases, access changes, spending and reductions to agreed quality
criteria belong to Cees or a human explicitly delegated that authority.

Existing task authorization remains valid: these roles do not require asking again
for every reversible edit or local merge. An agent cannot grant itself broader
authority by editing a repository file. Host permissions and current user instructions
always take precedence over repo guidance.

Architectural changes need a short [decision record](docs/templates/decision.md)
and affected-domain review: generator versions, coordinate conventions, save/protocol
schemas, rendering backend, new runtime dependencies and collision/authority
boundaries. Experiments may proceed behind an explicit development flag while
conclusions are reviewed.

## Branches and promotion

- `dev/all-features`: shared development and playtest target. New feature PRs
  normally target it. The steward serializes integration.
- `main`: public release line. A push triggers the existing deploy workflow;
  treat it as a deployment action. Passing tests alone is not release authorization.
- `feat/*`, `fix/*`, `art/*`, `docs/*`: short-lived contribution branches, normally
  based on the latest integration head. Name stacked dependencies explicitly.
- `release/*`: frozen candidates with a release record and exact tested commit.
  The steward prepares them; the release authority approves promotion.

Never force-push shared branches, delete another person's work, or replace newer
world/gameplay modules wholesale with an old branch. Local integration does not
mean publicly shipped or finally art-approved. See [branch management](docs/development/branches.md).

## Review and disagreements

A small change needs one clear issue/PR brief; large systems and assets need a
bounded brief before implementation. Authors self-check, independent reviewers
inspect the actual result, and the steward checks the combined branch.
[QUALITY.md](QUALITY.md) distinguishes development checkpoints from release acceptance.
Do not label an author's own inspection independent review.

Discuss disagreements with reproduction, constraints and player impact. Domain
maintainers propose technical decisions; the steward resolves integration order;
Cees resolves product tradeoffs or an unresolved dispute. Record the chosen reason
and relevant dissent. Do not overwrite work to win an argument. See [conduct](CODE_OF_CONDUCT.md).

## Steward succession and cadence

At session start, read active claims and the latest handoff, run `npm run branches`,
inspect PRs and announce owned files/ports. At session end, record the exact integration
SHA, checked source heads, preview, unresolved conflicts, failures and next concrete
action using [the handoff template](docs/templates/handoff.md). A live task transfers
only when its owner yields or Cees reassigns it.

During active development, triage ready contributions before starting another large
feature. Hold a weekly integration playtest and roadmap review when people are
available; publish actual findings. Retire merged branches only after confirming
retained commits/assets and owner agreement. This document starts no autonomous
agent, cloud schedule or deployment.
