import { HandoffApiClient } from '@handoff-env/api'
import { defaultApiUrl, loadAuth, loadProjectConfig } from '../lib/config'
import { CliError } from '../lib/errors'
import { spawnWithEnv } from '../lib/spawn'

export interface RunOptions {
  env?: string
  project?: string
  token?: string
  apiUrl?: string
  override?: boolean
}

/**
 * `handoff run` is the CI-friendly entry point.
 *
 * Resolution order (first hit wins) for each input:
 *   token       : --token flag   → $HANDOFF_TOKEN    → ~/.config/handoff/auth.json
 *   apiUrl      : --api-url flag → $HANDOFF_API_URL  → .handoff/config.json → auth file → default
 *   projectSlug : --project flag → .handoff/config.json
 *   envName     : --env flag     → .handoff/config.json (defaultEnv)
 *
 * None of the files are required — pass --token, --project, and --env (plus
 * optional --api-url) and the CLI runs with zero on-disk state, which is what
 * CI wants.
 */
export async function runCommand(
  argv: string[],
  opts: RunOptions,
): Promise<void> {
  if (!argv || argv.length === 0) {
    throw new CliError(
      'Usage: handoff run [options] -- <command> [args...]',
      13,
    )
  }

  const projectConfig = await loadProjectConfig().catch(() => null)
  const auth = opts.token ? null : await loadAuth()

  const token = opts.token ?? process.env.HANDOFF_TOKEN ?? auth?.token
  if (!token) {
    throw new CliError(
      'No token. Pass --token, set HANDOFF_TOKEN, or run `handoff login` first.',
      2,
    )
  }

  const projectSlug = opts.project ?? projectConfig?.config.projectSlug
  if (!projectSlug) {
    throw new CliError(
      'No project. Pass --project <slug> or run `handoff init` in your repo.',
      7,
    )
  }

  const envName = opts.env ?? projectConfig?.config.defaultEnv
  if (!envName) {
    throw new CliError(
      'No environment. Pass --env <name> or set defaultEnv in .handoff/config.json.',
      10,
    )
  }

  const apiUrl =
    opts.apiUrl ??
    process.env.HANDOFF_API_URL ??
    projectConfig?.config.apiUrl ??
    auth?.apiUrl ??
    defaultApiUrl()

  const client = new HandoffApiClient({ baseUrl: apiUrl, token })
  const injected = await client.pull(projectSlug, envName)

  const exitCode = await spawnWithEnv(argv, injected, {
    override: opts.override ?? true,
  })
  process.exit(exitCode)
}
