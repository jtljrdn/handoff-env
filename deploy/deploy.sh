#!/usr/bin/env bash
# Zero-downtime deploy for handoff-env.
# Run as the `deploy` user on the VPS.
#
# Layout:
#   /srv/handoff-env/repo        bare-ish working clone of master
#   /srv/handoff-env/releases/<sha>
#   /srv/handoff-env/current     symlink -> active release
#   /srv/handoff-env/shared/.env mode 600, owned by deploy
#
# Two systemd units run continuously: handoff-web@3001 and handoff-web@3002.
# Caddy load-balances with first-healthy policy + active healthchecks.
# Deploy = restart the idle slot onto new code, wait for health, then bounce
# the previously-active slot. Caddy fails it over within ~5s.

set -euo pipefail

ROOT=/srv/handoff-env
REPO=$ROOT/repo
RELEASES=$ROOT/releases
SHARED=$ROOT/shared
CURRENT=$ROOT/current

mkdir -p "$RELEASES"

echo "==> Fetching main"
git -C "$REPO" fetch --quiet origin main
git -C "$REPO" reset --hard origin/main
SHA=$(git -C "$REPO" rev-parse --short HEAD)
REL="$RELEASES/$SHA"

if [ -d "$REL" ]; then
	echo "==> Release $SHA already built, reusing"
else
	echo "==> Building release $SHA"
	cp -a "$REPO" "$REL"
	ln -sfn "$SHARED/.env" "$REL/apps/web/.env"
	cd "$REL"
	bun install --frozen-lockfile
	bun run --filter web build
fi

# Determine active vs idle slot. Default to making 3001 active on first deploy.
ACTIVE=3001
IDLE=3002
if [ -L "$CURRENT" ] && [ -f "$CURRENT/.active-port" ]; then
	CUR=$(cat "$CURRENT/.active-port")
	if [ "$CUR" = "3001" ]; then
		ACTIVE=3001; IDLE=3002
	else
		ACTIVE=3002; IDLE=3001
	fi
fi
echo "==> Currently active=$ACTIVE, deploying onto idle=$IDLE"

# Mark the new release with the slot it will become active on.
echo "$IDLE" > "$REL/.active-port"

# Flip the symlink BEFORE restarting the idle slot so it boots from new code.
ln -sfn "$REL" "$CURRENT"

echo "==> Restarting handoff-web@$IDLE"
sudo /bin/systemctl restart "handoff-web@$IDLE"

echo "==> Waiting for :$IDLE/api/healthz"
for i in $(seq 1 40); do
	if curl -fsS --max-time 2 "http://127.0.0.1:$IDLE/api/healthz" >/dev/null; then
		echo "    healthy after ${i}s"
		break
	fi
	sleep 1
	if [ "$i" -eq 40 ]; then
		echo "!! idle slot did not become healthy; aborting"
		exit 1
	fi
done

# Caddy will detect the active slot's failure within ~10s and shift traffic.
# We give it a moment, then bounce the old slot so it comes back as standby on new code.
echo "==> Stopping handoff-web@$ACTIVE so Caddy fails over"
sudo /bin/systemctl stop "handoff-web@$ACTIVE"
sleep 12
echo "==> Bringing handoff-web@$ACTIVE back up on new code"
sudo /bin/systemctl start "handoff-web@$ACTIVE"

# /etc/caddy/Caddyfile is symlinked to the repo's deploy/Caddyfile, so the new
# release's config is already active on disk. Validate and reload Caddy.
CADDY_SRC="$CURRENT/deploy/Caddyfile"
if [ -f "$CADDY_SRC" ]; then
	echo "==> Validating Caddyfile and reloading Caddy"
	if caddy validate --config "$CADDY_SRC" --adapter caddyfile >/dev/null; then
		sudo /bin/systemctl reload caddy
		echo "    Caddy reloaded"
	else
		echo "!! Caddyfile failed validation; skipping reload"
		exit 1
	fi
fi

# Prune old releases (keep last 5)
echo "==> Pruning old releases"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "==> Deployed $SHA, active slot is now $IDLE"
