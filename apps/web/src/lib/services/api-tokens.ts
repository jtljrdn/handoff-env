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

export interface CreatedTokenRecord {
  id: string
  prefix: string
}

export async function createApiToken(
  userId: string,
  orgId: string,
  input: CreateApiTokenInput,
): Promise<CreatedTokenRecord> {
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const id = nanoid()
  try {
    await pool.query(
      `INSERT INTO api_tokens (
         id, user_id, org_id, name,
         hashed_token, prefix,
         token_public_key, wrapped_dek, dek_version,
         expires_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6,
         decode($7,'base64'), decode($8,'base64'), $9,
         $10
       )`,
      [
        id,
        userId,
        orgId,
        input.name,
        input.hashedToken,
        input.prefix,
        input.tokenPublicKey,
        input.wrappedDek,
        input.dekVersion,
        expiresAt,
      ],
    )
  } catch (err) {
    log.error(
      'createApiToken.failed',
      errCtx(err, { userId, orgId, name: input.name }),
    )
    throw err
  }

  log.info('createApiToken.ok', {
    userId,
    orgId,
    tokenId: id,
    prefix: input.prefix,
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

  return { id, prefix: input.prefix }
}

export async function listApiTokens(userId: string, orgId: string) {
  const r = await pool.query(
    `SELECT id, name, prefix, last_used_at, expires_at, created_at
       FROM api_tokens
      WHERE user_id = $1 AND org_id = $2
      ORDER BY created_at`,
    [userId, orgId],
  )
  return r.rows as ApiTokenRow[]
}

export async function listOrgApiTokens(orgId: string): Promise<OrgApiTokenRow[]> {
  const r = await pool.query(
    `SELECT t.id, t.user_id, t.name, t.prefix, t.last_used_at, t.expires_at, t.created_at,
            u.name AS creator_name, u.email AS creator_email
       FROM api_tokens t
       LEFT JOIN "user" u ON u.id = t.user_id
      WHERE t.org_id = $1
      ORDER BY t.created_at DESC`,
    [orgId],
  )
  return r.rows.map((row) => ({
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
  const r = await pool.query(
    `DELETE FROM api_tokens
      WHERE id = $1 AND org_id = $2
      RETURNING id, org_id, user_id, name`,
    [tokenId, orgId],
  )

  const revoked = r.rows[0]
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
    return true
  }
  log.info('revokeAnyApiToken.noop', { tokenId, orgId, actorUserId })
  return false
}

export async function revokeApiToken(tokenId: string, userId: string) {
  const r = await pool.query(
    `DELETE FROM api_tokens
      WHERE id = $1 AND user_id = $2
      RETURNING id, org_id, name`,
    [tokenId, userId],
  )

  const revoked = r.rows[0]
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
    return true
  }
  log.info('revokeApiToken.noop', { tokenId, userId })
  return false
}

export async function getTokenWrapByHash(
  hashedToken: string,
): Promise<{
  id: string
  userId: string
  orgId: string
  tokenPublicKey: string | null
  wrappedDek: string | null
  dekVersion: number | null
} | null> {
  const r = await pool.query(
    `SELECT id, user_id, org_id, token_public_key, wrapped_dek, dek_version
       FROM api_tokens
      WHERE hashed_token = $1
      LIMIT 1`,
    [hashedToken],
  )
  const row = r.rows[0]
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    tokenPublicKey: row.token_public_key
      ? Buffer.from(row.token_public_key).toString('base64')
      : null,
    wrappedDek: row.wrapped_dek
      ? Buffer.from(row.wrapped_dek).toString('base64')
      : null,
    dekVersion: row.dek_version === null ? null : Number(row.dek_version),
  }
}
