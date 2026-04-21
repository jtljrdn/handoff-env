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


### `handoff run` — the secure path

```sh
handoff run -- bun src/server.ts
handoff run -e prod -- npm start
```

`run` pulls the env into memory and spawns your command with those vars injected. Nothing touches disk, so there is no `.env` file for an editor autosave, Docker `COPY .`, or `git add -A` to leak.

Flags:

- `-e, --env <name>` — which environment to pull. Defaults to `defaultEnv` from `.handoff/config.json`.
- `-p, --project <slug>` — project slug. Defaults to `projectSlug` from `.handoff/config.json`. Required if no config file is present (stateless CI).
- `--token <token>` — API token. Also reads `$HANDOFF_TOKEN`. Skips reading `~/.config/handoff/auth.json`, so no `handoff login` step is needed.
- `--api-url <url>` — Handoff API base URL. Also reads `$HANDOFF_API_URL`.
- `--no-override` — don't overwrite env vars already set in the parent process. Useful in CI where certain secrets are injected by the runner.

Signals are forwarded to the child; `Ctrl-C` terminates cleanly. The child's exit code is the CLI's exit code.

**Caveat**: if your app prints secret *values* to its own logs, the CLI can't help. `run` eliminates at-rest leakage, not at-runtime misuse.

### CI — stateless, zero files on disk

`handoff run` accepts every input by flag or env var, so CI never needs to call `handoff login` or `handoff init`:

```sh
# GitHub Actions, GitLab CI, CircleCI, etc.
HANDOFF_TOKEN=$HANDOFF_TOKEN handoff run \
  --project my-project \
  --env production \
  -- npm start
```

Or fully flag-driven:

```sh
handoff run \
  --token "$HANDOFF_TOKEN" \
  --project my-project \
  --env production \
  -- npm start
```

If your repo already commits `.handoff/config.json`, you only need the token:

```sh
HANDOFF_TOKEN=$HANDOFF_TOKEN handoff run -- npm start
```

Store the token as a CI secret. Tokens don't expire — rotate by revoking from the web dashboard and re-issuing.

**Minimum IAM checklist** for a CI token:

- Owner generates a dedicated token named after the pipeline (so `last_used_at` in the dashboard shows the provenance).
- Store as a *masked* secret in your CI provider.
- Tokens inherit the issuer's role — for production CI, mint from a `member`-role user so even a leak can't delete projects.

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
| `~/.config/handoff/auth.json`         | `{ token, apiUrl }`                    | **no** — add to global `.gitignore` if your editor ever opens `$HOME` |


The config loader walks up from `cwd` to find `.handoff/config.json`, so you can run `handoff` from any subdirectory.

## Building

```sh
# Dev run (no build step)
bun run --filter @handoff-env/cli dev whoami

# npm bundle
bun run --filter @handoff-env/cli build

# Standalone binaries
bun run --filter @handoff-env/cli compile:all
```

## What's next?

- Self-hostability
- Better guides for integration
