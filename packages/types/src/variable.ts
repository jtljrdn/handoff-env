import { z } from 'zod'

export const variableKeySchema = z
  .string()
  .min(1)
  .max(256)
  .regex(
    /^[A-Z_][A-Z0-9_]*$/,
    'Variable key must be uppercase letters, digits, and underscores, starting with a letter or underscore',
  )

// Plaintext values never leave the browser or CLI in zero-knowledge mode.
// This schema is kept only for client-side validation before encryption.
export const variableValueSchema = z.string().max(65_536)

// Wire shape: opaque ciphertext + nonce, both base64. dek_version identifies
// which org DEK was used to encrypt, so the client knows which wrap to open.
export const variableCiphertextSchema = z.object({
  ciphertext: z.string().min(1),
  nonce: z.string().min(1),
  dekVersion: z.number().int().positive(),
})
export type VariableCiphertext = z.infer<typeof variableCiphertextSchema>

export const createEncryptedVariableSchema = variableCiphertextSchema.extend({
  key: variableKeySchema,
})
export type CreateEncryptedVariableInput = z.infer<
  typeof createEncryptedVariableSchema
>

export const bulkUpsertEncryptedVariablesSchema = z.array(
  createEncryptedVariableSchema,
)
export type BulkUpsertEncryptedVariablesInput = z.infer<
  typeof bulkUpsertEncryptedVariablesSchema
>
