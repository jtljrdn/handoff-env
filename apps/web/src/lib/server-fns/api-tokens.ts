import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createApiTokenSchema } from '@handoff-env/types'
import type { OrgRole } from '@handoff-env/types'
import { pool } from '#/db/pool'
import {
  forbidden,
  requireOrgSession,
  requirePermission,
} from '#/lib/middleware/auth'
import { hasPermission } from '#/lib/permissions'
import {
  assertCanCreateApiToken,
  getOrgApiTokenCount,
  getOrgPlan,
} from '#/lib/billing/entitlements'
import { getLimits } from '#/lib/billing/plans'
import {
  createApiToken,
  listApiTokens,
  listOrgApiTokens,
  revokeAnyApiToken,
  revokeApiToken,
  type ApiTokenRow,
  type OrgApiTokenRow,
} from '#/lib/services/api-tokens'

async function getCallerRole(userId: string, orgId: string): Promise<OrgRole> {
  const result = await pool.query(
    'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
    [userId, orgId],
  )
  if (result.rows.length === 0) {
    forbidden('You are not a member of this organization')
  }
  return result.rows[0].role as OrgRole
}

export interface ListApiTokensResult {
  tokens: (ApiTokenRow | OrgApiTokenRow)[]
  canViewAll: boolean
  canCreate: boolean
  currentUserId: string
  plan: 'free' | 'team'
  tokenCount: number
  maxApiTokens: number
}

export const listApiTokensFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ListApiTokensResult> => {
    const user = await requireOrgSession()
    const role = await getCallerRole(user.userId, user.orgId)
    const canViewAll = hasPermission(role, 'apiToken', 'viewAll')
    const canCreate = hasPermission(role, 'apiToken', 'create')
    const [plan, tokenCount, tokens] = await Promise.all([
      getOrgPlan(user.orgId),
      getOrgApiTokenCount(user.orgId),
      canViewAll
        ? listOrgApiTokens(user.orgId)
        : listApiTokens(user.userId, user.orgId),
    ])

    return {
      tokens,
      canViewAll,
      canCreate,
      currentUserId: user.userId,
      plan,
      tokenCount,
      maxApiTokens: getLimits(plan).maxApiTokens,
    }
  },
)

export const createApiTokenFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => createApiTokenSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requirePermission('apiToken', 'create')
    await assertCanCreateApiToken(user.orgId)
    const { id, prefix } = await createApiToken(user.userId, user.orgId, data)
    return { id, prefix }
  })

export const revokeApiTokenFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { tokenId: string }) => {
    z.object({ tokenId: z.string().min(1) }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    const role = await getCallerRole(user.userId, user.orgId)

    if (hasPermission(role, 'apiToken', 'revokeAny')) {
      const ok = await revokeAnyApiToken(data.tokenId, user.orgId, user.userId)
      if (!ok) forbidden('Token not found')
      return { ok: true as const }
    }

    if (!hasPermission(role, 'apiToken', 'revoke')) {
      forbidden('You do not have permission to revoke tokens')
    }
    const ok = await revokeApiToken(data.tokenId, user.userId)
    if (!ok) forbidden('Token not found or not owned by you')
    return { ok: true as const }
  })
