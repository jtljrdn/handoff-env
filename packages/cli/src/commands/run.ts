import { requireProjectClient } from '../lib/api'
import { CliError } from '../lib/errors'
import { spawnWithEnv } from '../lib/spawn'

export interface RunOptions {
  env?: string
  override?: boolean
}

export async function runCommand(
  argv: string[],
  opts: RunOptions,
): Promise<void> {
  if (!argv || argv.length === 0) {
    throw new CliError(
      'Usage: handoff run [-e <env>] -- <command> [args...]',
      13,
    )
  }

  const { client, project } = await requireProjectClient()
  const envName = opts.env ?? project.config.defaultEnv
  if (!envName) {
    throw new CliError(
      'No environment specified. Pass --env <name> or set defaultEnv in .handoff/config.json.',
      10,
    )
  }

  const injected = await client.pull(project.config.projectSlug, envName)

  const exitCode = await spawnWithEnv(argv, injected, {
    override: opts.override ?? true,
  })
  process.exit(exitCode)
}
