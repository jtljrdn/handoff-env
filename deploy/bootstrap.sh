#!/usr/bin/env bash
# One-time VPS bootstrap. Run as root on a fresh Ubuntu 24.04 box.
#
# Before running, set:
#   GIT_REMOTE=git@github.com:<owner>/<repo>.git   # or https URL
#   DEPLOY_DOMAIN=yourdomain.com                    # used in Caddyfile substitution
#
# Re-runnable: skips steps that are already done.

set -euo pipefail

: "${GIT_REMOTE:?set GIT_REMOTE}"
: "${DEPLOY_DOMAIN:?set DEPLOY_DOMAIN}"

ROOT=/srv/handoff-env

echo "==> Installing system packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
	curl git ca-certificates ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https

echo "==> Installing Caddy"
if ! command -v caddy >/dev/null; then
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		> /etc/apt/sources.list.d/caddy-stable.list
	apt-get update
	apt-get install -y caddy
fi

echo "==> Installing Bun (system-wide)"
if ! command -v bun >/dev/null; then
	curl -fsSL https://bun.sh/install | bash
	# Symlink the bun the install script dropped into root's home into /usr/local/bin
	ln -sfn /root/.bun/bin/bun /usr/local/bin/bun
fi

echo "==> Creating deploy user"
if ! id deploy >/dev/null 2>&1; then
	adduser --disabled-password --gecos "" deploy
fi

echo "==> Creating layout under $ROOT"
mkdir -p "$ROOT"/{releases,shared,bin}
chown -R deploy:deploy "$ROOT"
chmod 750 "$ROOT/shared"

if [ ! -f "$ROOT/shared/.env" ]; then
	install -o deploy -g deploy -m 600 /dev/null "$ROOT/shared/.env"
	echo "    created empty $ROOT/shared/.env (mode 600). Fill it in before first deploy."
fi

echo "==> Cloning repo"
if [ ! -d "$ROOT/repo/.git" ]; then
	sudo -u deploy git clone "$GIT_REMOTE" "$ROOT/repo"
fi

echo "==> Installing systemd unit"
install -m 644 /srv/handoff-env/repo/deploy/handoff-web@.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable handoff-web@3001 handoff-web@3002 || true

echo "==> Installing sudoers entry"
install -m 440 /srv/handoff-env/repo/deploy/sudoers-deploy /etc/sudoers.d/deploy
visudo -c

echo "==> Installing Caddyfile"
sed "s/yourdomain\\.com/$DEPLOY_DOMAIN/g" /srv/handoff-env/repo/deploy/Caddyfile > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Installing deploy.sh"
install -o deploy -g deploy -m 755 /srv/handoff-env/repo/deploy/deploy.sh "$ROOT/bin/deploy.sh"

echo "==> Configuring firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades

cat <<EOF

==> Bootstrap complete.

Next steps:
  1. Fill in /srv/handoff-env/shared/.env (mode 600, owned by deploy).
  2. Point DNS A records: yourdomain.com, www., app. -> this server's IP.
  3. Run the first deploy:
       sudo -u deploy /srv/handoff-env/bin/deploy.sh

EOF
