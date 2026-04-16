import { createServerFn } from '@tanstack/react-start'
import { createEnvironmentSchema } from '@handoff-env/types'
import { requireOrgSession } from '#/lib/middleware/auth'
import * as projectService from '#/lib/services/projects'
import * as envService from '#/lib/services/environments'

export const listEnvironmentsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    await projectService.verifyProjectOrg(data.projectId, user.orgId)
    return envService.listEnvironments(data.projectId)
  })

export const createEnvironmentFn = createServerFn({ method: 'POST' })
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
    const user = await requireOrgSession()
    await projectService.verifyProjectOrg(data.projectId, user.orgId)
    return envService.createEnvironment(data.projectId, {
      name: data.name,
      sortOrder: data.sortOrder,
    })
  })

export const deleteEnvironmentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { envId: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    await envService.verifyEnvironmentOrg(data.envId, user.orgId)
    await envService.deleteEnvironment(data.envId)
    return { success: true }
  })

export const reorderEnvironmentsFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { projectId: string; orderedIds: string[] }) => input,
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    await projectService.verifyProjectOrg(data.projectId, user.orgId)
    await envService.reorderEnvironments(data.projectId, data.orderedIds)
    return { success: true }
  })
