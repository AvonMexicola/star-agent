# Initial branch triage

Snapshot on 2026-09-07, relative to `dev/all-features` at `8576e99`. Re-run
`npm run branches` and inspect current PRs/HANDOFF before acting; contributors
continued working during this inventory. A contained commit is not an accepted
asset or deployed release. Uncommitted work is not represented by ancestry counts.

The read-only inventory found **66 local branches**, **59 with all committed
ancestry retained in the integration line**, and **60 branches checked out in
worktrees**. GitHub had **45 open PRs**, including **28 drafts**, spread over many
stacked base branches. This is a reconciliation queue, not permission to delete
59 branches or merge 45 PRs. The inventory made no ref or worktree changes.

## Initial queue

| Lane at this snapshot | Steward action |
| --- | --- |
| Combined development, [PR 49](https://github.com/AvonMexicola/star-agent/pull/49) | Keep shared preview healthy; this draft against main is not release authorization |
| Hangar assignment/gravity, [PR 51](https://github.com/AvonMexicola/star-agent/pull/51) | Already integrated at `8576e99`; preserve protocol-2 frontend/API coordination for a later release |
| Contributor framework | Check tooling/CI, integrate into dev, verify default branch/protection separately |
| Building sandbox, `43b4c6e`, [PR 41](https://github.com/AvonMexicola/star-agent/pull/41) | Review new bounded sandbox delta and its save/inventory isolation against combined dev |
| Atlas refresh, `0b2d852` | Reconcile latest metadata/review against studio checkpoint; full physical flight/finish acceptance remains open |
| Gameplay audio, `fe29045`, [PR 50](https://github.com/AvonMexicola/star-agent/pull/50) | Runtime `5e1a21f` is integrated; reconcile subsequent review record without replacing newer runtime |
| Retail, `61699bf`; space combat, `5699e3c` | Ask current lane owners for exact deliverables and evidence; preserve active source/assets |
| Base plan `c00c455`; old sun branch `7ad09f7` | Inspect unique commits for documentation/alternate implementation before marking superseded |
| New station exterior and Aeon loose-stone lanes | Preserve active file/GPU claims in HANDOFF; lack of committed delta is not abandonment |

## Reconciling legacy PRs

For each old stacked PR, compare its exact commits with dev, inspect what remains
unique, and ask its owner to confirm whether it is active, integrated, superseded
or parked. A retarget can expose a much larger diff; do not bulk-retarget or
replace the combined tree with its old base. Record the integrated commit/evidence
before closing an obsolete PR. Retain authoring sources and owner worktrees.

New contributions use the structured task register. Existing contributors can
migrate claims when they next resume; an empty register entry is not permission
to take over their files. Only deliberately assigned maintainers become code owners.
