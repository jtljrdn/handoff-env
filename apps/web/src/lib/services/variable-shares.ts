import { pool } from '#/db/pool'
import { nanoid } from 'nanoid'
import { recordAudit } from '#/lib/services/audit'
import { logger, errCtx } from '#/lib/logger'
import type {
  CreateVariableShareInput,
  ShareConsumePayload,
  VariableShareRow,
} from '@handoff-env/types'

const log = logger.child({ scope: 'service.variable_shares' })

function bytesToBase64(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) {
      return Buffer.from(value.slice(2), 'hex').toString('base64')
    }
    return value
  }
  throw new Error(`Cannot encode ${typeof value} as base64`)
}

function isoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export interface CreatedShareRecord {
  id: string
  expiresAt: string
}

export async function createVariableShare(
  userId: string,
  orgId: string,
  input: CreateVariableShareInput,
  projectId: string,
): Promise<CreatedShareRecord> {
  const id = nanoid()
  const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000).toISOString()

  try {
    await pool.query(
      `INSERT INTO variable_shares (
         id, org_id, environment_id, variable_id, label,
         pw_salt, kdf_ops_limit, kdf_mem_limit,
         wrap_ciphertext, wrap_nonce, ciphertext, nonce,
         max_views, expires_at, created_by_user_id
       ) VALUES (
         $1, $2, $3, $4, $5,
         decode($6,'base64'), $7, $8,
         decode($9,'base64'), decode($10,'base64'),
         decode($11,'base64'), decode($12,'base64'),
         $13, $14, $15
       )`,
      [
        id,
        orgId,
        input.environmentId,
        input.variableId ?? null,
        input.label,
        input.pwSalt,
        input.kdfOpsLimit,
        input.kdfMemLimit,
        input.wrapCiphertext,
        input.wrapNonce,
        input.ciphertext,
        input.nonce,
        input.maxViews,
        expiresAt,
        userId,
      ],
    )
  } catch (err) {
    log.error(
      'createVariableShare.failed',
      errCtx(err, { userId, orgId, environmentId: input.environmentId }),
    )
    throw err
  }

  log.info('createVariableShare.ok', {
    userId,
    orgId,
    shareId: id,
    label: input.label,
    expiresAt,
    maxViews: input.maxViews,
  })

  void recordAudit({
    orgId,
    actorUserId: userId,
    action: 'variable.share.create',
    projectId,
    environmentId: input.environmentId,
    targetKey: input.label,
    metadata: {
      shareId: id,
      expiresAt,
      maxViews: input.maxViews,
    },
  })

  return { id, expiresAt }
}

export async function listVariableShares(
  environmentId: string,
): Promise<VariableShareRow[]> {
  const r = await pool.query(
    `SELECT id, label, environment_id, variable_id,
            max_views, view_count, expires_at, revoked_at,
            created_at, created_by_user_id
       FROM variable_shares
      WHERE environment_id = $1
        AND revoked_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC`,
    [environmentId],
  )
  return r.rows.map((row) => ({
    id: row.id,
    label: row.label,
    environment_id: row.environment_id,
    variable_id: row.variable_id ?? null,
    max_views: row.max_views ?? null,
    view_count: Number(row.view_count),
    expires_at: isoString(row.expires_at),
    revoked_at: row.revoked_at ? isoString(row.revoked_at) : null,
    created_at: isoString(row.created_at),
    created_by_user_id: row.created_by_user_id,
  }))
}

export async function revokeVariableShare(
  shareId: string,
  orgId: string,
  actorUserId: string,
): Promise<{ ok: boolean; environmentId?: string; label?: string }> {
  const r = await pool.query(
    `UPDATE variable_shares
        SET revoked_at = now()
      WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL
      RETURNING id, environment_id, label`,
    [shareId, orgId],
  )
  const row = r.rows[0]
  if (!row) {
    log.info('revokeVariableShare.noop', { shareId, orgId, actorUserId })
    return { ok: false }
  }

  log.info('revokeVariableShare.ok', {
    shareId,
    orgId,
    actorUserId,
    label: row.label,
  })

  void recordAudit({
    orgId,
    actorUserId,
    action: 'variable.share.revoke',
    environmentId: row.environment_id,
    targetKey: row.label,
    metadata: { shareId },
  })

  return { ok: true, environmentId: row.environment_id, label: row.label }
}

export type ConsumeShareError = 'NOT_FOUND' | 'EXPIRED' | 'EXHAUSTED' | 'REVOKED'

export interface ConsumeShareSuccess {
  ok: true
  payload: ShareConsumePayload
  orgId: string
  environmentId: string
  createdByUserId: string
}

export interface ConsumeShareFailure {
  ok: false
  error: ConsumeShareError
}

export async function consumeVariableShareView(
  shareId: string,
): Promise<ConsumeShareSuccess | ConsumeShareFailure> {
  try {
    const r = await pool.query(
      `SELECT * FROM consume_share_view($1)`,
      [shareId],
    )
    const row = r.rows[0]
    if (!row) {
      return { ok: false, error: 'NOT_FOUND' }
    }
    const payload: ShareConsumePayload = {
      id: row.id,
      label: row.label,
      pwSalt: bytesToBase64(row.pw_salt),
      kdfOpsLimit: Number(row.kdf_ops_limit),
      kdfMemLimit: Number(row.kdf_mem_limit),
      wrapCiphertext: bytesToBase64(row.wrap_ciphertext),
      wrapNonce: bytesToBase64(row.wrap_nonce),
      ciphertext: bytesToBase64(row.ciphertext),
      nonce: bytesToBase64(row.nonce),
      expiresAt: isoString(row.expires_at),
      viewsLeft:
        row.max_views === null
          ? null
          : Math.max(0, Number(row.max_views) - Number(row.view_count)),
    }
    return {
      ok: true,
      payload,
      orgId: row.org_id,
      environmentId: row.environment_id,
      createdByUserId: row.created_by_user_id,
    }
  } catch (err) {
    const message = (err as { message?: string }).message ?? ''
    if (
      message === 'NOT_FOUND' ||
      message === 'EXPIRED' ||
      message === 'EXHAUSTED' ||
      message === 'REVOKED'
    ) {
      return { ok: false, error: message as ConsumeShareError }
    }
    log.error('consumeVariableShareView.failed', errCtx(err, { shareId }))
    throw err
  }
}
