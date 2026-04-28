import { createServerFn } from '@tanstack/react-start'
import { requireOrgSession } from '#/lib/middleware/auth'
import { getTrialStatusForOrg, type TrialStatus } from '#/lib/billing/trial'

export const getTrialStatusFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TrialStatus> => {
    const user = await requireOrgSession()
    return getTrialStatusForOrg(user.orgId)
  },
)
