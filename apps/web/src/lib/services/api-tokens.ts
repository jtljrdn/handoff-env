import { randomBytes, createHash } from 'node:crypto'
import { supabase } from '#/db'
import { pool } from '#/db/pool'
import { nanoid } from 'nanoid'
import { recordAudit } from '#/lib/services/audit'
import { logger, errCtx } from '#/lib/logger'
import type { CreateApiTokenInput } from '@handoff-env/types'

const log = logger.child({ scope: 'service.api_tokens' })

export interface ApiTokenRow {
  id: string
  name: string
  prefix: string
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export interface OrgApiTokenRow extends ApiTokenRow {
  user_id: string
  creator_name: string | null
  creator_email: string | null
}

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

  if (error) {
    log.error(
      'createApiToken.failed',
      errCtx(error, { userId, orgId, name: input.name }),
    )
    throw error
  }

  log.info('createApiToken.ok', {
    userId,
    orgId,
    tokenId: row.id,
    prefix,
    name: input.name,
    expiresAt,
  })

  void recordAudit({
    orgId,
    actorUserId: userId,
    action: 'token.create',
    targetKey: input.name,
    metadata: { expiresAt },
  })

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

export async function listOrgApiTokens(orgId: string): Promise<OrgApiTokenRow[]> {
  const result = await pool.query(
    `SELECT t.id, t.user_id, t.name, t.prefix, t.last_used_at, t.expires_at, t.created_at,
            u.name AS creator_name, u.email AS creator_email
       FROM api_tokens t
       LEFT JOIN "user" u ON u.id = t.user_id
      WHERE t.org_id = $1
      ORDER BY t.created_at DESC`,
    [orgId],
  )
  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    prefix: row.prefix,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
    creator_name: row.creator_name ?? null,
    creator_email: row.creator_email ?? null,
  }))
}

export async function revokeAnyApiToken(
  tokenId: string,
  orgId: string,
  actorUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('api_tokens')
    .delete()
    .eq('id', tokenId)
    .eq('org_id', orgId)
    .select()

  if (error) {
    log.error(
      'revokeAnyApiToken.failed',
      errCtx(error, { tokenId, orgId, actorUserId }),
    )
    throw error
  }

  const revoked = data?.[0]
  if (revoked) {
    log.info('revokeAnyApiToken.ok', {
      tokenId,
      orgId: revoked.org_id,
      actorUserId,
      ownerUserId: revoked.user_id,
    })
    void recordAudit({
      orgId: revoked.org_id,
      actorUserId,
      action: 'token.revoke',
      targetKey: revoked.name,
    })
  } else {
    log.info('revokeAnyApiToken.noop', { tokenId, orgId, actorUserId })
  }

  return (data?.length ?? 0) > 0
}

export async function revokeApiToken(tokenId: string, userId: string) {
  const { data, error } = await supabase
    .from('api_tokens')
    .delete()
    .eq('id', tokenId)
    .eq('user_id', userId)
    .select()

  if (error) {
    log.error(
      'revokeApiToken.failed',
      errCtx(error, { tokenId, userId }),
    )
    throw error
  }

  const revoked = data?.[0]
  if (revoked) {
    log.info('revokeApiToken.ok', {
      tokenId,
      userId,
      orgId: revoked.org_id,
    })
    void recordAudit({
      orgId: revoked.org_id,
      actorUserId: userId,
      action: 'token.revoke',
      targetKey: revoked.name,
    })
  } else {
    log.info('revokeApiToken.noop', { tokenId, userId })
  }

  return (data?.length ?? 0) > 0
}
