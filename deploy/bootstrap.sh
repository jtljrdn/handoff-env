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
if ! [ -x /usr/local/bin/bun ]; then
	curl -fsSL https://bun.sh/install | bash
	# Copy (not symlink) so the binary is readable by unprivileged users.
	# /root is mode 700; a symlink into it would be unreachable from `deploy`.
	install -m 755 /root/.bun/bin/bun /usr/local/bin/bun
fi

echo "==> Creating deploy user"
if ! id deploy >/dev/null 2>&1; then
	adduser --disabled-password --gecos "" deploy
fi

echo "==> Creating layout under $ROOT"
mkdir -p "$ROOT"/{releases,shared,bin}
mkdir -p "$ROOT/staging"/{releases}
chown -R deploy:deploy "$ROOT"
chmod 750 "$ROOT/shared"

if [ ! -f "$ROOT/shared/.env" ]; then
	install -o deploy -g deploy -m 600 /dev/null "$ROOT/shared/.env"
	echo "    created empty $ROOT/shared/.env (mode 600). Fill it in before first deploy."
fi

if [ ! -f "$ROOT/shared/.env.staging" ]; then
	install -o deploy -g deploy -m 600 /dev/null "$ROOT/shared/.env.staging"
	echo "    created empty $ROOT/shared/.env.staging (mode 600). Fill it in before first staging deploy."
fi

echo "==> Cloning repo"
if [ ! -d "$ROOT/repo/.git" ]; then
	sudo -u deploy git clone "$GIT_REMOTE" "$ROOT/repo"
fi

if [ ! -d "$ROOT/staging/repo/.git" ]; then
	sudo -u deploy git clone --branch dev "$GIT_REMOTE" "$ROOT/staging/repo" || \
		sudo -u deploy git clone "$GIT_REMOTE" "$ROOT/staging/repo"
fi

echo "==> Installing systemd units"
install -m 644 /srv/handoff-env/repo/deploy/handoff-web@.service /etc/systemd/system/
install -m 644 /srv/handoff-env/repo/deploy/handoff-staging.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable handoff-web@3001 handoff-web@3002 || true
systemctl enable handoff-staging || true

echo "==> Installing sudoers entry"
install -m 440 /srv/handoff-env/repo/deploy/sudoers-deploy /etc/sudoers.d/deploy
visudo -c

echo "==> Installing Caddyfile"
sed "s/yourdomain\\.com/$DEPLOY_DOMAIN/g" /srv/handoff-env/repo/deploy/Caddyfile > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Installing deploy scripts"
install -o deploy -g deploy -m 755 /srv/handoff-env/repo/deploy/deploy.sh "$ROOT/bin/deploy.sh"
install -o deploy -g deploy -m 755 /srv/handoff-env/repo/deploy/deploy-staging.sh "$ROOT/bin/deploy-staging.sh"

echo "==> Installing Handoff CLI for the deploy user"
sudo -u deploy bash -c 'curl -fsSL https://raw.githubusercontent.com/jtljrdn/handoff-env/main/install.sh | sh'
# Ensure $HOME/.local/bin is on PATH for non-interactive SSH sessions (CI)
sudo -u deploy bash -c '
	grep -qxF "export PATH=\"\$HOME/.local/bin:\$PATH\"" ~/.bashrc \
		|| echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> ~/.bashrc
'

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
  2. Fill in /srv/handoff-env/shared/.env.staging with Stripe TEST keys and a
     dedicated STRIPE_WEBHOOK_SECRET for the dev.gethandoff.dev endpoint.
  3. Point DNS A records: yourdomain.com, www., app., dev. -> this server's IP.
  4. Run the first prod deploy:
       sudo -u deploy /srv/handoff-env/bin/deploy.sh
  5. Run the first staging deploy:
       sudo -u deploy /srv/handoff-env/bin/deploy-staging.sh

EOF
