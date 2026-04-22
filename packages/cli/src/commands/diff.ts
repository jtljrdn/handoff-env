import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseEnvText } from '@handoff-env/types'
import { requireProjectClient } from '../lib/api'
import { CliError } from '../lib/errors'
import { ui, formatDiff } from '../lib/ui'

export interface DiffOptions {
  env?: string
  file?: string
}

export async function diffCommand(opts: DiffOptions): Promise<void> {
  const { client, project } = await requireProjectClient()
  const envName = opts.env ?? project.config.defaultEnv
  if (!envName) {
    throw new CliError(
      'No environment specified. Pass --env <name> or set defaultEnv in .handoff/config.json.',
      10,
    )
  }

  const filePath = resolve(project.root, opts.file ?? `.env.${envName}`)
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch {
    throw new CliError(`Could not read ${filePath}.`, 5)
  }

  const entries = parseEnvText(text)
  const variables: Record<string, string> = {}
  for (const { key, value } of entries) variables[key] = value

  const diff = await client.diff(project.config.projectSlug, envName, variables)
  ui.plain(`Diff ${filePath} vs ${project.config.projectSlug}/${envName}:`)
  ui.plain(formatDiff(diff))
}
