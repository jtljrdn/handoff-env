import { createServerFn } from '@tanstack/react-start'
import { createEnvironmentSchema } from '@handoff-env/types'
import { authMiddleware } from '#/lib/middleware/auth'
import * as envService from '#/lib/services/environments'

export const listEnvironmentsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    return envService.listEnvironments(data.projectId)
  })

export const createEnvironmentFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (input: { projectId: string; name: string; sortOrder?: number }) => {
      createEnvironmentSchema.parse({
        name: input.name,
        sortOrder: input.sortOrder,
      })
      return input
    },
  )
  .handler(async ({ data }) => {
    return envService.createEnvironment(data.projectId, {
      name: data.name,
      sortOrder: data.sortOrder,
    })
  })

export const deleteEnvironmentFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((input: { envId: string }) => input)
  .handler(async ({ data }) => {
    await envService.deleteEnvironment(data.envId)
    return { success: true }
  })

export const reorderEnvironmentsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (input: { projectId: string; orderedIds: string[] }) => input,
  )
  .handler(async ({ data }) => {
    await envService.reorderEnvironments(data.projectId, data.orderedIds)
    return { success: true }
  })
