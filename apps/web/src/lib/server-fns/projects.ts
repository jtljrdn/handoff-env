import { createServerFn } from '@tanstack/react-start'
import { createProjectSchema, updateProjectSchema } from '@handoff-env/types'
import { requireOrgSession } from '#/lib/middleware/auth'
import * as projectService from '#/lib/services/projects'

export const listProjectsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireOrgSession()
    return projectService.listProjects(user.orgId)
  })

export const getProjectByIdFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    return projectService.verifyProjectOrg(data.projectId, user.orgId)
  })

export const getProjectFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { projectSlug: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    return projectService.getProject(user.orgId, data.projectSlug)
  })

export const createProjectFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { name: string; slug: string }) => {
      createProjectSchema.parse({ name: input.name, slug: input.slug })
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    return projectService.createProject(user.orgId, {
      name: data.name,
      slug: data.slug,
    })
  })

export const updateProjectFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      projectId: string
      name?: string
      slug?: string
    }) => {
      updateProjectSchema.parse({ name: input.name, slug: input.slug })
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    await projectService.verifyProjectOrg(data.projectId, user.orgId)
    return projectService.updateProject(data.projectId, user.orgId, {
      name: data.name,
      slug: data.slug,
    })
  })

export const deleteProjectFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    await projectService.verifyProjectOrg(data.projectId, user.orgId)
    await projectService.deleteProject(data.projectId)
    return { success: true }
  })
