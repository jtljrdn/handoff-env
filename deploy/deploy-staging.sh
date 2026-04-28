#!/usr/bin/env bash
# Staging deploy for handoff-env (dev.gethandoff.dev).
# Run as the `deploy` user on the VPS.
#
# Layout (parallel to the production tree):
#   /srv/handoff-env/staging/repo            clone tracking origin/dev
#   /srv/handoff-env/staging/releases/<sha>
#   /srv/handoff-env/staging/current         symlink -> active release
#   /srv/handoff-env/shared/.env.staging     mode 600, owned by deploy
#
# Single slot (port 3003). No zero-downtime: the unit restarts in place and
# Caddy returns 502 for a few seconds. Acceptable for staging.

set -euo pipefail

ROOT=/srv/handoff-env/staging
SHARED=/srv/handoff-env/shared
REPO=$ROOT/repo
RELEASES=$ROOT/releases
CURRENT=$ROOT/current
BRANCH=${STAGING_BRANCH:-dev}

mkdir -p "$RELEASES"

echo "==> Fetching $BRANCH"
git -C "$REPO" fetch --quiet origin "$BRANCH"
git -C "$REPO" reset --hard "origin/$BRANCH"
SHA=$(git -C "$REPO" rev-parse --short HEAD)
REL="$RELEASES/$SHA"

if [ -d "$REL" ]; then
	echo "==> Release $SHA already built, reusing"
else
	echo "==> Building release $SHA"
	cp -a "$REPO" "$REL"
	ln -sfn "$SHARED/.env.staging" "$REL/apps/web/.env"
	cd "$REL"
	bun install --frozen-lockfile
	bun run --filter web build
fi

echo "==> Flipping current -> $REL"
ln -sfn "$REL" "$CURRENT"

echo "==> Restarting handoff-staging"
sudo /bin/systemctl restart handoff-staging

echo "==> Waiting for :3003/api/healthz"
for i in $(seq 1 40); do
	if curl -fsS --max-time 2 "http://127.0.0.1:3003/api/healthz" >/dev/null; then
		echo "    healthy after ${i}s"
		break
	fi
	sleep 1
	if [ "$i" -eq 40 ]; then
		echo "!! staging did not become healthy; aborting"
		exit 1
	fi
done

# /etc/caddy/Caddyfile is symlinked to the production repo's deploy/Caddyfile,
# so staging Caddy config rides along with prod deploys, not staging deploys.
# We do NOT reload Caddy here.

echo "==> Pruning old staging releases"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "==> Staging deployed: $SHA"
