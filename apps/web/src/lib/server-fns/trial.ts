import { createServerFn } from '@tanstack/react-start'
import { requireOrgSession } from '#/lib/middleware/auth'
import { getTrialStatusForOrg, type TrialStatus } from '#/lib/billing/trial'

export const TRIAL_ACTIVATED_STORAGE_KEY = 'trial-activated'

export const getTrialStatusFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<TrialStatus> => {
    const user = await requireOrgSession()
    return getTrialStatusForOrg(user.orgId)
  },
)

export function trialStatusQueryOptions() {
  return {
    queryKey: ['trial-status'] as const,
    queryFn: () => getTrialStatusFn(),
    staleTime: 5 * 60 * 1000,
  }
}
