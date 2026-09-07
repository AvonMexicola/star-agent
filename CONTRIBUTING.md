# Bring your agent. Build the next frontier.

A reliable ramp, better ocean, useful test or measured performance fix is a valuable
contribution. You do not need a particular AI tool or paid service. The repository
is currently invitation-based; ask Cees for access through your existing contact
channel. This guide does not change repository visibility.

## Start here

1. Read [the roadmap](ROADMAP.md), [verified status](docs/development/status.md) and
   [contributor handbook](docs/development/README.md).
2. Read [AGENTS](AGENTS.md), [architecture](ARCHITECTURE.md) and [QUALITY](QUALITY.md)
   before changing a system.
3. Check issues, PRs and the latest [handoff](HANDOFF.md). Agree one bounded result
   and claim files with the integration steward. A session limit does not abandon a task.

## Run the combined build

Install Node 22.12+ and Git. In your own clone:

```sh
git fetch origin
git switch --create feat/my-bounded-change origin/dev/all-features
npm ci
npm run dev:all
```

Open http://127.0.0.1:5178/. Choose a ship and location after preload. F2 or controller
Menu reopens the launcher. B lands/launches, G handles gear, L controls lights,
F interacts, M opens the map and H opens help. Test saves are temporary.
The [local guide](docs/local-development.md) explains ports, seeds and the separate
Atlas studio. `npm run dev` retains the ordinary game entry.

For a shared checkout, create a separate worktree instead of switching its branch:

```sh
git worktree add -b feat/my-bounded-change ../star-agent-my-change origin/dev/all-features
```

Never use another person's existing directory. Each worktree owns its dependencies
and preview port. Stop only processes you started.

## Choose and submit work

Use the issue forms or a [feature brief](docs/templates/feature.md). Include player
result, roadmap milestone, exclusions, dependencies, claimed paths and checks.
Start small before taking a whole subsystem. `npm run branches` reports branch
state without changing refs; `npm run plan:checks -- --base origin/dev/all-features`
suggests affected areas and verification.

Run the appropriate checks in [the testing guide](docs/development/testing.md).
Open a PR against **dev/all-features**, using its template and linking your issue
or brief. Drafts are welcome. An independent reviewer checks the result; the steward
resolves combined-branch conflicts and integrates the checked commit. Public
promotion follows a separate release process.

## Evidence and responsibility

Explain the trigger, previous behavior and result. Report exact commands and
results, including skips/failures. Visible changes need actual game captures and
input journeys with commit, seed, browser, GPU/backend, resolution and render scale.
Software-rendered CI is not a laptop benchmark. Assets also need source, provenance
and measured exports. Documentation-only edits need document checks, not an invented GPU tour.

Disclose agent assistance and ownership; review generated work before submitting it.
Keep secrets, personal recordings, build output and downloaded dependencies out of
commits. Preserve third-party provenance. Another game's models/textures are not
contribution material. [LICENSE](LICENSE) remains unchanged.

Follow [conduct](CODE_OF_CONDUCT.md), report vulnerabilities via [SECURITY](SECURITY.md),
and use [GOVERNANCE](GOVERNANCE.md) for decision and integration authority.
