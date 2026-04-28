import { z } from 'zod'

export const apiTokenNameSchema = z.string().min(1).max(100)

export const createApiTokenSchema = z.object({
  name: apiTokenNameSchema,
  expiresInDays: z.number().int().min(1).max(365).optional(),
  hashedToken: z.string().min(1),
  prefix: z.string().min(1).max(64),
  tokenPublicKey: z.string().min(1),
  wrappedDek: z.string().min(1),
  dekVersion: z.number().int().positive(),
})
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
