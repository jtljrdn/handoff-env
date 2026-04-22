# handoff-env

The `handoff` CLI: manage env vars from your terminal, back them up, diff them, push them, and, most importantly, **inject them into a subprocess at runtime** so plaintext secrets never touch disk.

CLI access is limited to Team-tier organizations on Handoff.

## Install

### One-shot, no global install

```sh
npx handoff-env login          # or: bunx handoff-env login
npx handoff-env run -- npm start
```

`npx`/`bunx` fetches the package on demand. Fine for ad-hoc use; slow if you run many commands in a row.

### Global install

```sh
npm  i -g handoff-env          # or: bun add -g handoff-env / pnpm add -g handoff-env
handoff login
```

The binary on `$PATH` is called `handoff` (not `handoff-env`).

### Standalone binary, no Node/Bun required

```sh
curl -fsSL https://raw.githubusercontent.com/jtljrdn/handoff-env/main/install.sh | sh
```

Detects your OS/arch, downloads the matching binary from the latest GitHub Release, and drops it at `$HOME/.local/bin/handoff`. Override with `HANDOFF_INSTALL_DIR=/usr/local/bin` or pin a version with `HANDOFF_VERSION=v0.1.0`.

If you'd rather grab the binary manually, pick one from the [Releases page](https://github.com/jtljrdn/handoff-env/releases/latest):

- `handoff-darwin-arm64` (Apple Silicon macOS)
- `handoff-darwin-x64`   (Intel macOS)
- `handoff-linux-x64`
- `handoff-linux-arm64`
- `handoff-win-x64.exe`

`chmod +x handoff-*` and move it onto your `PATH`.

## Sign in

```sh
handoff login
```

Opens your browser to the web app, lets you authorize the terminal, and writes a long-lived token to `~/.config/handoff/auth.json` (`%APPDATA%\handoff\auth.json` on Windows).

For CI, skip the browser with a token generated in the web dashboard:

```sh
handoff login --token hnd_XXXXXXXXXXXXXX
```

## Link a project

From the root of your repo:

```sh
handoff init
```

Walks you through selecting a project and default environment, then writes `.handoff/config.json` (safe to commit). The global auth file stays out of your repo.

## Commands


| Command                                     | What it does                                                   |
| ------------------------------------------- | -------------------------------------------------------------- |
| `handoff login [--token <t>]`               | Sign in via browser, or paste a token for CI.                  |
| `handoff logout`                            | Clear the saved token.                                         |
| `handoff whoami`                            | Print signed-in user, org, and plan.                           |
| `handoff init`                              | Link the current repo to a Handoff project.                    |
| `handoff pull [-e env] [-o path] [--force]` | Download an env to a `.env.<env>` file.                        |
| `handoff push [-e env] [-f path] [-y]`      | Upload a `.env` file (diff preview + confirm).                 |
| `handoff diff [-e env] [-f path]`           | Show local-vs-remote without writing.                          |
| `handoff run [-e env] [-p slug] [--token …] -- <cmd> …` | **Recommended.** Inject env vars into a subprocess at runtime. |


### `handoff run`: the secure path

```sh
handoff run -- bun src/server.ts
handoff run -e prod -- npm start
```

`run` pulls the env into memory and spawns your command with those vars injected. Nothing touches disk, so there is no `.env` file for an editor autosave, Docker `COPY .`, or `git add -A` to leak.

Flags:

- `-e, --env <name>`: which environment to pull. Defaults to `defaultEnv` from `.handoff/config.json`.
- `-p, --project <slug>`: project slug. Defaults to `projectSlug` from `.handoff/config.json`. Required if no config file is present (stateless CI).
- `--token <token>`: API token. Also reads `$HANDOFF_TOKEN`. Skips reading `~/.config/handoff/auth.json`, so no `handoff login` step is needed.
- `--api-url <url>`: Handoff API base URL. Also reads `$HANDOFF_API_URL`.
- `--no-override`: don't overwrite env vars already set in the parent process. Useful in CI where certain secrets are injected by the runner.

Signals are forwarded to the child; `Ctrl-C` terminates cleanly. The child's exit code is the CLI's exit code.

**Caveat**: if your app prints secret *values* to its own logs, the CLI can't help. `run` eliminates at-rest leakage, not at-runtime misuse.

## CI/CD

