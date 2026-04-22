import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createVariableSchema, bulkUpsertVariablesSchema } from '@handoff-env/types'
import { requireOrgSession, requirePermission } from '#/lib/middleware/auth'
import { getOrgLimits } from '#/lib/billing/entitlements'
import * as envService from '#/lib/services/environments'
import * as varService from '#/lib/services/variables'

export const getVariablesFn = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: {
      environmentId: string
      reveal?: boolean
    }) => {
      z.object({
        environmentId: z.string().min(1),
        reveal: z.boolean().optional(),
      }).parse(input)
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    await envService.verifyEnvironmentOrg(data.environmentId, user.orgId)
    return varService.getVariables(
      data.environmentId,
      user.orgId,
      data.reveal ?? false,
    )
  })

export const setVariableFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      environmentId: string
      key: string
      value: string
    }) => {
      z.object({ environmentId: z.string().min(1) }).parse(input)
      createVariableSchema.parse({ key: input.key, value: input.value })
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    await envService.verifyEnvironmentOrg(data.environmentId, user.orgId)
    return varService.setVariable(
      data.environmentId,
      user.orgId,
      data.key,
      data.value,
      user.userId,
    )
  })

export const deleteVariableFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { variableId: string }) => {
    z.object({ variableId: z.string().min(1) }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('variable', 'delete')
    const variable = await varService.getVariableById(data.variableId)
    if (!variable) {
      throw new Error('Variable not found')
    }
    await envService.verifyEnvironmentOrg(variable.environment_id, user.orgId)
    await varService.deleteVariable(data.variableId, user.userId, user.orgId)
    return { success: true }
  })

export const bulkUpsertVariablesFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      environmentId: string
      entries: Array<{ key: string; value: string }>
    }) => {
      z.object({ environmentId: z.string().min(1) }).parse(input)
      bulkUpsertVariablesSchema.parse(input.entries)
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requirePermission('variable', 'delete')
    await envService.verifyEnvironmentOrg(data.environmentId, user.orgId)

    if (data.entries.length === 0) return { created: 0, updated: 0, deleted: 0 }

    return varService.bulkUpsertVariables(
      data.environmentId,
      user.orgId,
      data.entries,
      user.userId,
      'merge',
    )
  })

export const getVariableHistoryFn = createServerFn({ method: 'GET' })
  .inputValidator(
    (input: { variableId: string; limit?: number; offset?: number }) => {
      z.object({
        variableId: z.string().min(1),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }).parse(input)
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    const variable = await varService.getVariableById(data.variableId)
    if (!variable) {
      throw new Error('Variable not found')
    }
    await envService.verifyEnvironmentOrg(variable.environment_id, user.orgId)
    const limits = await getOrgLimits(user.orgId)
    return varService.getVariableHistory(
      data.variableId,
      limits.auditRetentionDays,
      Math.min(data.limit ?? 50, 100),
      Math.max(data.offset ?? 0, 0),
    )
  })
