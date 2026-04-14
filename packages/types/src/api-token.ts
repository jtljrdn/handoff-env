import { z } from 'zod'

export const apiTokenNameSchema = z.string().min(1).max(100)

export const createApiTokenSchema = z.object({
  name: apiTokenNameSchema,
  expiresInDays: z.number().int().min(1).max(365).optional(),
})
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
