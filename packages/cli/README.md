# @handoff-env/cli

The `handoff` CLI: manage env vars from your terminal, back them up, diff them, push them, and — most importantly — **inject them into a subprocess at runtime** so plaintext secrets never touch disk.

CLI access requires the Team plan. Free-plan orgs will see `CLI access requires the Team plan.` on every call.

## Install

### From npm (requires Node ≥ 18 or Bun)

```sh
npm  i -g @handoff-env/cli
bun  add -g @handoff-env/cli
pnpm add -g @handoff-env/cli
```

### Standalone binary (no runtime required)

Download the binary for your platform from the GitHub Releases page:

- `handoff-darwin-arm64` (Apple Silicon macOS)
- `handoff-darwin-x64`   (Intel macOS)
- `handoff-linux-x64`
- `handoff-linux-arm64`
- `handoff-win-x64.exe`

Drop it into `~/.local/bin` (or anywhere on your `PATH`) and `chmod +x` it.

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

| Command | What it does |
| --- | --- |
| `handoff login [--token <t>]` | Sign in via browser, or paste a token for CI. |
| `handoff logout` | Clear the saved token. |
| `handoff whoami` | Print signed-in user, org, and plan. |
| `handoff init` | Link the current repo to a Handoff project. |
| `handoff pull [-e env] [-o path] [--force]` | Download an env to a `.env.<env>` file. |
| `handoff push [-e env] [-f path] [-y]` | Upload a `.env` file (diff preview + confirm). |
| `handoff diff [-e env] [-f path]` | Show local-vs-remote without writing. |
| `handoff run [-e env] -- <cmd> …` | **Recommended.** Inject env vars into a subprocess at runtime. |

### `handoff run` — the secure path

```sh
handoff run -- bun src/server.ts
handoff run -e prod -- npm start
```

`run` pulls the env into memory and spawns your command with those vars injected. Nothing touches disk, so there is no `.env` file for an editor autosave, Docker `COPY .`, or `git add -A` to leak.

Flags:

- `-e, --env <name>` — which environment to pull. Defaults to `defaultEnv` from `.handoff/config.json`.
- `--no-override` — don't overwrite env vars already set in the parent process. Useful in CI where certain secrets are injected by the runner.

Signals are forwarded to the child; `Ctrl-C` terminates cleanly. The child's exit code is the CLI's exit code.

**Caveat**: if your app prints secret *values* to its own logs, the CLI can't help. `run` eliminates at-rest leakage, not at-runtime misuse.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Generic error |
| 2 | Not signed in / token expired |
| **3** | **CLI access requires the Team plan** |
| 4 | Forbidden (insufficient role) |
| 5 | Not found (project, env, or file) |
| 6 | Network error |
| 7 | No `.handoff/config.json` in this tree |
| 8 | Config already exists (use `--force`) |
| 9 | Project has no environments |
| 10 | No env specified and no default |
| 11 | Output file exists (use `--force`) |
| 12 | Input file has no vars |
| 13 | `handoff run` called with no command |
| 128+n | Child killed by signal *n* |

## Config

Two files, never mixed:

| File | Contains | Checked in? |
| --- | --- | --- |
| `.handoff/config.json` (in your repo) | `{ projectSlug, defaultEnv, apiUrl? }` | yes |
| `~/.config/handoff/auth.json` | `{ token, apiUrl }` | **no** — add to global `.gitignore` if your editor ever opens `$HOME` |

The config loader walks up from `cwd` to find `.handoff/config.json`, so you can run `handoff` from any subdirectory.

Point the CLI at a self-hosted Handoff server with either:

- `HANDOFF_API_URL=https://handoff.example.com handoff login`, or
- `"apiUrl": "https://handoff.example.com"` in `.handoff/config.json`.

## Building

```sh
# Dev run (no build step)
bun run --filter @handoff-env/cli dev whoami

# npm bundle
bun run --filter @handoff-env/cli build

# Standalone binaries
bun run --filter @handoff-env/cli compile:all
```
