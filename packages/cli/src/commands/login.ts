import { HandoffApiClient } from '@handoff-env/api'
import { defaultApiUrl, saveAuth } from '../lib/config'
import { runDeviceFlow } from '../lib/device-flow'
import { ui } from '../lib/ui'

export interface LoginOptions {
  token?: string
  apiUrl?: string
}

export async function loginCommand(opts: LoginOptions): Promise<void> {
  const apiUrl = (opts.apiUrl ?? defaultApiUrl()).replace(/\/$/, '')

  let token: string
  if (opts.token) {
    token = opts.token.trim()
  } else {
    const result = await runDeviceFlow(apiUrl)
    token = result.token
  }

  const client = new HandoffApiClient({ baseUrl: apiUrl, token })
  const me = await client.whoami()

  await saveAuth({ token, apiUrl })

  ui.success(`Signed in as ${me.email} (org: ${me.orgSlug}, plan: ${me.plan})`)
}
