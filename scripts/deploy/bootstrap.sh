#!/usr/bin/env bash
# Star Agent — one-shot bootstrap for the netcup RS 2000 G12 (Debian 13 "trixie", x86-64; also works on Ubuntu 24.04).
# Run ONCE as root over SSH:  ssh staragent 'bash -s' < scripts/deploy/bootstrap.sh
# Idempotent: safe to re-run. Creates the `staragent` service user, key-only SSH, firewall,
# unattended upgrades, fail2ban, Node 22, Caddy (TLS + reverse proxy), Postgres (distro version), Redis, systemd unit stubs.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
DEPLOY_USER=staragent
DOMAIN="${DOMAIN:-play.staragent.site}"          # server-side game endpoint (Cloudflare in front later)
PUBKEY="${PUBKEY:-$(cat /root/.ssh/authorized_keys | head -1)}"

echo "== packages"
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades apt-listchanges curl git jq ca-certificates gnupg \
  postgresql redis-server debian-keyring debian-archive-keyring apt-transport-https sudo openssl >/dev/null   # Debian 13 ships PostgreSQL 17

echo "== service user"
id -u $DEPLOY_USER >/dev/null 2>&1 || adduser --disabled-password --gecos "" $DEPLOY_USER
usermod -aG sudo $DEPLOY_USER
install -d -m 700 -o $DEPLOY_USER -g $DEPLOY_USER /home/$DEPLOY_USER/.ssh
echo "$PUBKEY" > /home/$DEPLOY_USER/.ssh/authorized_keys
chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh/authorized_keys; chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl" > /etc/sudoers.d/$DEPLOY_USER; chmod 440 /etc/sudoers.d/$DEPLOY_USER

echo "== ssh hardening (key-only, no root password)"
cat > /etc/ssh/sshd_config.d/90-staragent.conf <<'SSH'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 3
SSH
systemctl reload ssh 2>/dev/null || systemctl reload sshd

echo "== firewall"
ufw --force reset >/dev/null
ufw default deny incoming; ufw default allow outgoing
ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw allow 443/udp   # 443/udp for WebTransport (HTTP/3)
ufw --force enable

echo "== unattended upgrades + fail2ban"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
cat > /etc/fail2ban/jail.local <<'F2B'
[sshd]
enabled = true
maxretry = 4
bantime = 1h
F2B
systemctl enable --now fail2ban >/dev/null

echo "== node 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

echo "== caddy (TLS + reverse proxy; HTTP/3 on by default)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
cat > /etc/caddy/Caddyfile <<CADDY
${DOMAIN} {
    encode zstd gzip
    handle /ws* {
        reverse_proxy 127.0.0.1:8080
    }
    handle /api/* {
        reverse_proxy 127.0.0.1:8080
    }
    handle {
        respond "Star Agent server: ok" 200
    }
}
CADDY
systemctl enable --now caddy >/dev/null && systemctl reload caddy

echo "== postgres + redis"
systemctl enable --now postgresql redis-server >/dev/null; PGV=$(ls /etc/postgresql | sort -n | tail -1); echo "postgres $PGV"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='staragent'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE staragent LOGIN PASSWORD '$(openssl rand -hex 16)';" >/dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='staragent'" | grep -q 1 || \
  sudo -u postgres createdb -O staragent staragent
# Redis: local only (default bind 127.0.0.1); nothing to do.

echo "== app layout + systemd unit template (the game server itself is Astra's, Phase 5)"
install -d -o $DEPLOY_USER -g $DEPLOY_USER /opt/staragent /opt/staragent/releases /var/log/staragent
cat > /etc/systemd/system/staragent-shard@.service <<'UNIT'
[Unit]
Description=Star Agent shard %i
After=network-online.target postgresql.service redis-server.service
Wants=network-online.target

[Service]
User=staragent
WorkingDirectory=/opt/staragent/current
Environment=NODE_ENV=production SHARD=%i PORT=808%i
EnvironmentFile=-/etc/staragent/env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=2
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
install -d -m 750 -o root -g $DEPLOY_USER /etc/staragent
[ -f /etc/staragent/env ] || echo "# DATABASE_URL=postgres://staragent:<pw>@127.0.0.1/staragent" > /etc/staragent/env
systemctl daemon-reload

echo "== done"
echo "user: $DEPLOY_USER · caddy: https://${DOMAIN} (needs DNS A record → $(curl -s https://api.ipify.org)) · pg db: staragent · redis: local"
