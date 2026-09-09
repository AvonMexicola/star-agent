# Isolated multiplayer preview deployment

The preview uses `multiplayer.staragent.site`, port8084 and a separate PostgreSQL
role/database. It does not replace `play.staragent.site`, `next.staragent.site`,
`/opt/staragent/current`, or the existing `staragent` database.

Runtime directory: `/opt/staragent/multiplayer-candidate`. The systemd unit runs
as the existing unprivileged `staragent` user with read-only application files.
Secrets belong only in `/etc/staragent/multiplayer.env` (root-owned0600); never
copy this file to the repository, test evidence or browser bundle.

Stage the frozen reviewed `src/`, `server/`, `public/`, JSON asset layouts,
`prisma/`, `prisma.config.ts`, `package.json` and lockfile in a new immutable
`/opt/staragent/multiplayer-releases/<sha>` directory. Copy the explicit
`dist/multiplayer/` artifact into that directory as `dist/`. The Node simulation needs
`public/models/station.glb`, while Caddy serves the compiled `dist/`. Use `npm ci` so the pinned Prisma postinstall generates
`server/generated/prisma`; skipping scripts leaves the current server incomplete.
Verify source/artifact hashes and the unprivileged world startup, and rehearse the
existing SQL migrations against a private restore copy. For an established host,
atomically switch `multiplayer-candidate` to the staged directory and gracefully
restart only `staragent-multiplayer`. The service configuration is retained.
On first setup, install the service unit and reload systemd. Append the Caddy fragment to the existing config
only after backing it up; validate the complete config before reload.

Verify `/api/health`, a real authenticated WebSocket join and the built browser
page over HTTPS. Restart the service only between review sessions: a restart
ends active flights and discards ephemeral loose stacks. Persistent accounts and
inventory survive. Graceful shutdown checkpoints connected players before exit.
Rollback the preview by disabling its unit and removing only its Caddy host block;
leave the database intact for investigation. Production is managed separately.

For real PostgreSQL tests, set `TEST_DATABASE_URL` to the dedicated test database
and `NODE_ENV=test`; memory-based unit fixtures intentionally fail under the
production guard. The PostgreSQL test uses a temporary isolated schema and cleans
it up. A successful test run is not evidence of SMTP delivery.

Current paired public release and rollback identities: [9 September receipt](../../docs/qa/compounds-release/README.md).
