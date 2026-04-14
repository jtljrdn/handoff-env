import { z } from 'zod'

export const variableKeySchema = z
  .string()
  .min(1)
  .max(256)
  .regex(
    /^[A-Z_][A-Z0-9_]*$/,
    'Variable key must be uppercase letters, digits, and underscores, starting with a letter or underscore',
  )

export const variableValueSchema = z.string().max(65_536)

export const createVariableSchema = z.object({
  key: variableKeySchema,
  value: variableValueSchema,
})
export type CreateVariableInput = z.infer<typeof createVariableSchema>

export const bulkUpsertVariablesSchema = z.array(
  z.object({
    key: variableKeySchema,
    value: variableValueSchema,
  }),
)
export type BulkUpsertVariablesInput = z.infer<typeof bulkUpsertVariablesSchema>
