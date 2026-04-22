import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createProjectSchema, updateProjectSchema } from '@handoff-env/types'
import { requireOrgSession, requirePermission } from '#/lib/middleware/auth'
import * as projectService from '#/lib/services/projects'

export const listProjectsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireOrgSession()
    return projectService.listProjects(user.orgId)
  })

export const getProjectByIdFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { projectId: string }) => {
    z.object({ projectId: z.string().min(1) }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    return projectService.verifyProjectOrg(data.projectId, user.orgId)
  })

export const getProjectFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { projectSlug: string }) => {
    z.object({ projectSlug: z.string().min(1) }).parse(input)
    return input
  })
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
    return projectService.createProject(
      user.orgId,
      { name: data.name, slug: data.slug },
      user.userId,
    )
  })

export const updateProjectFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      projectId: string
      name?: string
      slug?: string
    }) => {
      z.object({ projectId: z.string().min(1) }).parse(input)
      updateProjectSchema.parse({ name: input.name, slug: input.slug })
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requirePermission('project', 'update')
    await projectService.verifyProjectOrg(data.projectId, user.orgId)
    return projectService.updateProject(data.projectId, user.orgId, {
      name: data.name,
      slug: data.slug,
    })
  })

export const deleteProjectFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { projectId: string }) => {
    z.object({ projectId: z.string().min(1) }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('project', 'delete')
    await projectService.verifyProjectOrg(data.projectId, user.orgId)
    await projectService.deleteProject(data.projectId, user.orgId)
    return { success: true }
  })
