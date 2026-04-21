import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { requireProjectClient } from '../lib/api'
import { CliError } from '../lib/errors'
import { ui, renderEnvText } from '../lib/ui'

export interface PullOptions {
  env?: string
  out?: string
  force?: boolean
}

export async function pullCommand(opts: PullOptions): Promise<void> {
  const { client, project } = await requireProjectClient()
  const envName = opts.env ?? project.config.defaultEnv
  if (!envName) {
    throw new CliError(
      'No environment specified. Pass --env <name> or set defaultEnv in .handoff/config.json.',
      10,
    )
  }

  const outPath = resolve(project.root, opts.out ?? `.env.${envName}`)
  if (existsSync(outPath) && !opts.force) {
    throw new CliError(
      `${outPath} already exists. Pass --force to overwrite.`,
      11,
    )
  }

  const vars = await client.pull(project.config.projectSlug, envName)
  await writeFile(outPath, renderEnvText(vars), { mode: 0o600 })

  ui.success(`Wrote ${Object.keys(vars).length} variable(s) to ${outPath}`)
}
