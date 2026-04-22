import { clearAuth, loadAuth } from '../lib/config'
import { ui } from '../lib/ui'

export async function logoutCommand(): Promise<void> {
  const auth = await loadAuth()
  if (!auth) {
    ui.info('Already signed out.')
    return
  }
  await clearAuth()
  ui.success('Signed out.')
}
