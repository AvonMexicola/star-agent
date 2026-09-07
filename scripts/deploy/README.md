# Deploy (netcup RS 2000 G12, 159.195.204.247, Debian 13)

**Everything is served from this box. Vercel is being retired.**

The frozen public homepage/solo release now uses independent Caddy roots and
`/opt/staragent/public-current`; see [the public release runbook](../../docs/public-release.md).
The pipeline and `/opt/staragent/current` paths below describe the legacy main
release. They no longer control the public home/solo hosts after that cutover.

| Host | Serves | From |
|---|---|---|
| `play.staragent.site` | the game client (+ `/ws`, `/api` → shards on 127.0.0.1:8080–8083) | `/opt/staragent/current/public` |
| `staragent.site`, `www.staragent.site` | the homepage (`site/` in the repo); redirects to `play` until a homepage release exists | `/opt/staragent/current/site` |

## Pipeline (automatic)
`push to main` → GitHub Actions `.github/workflows/deploy.yml`: `npm ci`, `npm test`, `vite build`, then rsync a release
(`public/` = dist, `site/` = homepage) with a **restricted rsync-only key** (`rrsync -wo /opt/staragent/incoming`) into
`/opt/staragent/incoming/`, writing `RELEASE` (= git SHA) last. On the server a systemd **path unit** runs
`/usr/local/bin/staragent-promote`: copies the release to `/opt/staragent/releases/<sha>/`, atomically re-points the
`/opt/staragent/current` symlink, keeps the last 5 releases, logs to `/var/log/staragent/deploy.log`. Caddy serves from
`current/…` with automatic TLS (HTTP/3 on). Rollback: `ln -sfn /opt/staragent/releases/<older-sha> /opt/staragent/current`.

Secrets in GitHub: `DEPLOY_SSH_KEY` (private half of the rsync-only key), `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`.

## One-time setup (done 2026-09-07)
1. `ssh-copy-id -i ~/.ssh/id_ed25519_netcup.pub root@159.195.204.247` (Cees, from the laptop) — alias `staragent` in `~/.ssh/config`.
2. `ssh staragent 'DOMAIN=play.staragent.site bash -s' < scripts/deploy/bootstrap.sh` — key-only SSH, ufw 22/80/443(+udp),
   fail2ban, unattended upgrades, Node 22, Caddy, PostgreSQL 17 (db `staragent`), Redis, `staragent` user, unit templates.
3. Caddyfile (two sites) and the promote path unit were installed by hand after bootstrap; they live on the box in
   `/etc/caddy/Caddyfile`, `/usr/local/bin/staragent-promote`, `/etc/systemd/system/staragent-promote.{path,service}`.
4. DNS at mijndomein: `play` A → 159.195.204.247 (done). To retire Vercel: root `A` and `*` A → 159.195.204.247, replace the
   `www` CNAME with `A www → 159.195.204.247`; then delete the Vercel project.

## Game server (Phase 5, Astra)
Release a `server/` directory in the same release; `sudo systemctl enable --now staragent-shard@0` (Aeon; `@1` Selene,
`@2` Pyre, `@3` deep space). Env in `/etc/staragent/env` (`DATABASE_URL`, etc.).
