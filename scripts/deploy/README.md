# Deploy (netcup RS 2000 G12, 159.195.204.247)

1. First login (once, by Cees, with the netcup root password): `ssh-copy-id -i ~/.ssh/id_ed25519_netcup.pub root@159.195.204.247`
2. Bootstrap (idempotent): `ssh staragent 'DOMAIN=play.staragent.site bash -s' < scripts/deploy/bootstrap.sh`
3. DNS: add an `A` record `play.staragent.site → 159.195.204.247` (Cloudflare proxied later); Caddy fetches TLS automatically.
4. Game server (Phase 5, Astra): deploy a release to `/opt/staragent/releases/<sha>`, symlink `/opt/staragent/current`,
   `sudo systemctl enable --now staragent-shard@0` (shard 0 = Aeon; `@1` Selene, `@2` Pyre, `@3` deep space). Ports 8080–8083 local; Caddy proxies `/ws` and `/api`.
5. Static client stays on Vercel (www.staragent.site); the server only serves entities.
