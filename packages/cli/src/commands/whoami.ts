import { requireAuthClient } from '../lib/api'
import { ui } from '../lib/ui'

export async function whoamiCommand(): Promise<void> {
  const { client } = await requireAuthClient()
  const me = await client.whoami()
  ui.plain(`email: ${me.email}`)
  ui.plain(`org:   ${me.orgName} (${me.orgSlug})`)
  ui.plain(`plan:  ${me.plan}`)
}
