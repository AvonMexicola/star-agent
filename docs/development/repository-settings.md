# Repository settings and activation

Repository files and GitHub settings are separate. This record must say what was
observed and what was actually enabled; do not report a policy as enforced merely
because its JSON or documentation was committed.

## Configuration and operating policy

| Setting | Configuration / policy | Reason |
| --- | --- | --- |
| Contributor default branch | `dev/all-features` | New clones see the shared development handbook; default PRs avoid accidental release promotion |
| Release branch | `main` | Deliberate, approved public promotion |
| Shared ref rewrites/deletion | Disabled by protection where available | Retain collaborators' history and recovery points |
| Required check | GitHub Actions `verify` (app 15368), up-to-date PR required | Consistent baseline check on changes to protected refs |
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

On 2026-09-07, API read-back confirmed the default changed from
`feat/visual-fidelity` to **`dev/all-features`**, with **private visibility retained**.
Both **main and dev/all-features are protected**: GitHub Actions `verify` is
required, PRs must be up to date, conversations must be resolved, and force pushes
and branch deletion are disabled. Restrictions include administrators. Publish
shared changes through a checked PR; local merge preparation remains authorized.

Required GitHub approvals are **zero**, code-owner approval is not yet enforced,
and last-push approval is off. This deliberately avoids requiring the sole appointed
human to approve their own PR. Add an eligible independent human maintainer before
enabling that gate. Domain/visual acceptance and Cees's release authority remain
operating requirements; CI cannot decide them. CODEOWNERS routing depends on the
file being present in the PR's base branch, so inspect the actual base.

The framework's [QA record](../qa/contributor-framework.md) records hosted execution
and integration separately. No repository publication, invitations, access grants,
billing changes or main deployment accompanied this settings change.

## References

GitHub documents that [code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
need write access and a CODEOWNERS file on the PR's base branch. It also explains
[branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
and [workflow security](https://docs.github.com/en/actions/reference/security/secure-use).
These references guide configuration, not proof that a particular setting is active.
