import { z } from 'zod'

export const projectSlugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Slug must be lowercase alphanumeric with hyphens, starting and ending with a letter or number',
  )

export const projectNameSchema = z.string().min(1).max(100)

export const createProjectSchema = z.object({
  name: projectNameSchema,
  slug: projectSlugSchema,
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z.object({
  name: projectNameSchema.optional(),
  slug: projectSlugSchema.optional(),
})
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
