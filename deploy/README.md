# Deploy

Production deployment for handoff-env.

**Stack:** Ubuntu 24.04 VPS · Bun · TanStack Start (SSR) · Caddy · systemd · Supabase Postgres
**Hostnames:** `www.gethandoff.dev` (marketing) and `app.gethandoff.dev` (product)
**Strategy:** Two systemd slots (3001/3002) load-balanced by Caddy with active healthchecks. Deploys flip the idle slot, then drain the active one. Zero-downtime.

## Files

| File | Where it lives in production |
| --- | --- |
| `Caddyfile` | `/etc/caddy/Caddyfile` |
| `handoff-web@.service` | `/etc/systemd/system/handoff-web@.service` |
| `sudoers-deploy` | `/etc/sudoers.d/deploy` |
| `deploy.sh` | `/srv/handoff-env/bin/deploy.sh` |
| `bootstrap.sh` | run once on a fresh VPS |
| `.env.example` | template for `/srv/handoff-env/shared/.env` |

## First-time setup

See `../README.md#deployment` for the full plan. Quick version:

```bash
# On the VPS, as root
export GIT_REMOTE=git@github.com:<owner>/handoff-env.git
export DEPLOY_DOMAIN=yourdomain.com
bash <(curl -fsSL https://raw.githubusercontent.com/<owner>/handoff-env/master/deploy/bootstrap.sh)

# Then fill in /srv/handoff-env/shared/.env and run
sudo -u deploy /srv/handoff-env/bin/deploy.sh
```

## Subsequent deploys

Push to `master`. GitHub Actions (`.github/workflows/deploy.yml`) builds, then SSHes to the VPS and runs `deploy.sh`.

Manual deploy:

```bash
ssh deploy@<vps> /srv/handoff-env/bin/deploy.sh
```

## Rollback

```bash
ssh deploy@<vps>
ls /srv/handoff-env/releases       # find the SHA you want
ln -sfn /srv/handoff-env/releases/<sha> /srv/handoff-env/current
sudo systemctl restart handoff-web@3001 handoff-web@3002
```
