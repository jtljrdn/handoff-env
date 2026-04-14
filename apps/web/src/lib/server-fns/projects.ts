import { createServerFn } from '@tanstack/react-start'
import { createProjectSchema, updateProjectSchema } from '@handoff-env/types'
import { authMiddleware } from '#/lib/middleware/auth'
import * as projectService from '#/lib/services/projects'

export const listProjectsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((input: { orgId: string }) => input)
  .handler(async ({ data }) => {
    return projectService.listProjects(data.orgId)
  })

export const getProjectFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((input: { orgId: string; projectSlug: string }) => input)
  .handler(async ({ data }) => {
    return projectService.getProject(data.orgId, data.projectSlug)
  })

export const createProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (input: { orgId: string; name: string; slug: string }) => {
      createProjectSchema.parse({ name: input.name, slug: input.slug })
      return input
    },
  )
  .handler(async ({ data }) => {
    return projectService.createProject(data.orgId, {
      name: data.name,
      slug: data.slug,
    })
  })

export const updateProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      projectId: string
      orgId: string
      name?: string
      slug?: string
    }) => {
      updateProjectSchema.parse({ name: input.name, slug: input.slug })
      return input
    },
  )
  .handler(async ({ data }) => {
    return projectService.updateProject(data.projectId, data.orgId, {
      name: data.name,
      slug: data.slug,
    })
  })

export const deleteProjectFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data }) => {
    await projectService.deleteProject(data.projectId)
    return { success: true }
  })
