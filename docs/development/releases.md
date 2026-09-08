# Release and recovery runbook

`dev/all-features` is the playtest/integration target; `main` is the release line.
The existing deploy workflow runs on pushes to main. Treat merging or pushing there
as a public deployment action, even for documentation. This framework does not itself
authorize a production rollout or change service credentials.

## Prepare a candidate

1. Freeze an exact integration commit on `release/<name>`; record all included
   feature heads and known exclusions. No moving branch name as the sole identifier.
2. Run the relevant tests and full release journey, including controller, physical
   boarding/departure/return, shader/visual checks and measured hardware budgets.
3. Record asset/generator/protocol/save/schema versions. Describe compatibility with
   existing clients/data and an upgrade order. Rehearse migrations on a disposable
   copy and restore a sanitized backup. A successful SQL migration is not a restore test.
4. Document build inputs, artifact hashes, service configuration names, health checks,
   rollback target and operator. Keep secret values out of the record.
5. Obtain the release authority's approval for this concrete candidate and target,
   using the [release template](../templates/release.md). Existing explicit authorization
   can be recorded; do not ask the user to reapprove an unchanged authorized action.

## Promote and verify

Use the reviewed promotion PR and repository protections. Do not deploy from a
feature PR, a fork or an unreviewed artifact. The operator watches deploy output,
verifies the actual release ID/hash and tests the public entry and affected API/WS
route. DNS resolution or an HTML title alone does not prove the intended code is live.
Check logs for new errors and confirm service/data compatibility. Record the result
and merge any release-only correction back into development.

## Recover

Stop further promotion and record the failed version, symptom and affected scope.
Choose a known compatible release; prefer an auditable rollback/revert over rewriting
shared history. Do not roll a database backward just because the frontend reverted:
check schema compatibility and transaction history first. Restore from a tested backup
only through the authorized operator, preserving evidence and explaining any data loss.
Verify recovery through the same player/API checks. Write a short incident record
with cause, impact, correction and a meaningful regression test or operating change.

## Release readiness beyond CI

Ten-person playtest/soak, real SMTP delivery, physical controllers, broad GPU/browser
coverage, final art acceptance and disaster recovery are not silently supplied by a
unit suite. Unperformed checks remain explicit. Increase population/asset budgets
only through measured evidence and the decision/quality process.
