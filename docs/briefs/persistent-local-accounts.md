# SA-DB-001 — keep multiplayer accounts across preview restarts

Status: review. Milestone M0. Sponsor: Cees / @AvonMexicola.
Implementation: Codex persistence session. Independent review pending.
Branch: `fix/persistent-local-accounts`, base `a748be10`.

The shared preview forces the account service into an in-memory store. Updating
the server consequently loses accounts, sessions and saved inventory. Cees requests
SQL with Prisma, using MijnSchoolInzicht's PostgreSQL/Prisma pattern as a reference.

Use a dedicated persistent local PostgreSQL database and Prisma's PostgreSQL
adapter. Preserve the existing account IDs, password/token hashes, case-insensitive
uniqueness, reset locking, JSONB state and transactional SQL migration history.
The local runner must reopen the same database on subsequent starts and fail
explicitly if it cannot start persistence. Temporary offline test flights remain
independent. No school database, credentials or real email delivery are needed.

Acceptance: HTTP registration, session cookie, login and authoritative inventory
survive a full API restart; the database survives its own restart. Existing auth,
uniqueness races, reset revocation and bounded state checks pass against SQL.
Fresh and existing SQL schemas work without data reset. Current keyboard,
controller and touch account controls continue to reach the persistent API.

Claimed files are listed in `project/tasks/SA-DB-001.json`. Shared preview ports
5178/8087 are refreshed after verification; isolated test ports are selected by
the harness. Document the database location, migration and backup/restore commands.
Local integration and a checked PR are in scope; production deployment is separate.
