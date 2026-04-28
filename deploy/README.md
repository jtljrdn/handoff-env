# Deploy

Production and staging deployment for handoff-env.

**Stack:** Ubuntu 24.04 VPS · Bun · TanStack Start (SSR) · Caddy · systemd · Supabase Postgres
**Hostnames:** `www.gethandoff.dev` (marketing), `app.gethandoff.dev` (product), `dev.gethandoff.dev` (staging)
**Prod strategy:** Two systemd slots (3001/3002) load-balanced by Caddy with active healthchecks. Deploys flip the idle slot, then drain the active one. Zero-downtime.
**Staging strategy:** Single systemd unit on port 3003. Tracks the `dev` branch. Auto-deploys on push to `dev`. Brief 502s during restart are acceptable.

## Files

| File | Where it lives in production |
| --- | --- |
| `Caddyfile` | `/etc/caddy/Caddyfile` |
| `handoff-web@.service` | `/etc/systemd/system/handoff-web@.service` |
| `handoff-staging.service` | `/etc/systemd/system/handoff-staging.service` |
| `sudoers-deploy` | `/etc/sudoers.d/deploy` |
| `deploy.sh` | `/srv/handoff-env/bin/deploy.sh` |
| `deploy-staging.sh` | `/srv/handoff-env/bin/deploy-staging.sh` |
| `bootstrap.sh` | run once on a fresh VPS |
| `.env.example` | template for `/srv/handoff-env/shared/.env` and `.env.staging` |

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

## Staging (dev.gethandoff.dev)

A single-slot staging environment runs on port 3003 from a parallel tree at `/srv/handoff-env/staging/`. It builds from the `dev` branch and reads `/srv/handoff-env/shared/.env.staging`.

### Trigger

Pushes to `dev` run `.github/workflows/deploy-staging.yml`, which SSHes to the VPS and runs `deploy-staging.sh`.

### Environment variables

`/srv/handoff-env/shared/.env.staging` mirrors `.env` but should point at sandbox infrastructure:

- `DATABASE_URL`: a separate staging database (separate Supabase project, or a `staging` schema/database on the same instance)
- `BETTER_AUTH_SECRET`: a unique value, not the production one
- `BETTER_AUTH_URL`: `https://dev.gethandoff.dev`
- `STRIPE_SECRET_KEY`: Stripe test mode secret (`sk_test_...`)
- `STRIPE_PUBLISHABLE_KEY`: Stripe test mode publishable key (`pk_test_...`)
- `STRIPE_WEBHOOK_SECRET`: a dedicated webhook secret for the staging endpoint (see below)

### Stripe webhook setup

In the Stripe Dashboard, **switch to Test mode** and add a new webhook endpoint:

- URL: `https://dev.gethandoff.dev/api/stripe/webhook` (match the path used in production)
- Events: same set as the production endpoint
- Copy the resulting signing secret into `STRIPE_WEBHOOK_SECRET` in `.env.staging`

The production webhook endpoint stays in Live mode and uses the production secret. The two never share keys.

### DNS

Add an A record `dev.gethandoff.dev` pointing to the VPS IP. Caddy will obtain a cert on first request.

### Manual staging deploy

```bash
ssh deploy@<vps> /srv/handoff-env/bin/deploy-staging.sh
```

### Staging rollback

```bash
ssh deploy@<vps>
ls /srv/handoff-env/staging/releases
ln -sfn /srv/handoff-env/staging/releases/<sha> /srv/handoff-env/staging/current
sudo systemctl restart handoff-staging
```
