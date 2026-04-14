import { createServerFn } from '@tanstack/react-start'
import { createVariableSchema } from '@handoff-env/types'
import { authMiddleware } from '#/lib/middleware/auth'
import * as varService from '#/lib/services/variables'

export const getVariablesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      environmentId: string
      orgId: string
      reveal?: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    return varService.getVariables(
      data.environmentId,
      data.orgId,
      data.reveal ?? false,
    )
  })

export const setVariableFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      environmentId: string
      orgId: string
      key: string
      value: string
    }) => {
      createVariableSchema.parse({ key: input.key, value: input.value })
      return input
    },
  )
  .handler(async ({ data, context }) => {
    return varService.setVariable(
      data.environmentId,
      data.orgId,
      data.key,
      data.value,
      context.user.userId,
    )
  })

export const deleteVariableFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((input: { variableId: string }) => input)
  .handler(async ({ data, context }) => {
    await varService.deleteVariable(data.variableId, context.user.userId)
    return { success: true }
  })

export const getVariableHistoryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    (input: { variableId: string; limit?: number; offset?: number }) => input,
  )
  .handler(async ({ data }) => {
    return varService.getVariableHistory(
      data.variableId,
      data.limit,
      data.offset,
    )
  })
