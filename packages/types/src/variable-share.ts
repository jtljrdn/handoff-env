import { z } from 'zod'

const base64Schema = z.string().min(1)

export const variableShareLabelSchema = z.string().min(1).max(255)

export const variableShareTtlSecondsSchema = z
  .number()
  .int()
  .min(60)
  .max(60 * 60 * 24 * 30)

export const variableShareMaxViewsSchema = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .nullable()

export const createVariableShareSchema = z.object({
  environmentId: z.string().min(1),
  variableId: z.string().min(1).optional(),
  label: variableShareLabelSchema,
  pwSalt: base64Schema,
  kdfOpsLimit: z.number().int().positive(),
  kdfMemLimit: z.number().int().positive(),
  wrapCiphertext: base64Schema,
  wrapNonce: base64Schema,
  ciphertext: base64Schema,
  nonce: base64Schema,
  ttlSeconds: variableShareTtlSecondsSchema,
  maxViews: variableShareMaxViewsSchema,
})
export type CreateVariableShareInput = z.infer<typeof createVariableShareSchema>

export const cliCreateVariableShareSchema = z.object({
  projectSlug: z.string().min(1),
  envName: z.string().min(1),
  key: z.string().min(1),
  pwSalt: base64Schema,
  kdfOpsLimit: z.number().int().positive(),
  kdfMemLimit: z.number().int().positive(),
  wrapCiphertext: base64Schema,
  wrapNonce: base64Schema,
  ciphertext: base64Schema,
  nonce: base64Schema,
  ttlSeconds: variableShareTtlSecondsSchema,
  maxViews: variableShareMaxViewsSchema,
})
export type CliCreateVariableShareInput = z.infer<
  typeof cliCreateVariableShareSchema
>

export interface VariableShareRow {
  id: string
  label: string
  environment_id: string
  variable_id: string | null
  max_views: number | null
  view_count: number
  expires_at: string
  revoked_at: string | null
  created_at: string
  created_by_user_id: string
}

export interface ShareConsumePayload {
  id: string
  label: string
  pwSalt: string
  kdfOpsLimit: number
  kdfMemLimit: number
  wrapCiphertext: string
  wrapNonce: string
  ciphertext: string
  nonce: string
  expiresAt: string
  viewsLeft: number | null
}
