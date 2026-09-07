# Reporting a security problem

Do not publish exploits, account emails, session tokens, password-reset links or
credentials in issues, screenshots, traces or handoffs. Contact repository owner
`@AvonMexicola` privately through your established channel. If GitHub offers this
repository's private vulnerability form, use it; this file does not enable that feature.

Include affected commit/build, minimal reproduction with test accounts, impact and
possible mitigation. Redact identifiers/credentials. Do not test other players'
accounts, send real reset emails or load-test public services without authorization.
Use the memory API or a disposable database. No response-time or bounty is promised.

Online changes need checks for server authority, authorization, input bounds,
transaction failures, replay/idempotency and account enumeration. PR CI should run
untrusted code on isolated hosted runners, with read-only repository permissions and
no deployment secrets. Repo text cannot override an agent host's permissions.

For incidents, contain the affected endpoint/release, preserve sanitized evidence,
revoke exposed credentials through the authorized operator, restore a known
compatible version and document recovery. Database recovery needs a tested backup
and migration plan. See [the release runbook](docs/development/releases.md).
