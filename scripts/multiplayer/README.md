# Isolated multiplayer preview deployment

The preview uses `multiplayer.staragent.site`, port8084 and a separate PostgreSQL
role/database. It does not replace `play.staragent.site`, `next.staragent.site`,
`/opt/staragent/current`, or the existing `staragent` database.

Runtime entry: `/opt/staragent/multiplayer-candidate`, now a symlink to the checked
release under `/opt/staragent/multiplayer-releases/<sha>`. The systemd unit runs
as the existing unprivileged `staragent` user with read-only application files.
Secrets belong only in `/etc/staragent/multiplayer.env` (root-owned0600); never
copy this file to the repository, test evidence or browser bundle.

Stage the reviewed `src/`, `server/` (including its generated Prisma client),
`public/`, built `dist/`, `package.json`, lockfile and `scripts/multiplayer/`. Include
the referenced `assets/**.json` layout contracts: the authoritative Atlas, Kestrel,
Burrow and station defense share them with the client. The Node simulation loads
the actual station/defense collision assets in `public/models/`; Caddy serves
compiled `dist/`. Build the client with `VITE_DEV_TOOLS=1` for the public development
launcher. Install using
`npm ci --omit=dev --ignore-scripts`. Install the service unit, reload systemd and
start `staragent-multiplayer`. Append the Caddy fragment to the existing config
only after backing it up; validate the complete config before reload.

Verify `/api/health`, a real authenticated WebSocket join and the built browser
page over HTTPS. Restart the service only between review sessions: a restart
ends active flights. Accounts, inventory, the finite-market/tractor ledger and
account-scoped base/social state remain in PostgreSQL. Graceful shutdown checkpoints
connected players before exit. Back up production and rehearse ordered additive
migrations on a disposable restored copy before switching client/server together.
Rollback the preview by disabling its unit and removing only its Caddy host block;
leave the database intact for investigation. Production is managed separately.

For real PostgreSQL tests, set `TEST_DATABASE_URL` to the dedicated test database
and `NODE_ENV=test`; memory-based unit fixtures intentionally fail under the
production guard. The PostgreSQL test uses a temporary isolated schema and cleans
it up. A successful test run is not evidence of SMTP delivery.
