import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import * as prompts from '@clack/prompts'
import { parseEnvText } from '@handoff-env/types'
import { requireProjectClient } from '../lib/api'
import { CliError } from '../lib/errors'
import { ui, formatDiff } from '../lib/ui'

export interface PushOptions {
  env?: string
  file?: string
  yes?: boolean
}

export async function pushCommand(opts: PushOptions): Promise<void> {
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
  if (entries.length === 0) {
    throw new CliError(`${filePath} has no variables to push.`, 12)
  }
  const variables: Record<string, string> = {}
  for (const { key, value } of entries) variables[key] = value

  const diff = await client.diff(project.config.projectSlug, envName, variables)

  ui.plain(`Diff for ${project.config.projectSlug} / ${envName}:`)
  ui.plain(formatDiff(diff))

  const noChanges =
    diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0
  if (noChanges) {
    ui.info('Nothing to push.')
    return
  }

  if (!opts.yes) {
    const ok = await prompts.confirm({
      message: `Push these changes to ${envName}?`,
      initialValue: false,
    })
    if (prompts.isCancel(ok) || !ok) {
      ui.warn('Push cancelled.')
      return
    }
  }

  const result = await client.push(project.config.projectSlug, envName, variables)
  ui.success(
    `Pushed: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted.`,
  )
}
