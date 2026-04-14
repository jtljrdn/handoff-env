import { randomBytes, createHash } from 'node:crypto'
import { db } from '#/db'
import { apiTokens } from '#/db/schema'
import { eq, and } from 'drizzle-orm'
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
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const [row] = await db
    .insert(apiTokens)
    .values({
      userId,
      orgId,
      name: input.name,
      hashedToken: hashed,
      prefix,
      expiresAt,
    })
    .returning()

  return { token: plaintext, id: row.id, prefix }
}

export async function listApiTokens(userId: string, orgId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), eq(apiTokens.orgId, orgId)))
    .orderBy(apiTokens.createdAt)
}

export async function revokeApiToken(tokenId: string, userId: string) {
  const result = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning()

  return result.length > 0
}
