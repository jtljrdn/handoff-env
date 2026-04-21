import { HandoffApiClient } from '@handoff-env/api'
import { CliError } from './errors'
import { defaultApiUrl, loadAuth, loadProjectConfig } from './config'
import type { LoadedProjectConfig } from './config'

export interface Ctx {
  client: HandoffApiClient
  apiUrl: string
}

export interface ProjectCtx extends Ctx {
  project: LoadedProjectConfig
}

export async function requireAuthClient(): Promise<Ctx> {
  const auth = await loadAuth()
  if (!auth) {
    throw new CliError('Not signed in. Run `handoff login` to get started.', 2)
  }
  const client = new HandoffApiClient({ baseUrl: auth.apiUrl, token: auth.token })
  return { client, apiUrl: auth.apiUrl }
}

export async function requireProjectClient(): Promise<ProjectCtx> {
  const project = await loadProjectConfig()
  if (!project) {
    throw new CliError(
      'No .handoff/config.json found. Run `handoff init` in your project directory.',
      7,
    )
  }
  const auth = await loadAuth()
  if (!auth) {
    throw new CliError('Not signed in. Run `handoff login` to get started.', 2)
  }
  const apiUrl = project.config.apiUrl ?? auth.apiUrl ?? defaultApiUrl()
  const client = new HandoffApiClient({ baseUrl: apiUrl, token: auth.token })
  return { client, apiUrl, project }
}
