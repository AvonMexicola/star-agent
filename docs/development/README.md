# Contributor handbook

Start with [CONTRIBUTING](../../CONTRIBUTING.md) for your first checkout and PR.
This handbook is the shared route through the project, including session handovers.

| Need | Read or run |
| --- | --- |
| What can I play today? | [Verified status](status.md), [local preview](../local-development.md) |
| What are we building? | [Roadmap](../../ROADMAP.md) |
| Who decides and merges? | [Governance](../../GOVERNANCE.md), [branch stewardship](branches.md) |
| Where does a change belong? | [Architecture](../../ARCHITECTURE.md), [ownership map](../../project/areas.json) |
| How do agents contribute? | [Agent guide](agents.md), [AGENTS](../../AGENTS.md) |
| What checks matter? | [Testing](testing.md), [reviews](reviews.md), [quality bar](../../QUALITY.md) |
| How do we produce assets? | [Asset standard](../asset-production-standard.md), [ship](../../SHIP-PIPELINE-MEMORY.md), [station](../../STATION-PIPELINE-MEMORY.md), [planet](../../PLANET-PIPELINE-MEMORY.md) pipelines |
| How do releases recover? | [Release runbook](releases.md) |
| What needs admin setup? | [Repository settings](repository-settings.md) |
| Which branches are integrated? | `npm run branches` (read-only) |
| Which checks does my diff need? | `npm run plan:checks -- --base origin/dev/all-features` |

Reusable records: [feature](../templates/feature.md), [handoff](../templates/handoff.md),
[review](../templates/review.md), [decision](../templates/decision.md),
[asset intake](../templates/asset.md), [benchmark](../templates/benchmark.md),
[release](../templates/release.md).

## Sources of truth

ROADMAP is the vision and milestone plan. Status records distinguish implemented,
integrated, accepted and deployed. Issues/briefs bound work. HANDOFF and task claims
coordinate current sessions. Architecture and QUALITY define shared contracts.
Historical handoffs and archived plans are evidence, not current implementation or permission.

Current user instructions and higher-priority host policies take precedence.
Within the repo, a narrower accepted brief can raise a quality requirement but
cannot silently lower a shared one. Cees records an explicit exception with its
scope, reason and follow-up work.
