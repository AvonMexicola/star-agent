# ADR 0002 — PostgreSQL and Prisma for persistent local accounts

Status: accepted for implementation by Cees's SQL/Prisma request, 2026-09-07.
Implementation/self-check: Codex. Independent domain review pending.
Related: [SA-DB-001](../briefs/persistent-local-accounts.md), milestone M0.

The shared preview previously forced RAM-only account storage, so refreshing its
server discarded registrations and saved inventories. MijnSchoolInzicht provides
the requested reference: PostgreSQL, Prisma 7 and the PrismaPg adapter. Star Agent
already has durable SQL tables, constraints and transaction semantics to retain.

Prisma 7.9.1 now implements the existing store interface. The JavaScript client
generator keeps the plain Node server runnable without adding a TypeScript build
step. The versioned SQL migration and `schema_migrations` record remain the schema
authority, including expression indexes and checks that Prisma cannot fully model.
No account UUID, hash, save schema, wire protocol or authentication policy changes.

The local runner starts native PostgreSQL 16.14 from pinned portable development
binaries, with a persistent named directory outside Git, generated private local
credentials, SCRAM authentication and loopback TCP only. It waits for API save
queues before stopping SQL. External local PostgreSQL is supported through the
explicit `DEV_DATABASE_URL`; production keeps its existing `DATABASE_URL` route.
Offline temporary test flights remain separate from persistent online inventory.

The [embedded-postgres package](https://github.com/leinelissen/embedded-postgres)
supplies platform binaries. We invoke the binaries directly so its global exit
hook cannot stop SQL before queued gameplay writes drain. Only the development
runner uses them. PostgreSQL runs as the current user; no system user, Docker,
school database or hosted service is created or modified. A major-version mismatch
fails explicitly and requires an operator upgrade/restore.

The initial [Prisma local Postgres/PGlite](https://docs.prisma.io/docs/postgres/database/local-development)
trial passed simple restart tests but failed simultaneous registration with an
08P01 prepared-statement parameter collision. Native PostgreSQL passes the same
existing race test. The lightweight trial is not part of the implemented runner.

The CLI's transitive deepmerge-ts/mysql2 versions initially reported advisories.
Scoped pinned overrides to 8.0.0/3.24.3 pass generation and the checks and produce
a zero-advisory npm audit. Revisit the overrides when the parent packages update.

Adoption is compatible with the existing SQL tables and hashes. The previous SQL
adapter can read the same database if application code is rolled back. A stopped
local cluster and its credentials can be copied to a new name and restored;
the automated HTTP/WebSocket test verifies account/session/inventory continuity.
No schema reset, production deployment or independent acceptance is implied.
