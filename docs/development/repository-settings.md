# Repository settings and activation

Repository files and GitHub settings are separate. This record must say what was
observed and what was actually enabled; do not report a policy as enforced merely
because its JSON or documentation was committed.

## Intended configuration

| Setting | Intended value | Reason |
| --- | --- | --- |
| Contributor default branch | `dev/all-features` | New clones see the shared development handbook; default PRs avoid accidental release promotion |
| Release branch | `main` | Deliberate, approved public promotion |
| Shared ref rewrites/deletion | Disabled by protection where available | Retain collaborators' history and recovery points |
| Required check | `verify`, after it has produced a real result | Consistent baseline check on changes to protected refs |
| PR discussion resolution | Required where available | Unresolved blocking findings are visible |
| Code owner routing | `.github/CODEOWNERS`, currently `@AvonMexicola` | Real accountable owner until domain maintainers are appointed |
| Required independent GitHub approval | Enable after a second eligible human maintainer is appointed | The same human cannot approve their own PR; different agent sessions are not different GitHub accounts |
| Fork PR execution | Hosted runners, read-only token, no deploy secrets | Test contributed code without access to the deployment environment |
| Repository visibility/invites | Remain invitation-based unless Cees changes them | This task does not publish the private repository or invite anyone |

The steward should add new required contexts only after the corresponding jobs
exist and run on every relevant PR; path-skipped workflows can otherwise leave
required checks pending forever. Review CI/workflow edits as privileged project
code. Do not run fork code in `pull_request_target` with secrets or on the shared
personal development runner.

## Activation record

Before this framework, GitHub reported `feat/visual-fidelity` as the default branch,
private visibility, and no main branch protection. The activation outcome is
recorded in the framework handoff/QA record after local checks and publication.
If the repository plan/API does not support a setting, retain the manual gate and
state that limitation; do not change visibility, billing or permissions to bypass it.

## References

GitHub documents that [code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
need write access and a CODEOWNERS file on the PR's base branch. It also explains
[branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
and [workflow security](https://docs.github.com/en/actions/reference/security/secure-use).
These references guide configuration, not proof that a particular setting is active.
