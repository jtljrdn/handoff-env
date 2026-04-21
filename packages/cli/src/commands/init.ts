import * as prompts from '@clack/prompts'
import { requireAuthClient } from '../lib/api'
import { saveProjectConfig, findProjectConfigPath } from '../lib/config'
import { CliError } from '../lib/errors'
import { ui } from '../lib/ui'

export interface InitOptions {
  project?: string
  env?: string
  force?: boolean
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const cwd = process.cwd()

  if (findProjectConfigPath(cwd) && !opts.force) {
    throw new CliError(
      'A .handoff/config.json already exists. Use --force to overwrite.',
      8,
    )
  }

  const { client, apiUrl } = await requireAuthClient()

  let projectSlug = opts.project
  if (!projectSlug) {
    const answer = await prompts.text({
      message: 'Project slug',
      placeholder: 'my-project',
      validate: (v) => (v.trim() ? undefined : 'Project slug is required.'),
    })
    if (prompts.isCancel(answer)) throw new CliError('Cancelled.', 0)
    projectSlug = answer.trim()
  }

  const info = await client.init(projectSlug)

  if (info.environments.length === 0) {
    throw new CliError(
      `Project "${projectSlug}" has no environments yet. Create one in the web dashboard first.`,
      9,
    )
  }

  let defaultEnv = opts.env
  if (!defaultEnv) {
    const pick = await prompts.select({
      message: 'Default environment',
      options: info.environments.map((name) => ({ value: name, label: name })),
    })
    if (prompts.isCancel(pick)) throw new CliError('Cancelled.', 0)
    defaultEnv = pick as string
  }

  if (!info.environments.includes(defaultEnv)) {
    throw new CliError(
      `Environment "${defaultEnv}" does not exist on project "${info.projectSlug}".`,
      5,
    )
  }

  const path = await saveProjectConfig(cwd, {
    projectSlug: info.projectSlug,
    defaultEnv,
    apiUrl,
  })

  ui.success(`Wrote ${path}`)
  ui.plain(`  project: ${info.projectName} (${info.projectSlug})`)
  ui.plain(`  envs:    ${info.environments.join(', ')}`)
  ui.plain(`  default: ${defaultEnv}`)
}
