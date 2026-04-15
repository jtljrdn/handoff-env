import { randomBytes, createHash } from 'node:crypto'
import { supabase } from '#/db'
import { nanoid } from 'nanoid'
import type { CreateApiTokenInput } from '@handoff-env/types'

const TOKEN_PREFIX = 'hnd_'
const TOKEN_RANDOM_BYTES = 30

function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(TOKEN_RANDOM_BYTES).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createApiToken(
  userId: string,
  orgId: string,
  input: CreateApiTokenInput,
): Promise<{ token: string; id: string; prefix: string }> {
  const plaintext = generateToken()
  const hashed = hashToken(plaintext)
  const prefix = plaintext.slice(0, 12)

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { data: row, error } = await supabase
    .from('api_tokens')
    .insert({
      id: nanoid(),
      user_id: userId,
      org_id: orgId,
      name: input.name,
      hashed_token: hashed,
      prefix,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) throw error

  return { token: plaintext, id: row.id, prefix }
}

export async function listApiTokens(userId: string, orgId: string) {
  const { data, error } = await supabase
    .from('api_tokens')
    .select('id, name, prefix, last_used_at, expires_at, created_at')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .order('created_at')

  if (error) throw error

  return data ?? []
}

export async function revokeApiToken(tokenId: string, userId: string) {
  const { data, error } = await supabase
    .from('api_tokens')
    .delete()
    .eq('id', tokenId)
    .eq('user_id', userId)
    .select()

  if (error) throw error

  return (data?.length ?? 0) > 0
}