`handoff run` is designed to be stateless: token via env var or flag, project and env via flags, nothing written to disk. That makes it work the same whether it's running inside a CI job, on a VPS under systemd, inside a container, or anywhere else you control the process.

### Inputs (stateless mode)

`handoff run` reads each input from the first place it finds it:

| Input | 1st | 2nd | 3rd |
| --- | --- | --- | --- |
| token | `--token` | `$HANDOFF_TOKEN` | `~/.config/handoff/auth.json` (from `handoff login`) |
| project | `-p/--project` | `.handoff/config.json` | (none) |
| env | `-e/--env` | `defaultEnv` in config | (none) |
| apiUrl | `--api-url` | `$HANDOFF_API_URL` | config file → auth file → `https://gethandoff.dev` (published builds) / `http://localhost:3000` (source) |

So a CI step can be as stripped-down as:

```sh
# GitHub Actions, GitLab CI, CircleCI: all the same
HANDOFF_TOKEN=$HANDOFF_TOKEN handoff run \
  --project my-project --env production -- npm start
```

If you commit `.handoff/config.json` at the repo root, the project and env come from there:

```sh
HANDOFF_TOKEN=$HANDOFF_TOKEN handoff run -- npm start
```

### Deployment patterns

**Rule of thumb:** if you control the process that runs the app, use `handoff run`. If a platform owns the process, sync from CI into the platform's env store.

| Target | Pattern |
| --- | --- |
| VPS / bare metal (systemd, supervisor, pm2) | `handoff run` as the process entrypoint |
| Docker / self-built container images | `handoff run` as the `CMD` |
| Fly.io, Render, Railway, Heroku | Same as Docker: `handoff run` in your Dockerfile/buildpack |
| Kubernetes | `handoff run` in your image, token via Kubernetes `Secret` |
| Vercel, Netlify, Cloudflare Workers, AWS Lambda | Sync Handoff → platform env store from CI before deploy |

#### VPS with systemd

Install the binary once, store the token in a root-owned env file, make `handoff run` the service's `ExecStart`.

```sh
# One-time setup on the server
sudo curl -fsSL https://raw.githubusercontent.com/jtljrdn/handoff-env/main/install.sh \
  | sudo HANDOFF_INSTALL_DIR=/usr/local/bin sh

sudo install -d -m 700 /etc/handoff
echo 'HANDOFF_TOKEN=hnd_xxx' | sudo tee /etc/handoff/myapp.env >/dev/null
sudo chmod 600 /etc/handoff/myapp.env
sudo chown root:deploy /etc/handoff/myapp.env
```

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=myapp
After=network-online.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/srv/myapp/current
EnvironmentFile=/etc/handoff/myapp.env

ExecStart=/usr/local/bin/handoff run \
  --project myapp --env production \
  -- /usr/local/bin/bun run dist/server.js

Restart=on-failure
KillSignal=SIGTERM
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Rotating a secret:

```sh
# Update it in the Handoff dashboard, then:
sudo systemctl restart myapp
```

No redeploy, no `.env` file to edit. `handoff run` re-pulls on startup.

#### Docker

Bake the binary in at build time, make `handoff run` the `CMD`, pass the token at runtime.

```dockerfile
FROM oven/bun:1-alpine

RUN apk add --no-cache curl \
 && curl -fsSL https://raw.githubusercontent.com/jtljrdn/handoff-env/main/install.sh \
    | HANDOFF_INSTALL_DIR=/usr/local/bin sh

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build

CMD ["handoff", "run", "--project", "myapp", "--env", "production", "--", \
     "bun", "run", "dist/server.js"]
```

```sh
docker run -e HANDOFF_TOKEN=hnd_xxx myapp
```

The same pattern works on **Fly.io / Render / Railway / Heroku**. They all run your Dockerfile. Set `HANDOFF_TOKEN` as a platform secret (`fly secrets set HANDOFF_TOKEN=...`, Render env var, etc.) and you're done.

#### Kubernetes

Bake `handoff` into the image as above. Deliver the token via a `Secret`:

```yaml
apiVersion: v1
kind: Secret
metadata: { name: handoff-token }
stringData:
  HANDOFF_TOKEN: hnd_xxx
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          image: myapp:latest
          envFrom:
            - secretRef: { name: handoff-token }
          command: ["handoff", "run", "-p", "myapp", "-e", "production", "--", "bun", "run", "dist/server.js"]
```

