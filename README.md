# handoff-env

Lightweight web + CLI secrets manager for small teams. Share `.env` files between machines, inject secrets at runtime without ever writing them to disk, and stop pinging teammates for the new Stripe key.

[gethandoff.dev](https://gethandoff.dev) · [Docs](https://gethandoff.dev/docs) · [Pricing](https://gethandoff.dev/pricing)

## Why

- **Encrypted at rest** with AES-256-GCM using a per-organization key.
- **CLI-first.** `handoff run` injects env vars into your process at startup; no `.env` sits on disk for a stray `git add` or Docker `COPY .` to leak.
- **Version history** so you can roll back a bad rotation.
- **Priced for teams, not procurement.** $20/mo for up to 10 seats.

## Install the CLI

```sh
# Standalone binary (no Node/Bun required)
curl -fsSL https://raw.githubusercontent.com/jtljrdn/handoff-env/main/install.sh | sh

# Or via npm
npm  i -g handoff-env     # bun add -g handoff-env / pnpm add -g handoff-env

# Or run on demand, no install
npx handoff-env login
```

The binary on your `$PATH` is `handoff` in every case.

See [packages/cli/README.md](packages/cli/README.md) for full install details, including pinned versions and standalone Windows/Linux/macOS binaries.

## Quick start

```sh
handoff login                        # browser auth, one time
handoff init                         # link this repo to a project
handoff push                         # upload .env
handoff run -- npm start             # run your app with secrets injected
```

## Command reference

| Command                                                 | What it does                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `handoff login [--token <t>]`                           | Sign in via browser, or paste a token for CI.                            |
| `handoff logout`                                        | Clear the saved token.                                                   |
| `handoff whoami`                                        | Print signed-in user, org, and plan.                                     |
| `handoff init`                                          | Link the current repo to a project; writes `.handoff/config.json`.       |
| `handoff pull [-e env] [-o path]`                       | Download an environment to a `.env.<env>` file.                          |
| `handoff push [-e env] [-f path] [-y]`                  | Upload a `.env` file (with diff preview).                                |
| `handoff diff [-e env] [-f path]`                       | Show local-vs-remote differences without writing.                        |
| `handoff run [-e env] [-p slug] [--token …] -- <cmd> …` | **Recommended.** Inject env vars into a subprocess at runtime.           |

## Docs

- [Introduction](https://gethandoff.dev/docs/introduction) · what Handoff is and why
- [Installation](https://gethandoff.dev/docs/getting-started/installation) · all install channels
- [Your first project](https://gethandoff.dev/docs/getting-started/first-project) · 5-minute walkthrough
- [CLI reference](https://gethandoff.dev/docs/cli/overview)
- CI/CD integration guides:
  [GitHub Actions](https://gethandoff.dev/docs/ci-cd/github-actions) ·
  [VPS with systemd](https://gethandoff.dev/docs/ci-cd/vps) ·
  [Docker](https://gethandoff.dev/docs/ci-cd/docker) ·
  [Kubernetes](https://gethandoff.dev/docs/ci-cd/kubernetes) ·
  [Serverless](https://gethandoff.dev/docs/ci-cd/serverless)
- [API tokens](https://gethandoff.dev/docs/ci-cd/tokens)

## Repository layout

```
apps/web/             TanStack Start app (marketing, dashboard, API, docs)
packages/cli/         The `handoff` CLI (published to npm as handoff-env)
packages/api/         Shared HTTP client used by the CLI
packages/types/       Shared Zod schemas / TS types
```

## Developing

```sh
bun install
bun --filter web dev               # web app at http://localhost:3000
bun --filter handoff-env dev --help # run the CLI from source
```

See [packages/cli/README.md](packages/cli/README.md) for release workflow and binary-compile scripts.

## License

MIT
