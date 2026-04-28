import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createVariableShareSchema } from '@handoff-env/types'
import type { VariableShareRow } from '@handoff-env/types'
import {
  forbidden,
  requireOrgSession,
  requirePermission,
} from '#/lib/middleware/auth'
import { verifyEnvironmentOrg } from '#/lib/services/environments'
import { getOrgPlan } from '#/lib/billing/entitlements'
import {
  createVariableShare,
  listVariableShares,
  revokeVariableShare,
} from '#/lib/services/variable-shares'

export const createVariableShareFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => createVariableShareSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission('variableShare', 'create')
    const plan = await getOrgPlan(user.orgId)
    if (plan !== 'team') {
      throw new Error(
        'Variable sharing requires the Team plan. Upgrade at /billing to continue.',
      )
    }

    const env = await verifyEnvironmentOrg(data.environmentId, user.orgId)

    const { id, expiresAt } = await createVariableShare(
      user.userId,
      user.orgId,
      data,
      env.project_id,
    )
    return { id, expiresAt }
  })

export const listVariableSharesFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { environmentId: string }) => {
    z.object({ environmentId: z.string().min(1) }).parse(input)
    return input
  })
  .handler(async ({ data }): Promise<{ shares: VariableShareRow[] }> => {
    const user = await requireOrgSession()
    await verifyEnvironmentOrg(data.environmentId, user.orgId)
    const shares = await listVariableShares(data.environmentId)
    return { shares }
  })

export const revokeVariableShareFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { shareId: string }) => {
    z.object({ shareId: z.string().min(1) }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('variableShare', 'revoke')
    const result = await revokeVariableShare(
      data.shareId,
      user.orgId,
      user.userId,
    )
    if (!result.ok) forbidden('Share not found')
    return { ok: true as const }
  })