#### Serverless (Vercel, Cloudflare Workers, AWS Lambda, Netlify)

Platform-owned process → `handoff run` can't wrap it. Instead, sync Handoff's env to the platform's env store from CI, then deploy. For Vercel:

```yaml
# .github/workflows/deploy.yml
- name: Sync Handoff → Vercel env, then deploy
  env:
    HANDOFF_TOKEN: ${{ secrets.HANDOFF_TOKEN }}
    VERCEL_TOKEN:  ${{ secrets.VERCEL_TOKEN }}
  run: |
    npx handoff-env pull -p myapp -e production -o /tmp/.env.prod
    while IFS='=' read -r k v; do
      [ -z "$k" ] && continue
      npx vercel env rm "$k" production --yes --token "$VERCEL_TOKEN" || true
      printf '%s' "$v" | npx vercel env add "$k" production --token "$VERCEL_TOKEN"
    done < /tmp/.env.prod
    npx vercel deploy --prod --token "$VERCEL_TOKEN"
```

Analogous scripts for **Cloudflare Workers** (`wrangler secret put`), **AWS Lambda** (`aws lambda update-function-configuration`), and **Netlify** (`netlify env:set`). In all cases Handoff is the authoring surface; the platform is the runtime store.

> Rotation on serverless means "trigger a new deploy" rather than "restart the service"; the sync script has to run for new values to take effect.

### Token hygiene

- **One token per pipeline.** Name them `CI · github-prod`, `CI · fly-staging`, etc. so `last_used_at` in the dashboard makes leaks easy to trace back.
- **Store them masked.** GitHub Actions `secrets.HANDOFF_TOKEN`, GitLab CI masked variables, `fly secrets set`, k8s `Secret`. Never in the repo or the container image.
- **Pick the right issuer.** Tokens inherit the minting user's role. Mint production tokens from a dedicated `member`-role user so a leak can't delete projects or invite new members. Owner-role tokens should be reserved for personal dev loops.
- **Revoke, don't expire.** Tokens don't expire by design. Revoke from the web dashboard when an employee leaves, a laptop is lost, or a token's `last_used_at` has been `null` for months.

## Exit codes


| Code  | Meaning                                |
| ----- | -------------------------------------- |
| 0     | Success                                |
| 1     | Generic error                          |
| 2     | Not signed in / token expired          |
| **3** | **CLI access requires the Team plan**  |
| 4     | Forbidden (insufficient role)          |
| 5     | Not found (project, env, or file)      |
| 6     | Network error                          |
| 7     | No `.handoff/config.json` in this tree |
| 8     | Config already exists (use `--force`)  |
| 9     | Project has no environments            |
| 10    | No env specified and no default        |
| 11    | Output file exists (use `--force`)     |
| 12    | Input file has no vars                 |
| 13    | `handoff run` called with no command   |
| 128+n | Child killed by signal *n*             |


## Config

Two files, never mixed:


| File                                  | Contains                               | Checked in?                                                           |
| ------------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `.handoff/config.json` (in your repo) | `{ projectSlug, defaultEnv, apiUrl? }` | yes                                                                   |
| `~/.config/handoff/auth.json`         | `{ token, apiUrl }`                    | **no**. Add to global `.gitignore` if your editor ever opens `$HOME`  |


The config loader walks up from `cwd` to find `.handoff/config.json`, so you can run `handoff` from any subdirectory.

## Building

```sh
# Dev run (no build step)
bun run --filter handoff-env dev whoami

# npm bundle (what gets published)
bun run --filter handoff-env build

# Standalone binaries (attached to GitHub Releases)
bun run --filter handoff-env compile:all
```

To cut a release, bump the version and push the tag. The `Release CLI` GitHub Action compiles all 5 binaries, attaches them to a GitHub Release, and publishes to npm with provenance:

```sh
# From the repo root:
./scripts/release-cli.sh patch        # 0.1.0 → 0.1.1 (also: minor, major, or an explicit X.Y.Z)
git push --follow-tags
```

> The helper script edits `packages/cli/package.json`, commits, and tags without going through `npm version` (which tries to run `npm install` and chokes on our `workspace:*` refs).

## Roadmap

- Self-hostability
- Richer deployment integration guides (e.g. one-command sync to Cloudflare Workers, AWS SSM)
