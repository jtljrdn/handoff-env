import { z } from 'zod'

export const envNameSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Environment name must be lowercase alphanumeric with hyphens',
  )

export const createEnvironmentSchema = z.object({
  name: envNameSchema,
  sortOrder: z.number().int().min(0).optional(),
})
export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>

export const DEFAULT_ENVIRONMENTS = [
  'development',
  'staging',
  'production',
] as const
