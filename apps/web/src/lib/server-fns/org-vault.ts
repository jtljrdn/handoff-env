import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { auth } from '#/lib/auth'
import { pool } from '#/db/pool'
import { logger, errCtx } from '#/lib/logger'
import { recordAudit } from '#/lib/services/audit'

const log = logger.child({ scope: 'org-vault' })

function bufToBase64(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (typeof value === 'string') return value
  throw new Error(`Cannot encode ${typeof value} as base64`)
}

async function requireSessionUser() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

async function assertMembership(userId: string, orgId: string): Promise<string> {
  const r = await pool.query(
    'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
    [userId, orgId],
  )
  if (r.rows.length === 0) throw new Error('Not a member of this organization')
  return r.rows[0].role as string
}

async function assertAdminRole(userId: string, orgId: string): Promise<string> {
  const role = await assertMembership(userId, orgId)
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Admin or owner role required')
  }
  return role
}

const initOrgDekSchema = z.object({
  orgId: z.string().min(1),
  founderWrappedDek: z.string().min(1),
})

export const initOrgDekFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => initOrgDekSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    await assertMembership(user.id, data.orgId)

    const existing = await pool.query(
      `SELECT id FROM organization_dek
        WHERE org_id = $1 AND version = 1 LIMIT 1`,
      [data.orgId],
    )
    if (existing.rows[0]) {
      log.info('org_dek.init.skip_exists', {
        orgId: data.orgId,
        userId: user.id,
      })
      return { ok: true as const, alreadyInitialized: true }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const dekId = nanoid()
      await client.query(
        `INSERT INTO organization_dek (id, org_id, version, created_by_user_id)
         VALUES ($1, $2, 1, $3)`,
        [dekId, data.orgId, user.id],
      )
      await client.query(
        `INSERT INTO member_dek_wrap
           (id, org_id, user_id, dek_version, wrapped_dek, wrapped_by_user_id)
         VALUES ($1, $2, $3, 1, decode($4,'base64'), $3)
         ON CONFLICT (org_id, user_id, dek_version) DO NOTHING`,
        [nanoid(), data.orgId, user.id, data.founderWrappedDek],
      )
      await client.query('COMMIT')
      log.info('org_dek.init', { orgId: data.orgId, userId: user.id })
      return { ok: true as const, alreadyInitialized: false }
    } catch (err) {
      await client.query('ROLLBACK')
      log.error(
        'org_dek.init_failed',
        errCtx(err, { orgId: data.orgId, userId: user.id }),
      )
      throw err
    } finally {
      client.release()
    }
  })

export interface MyWrappedDek {
  dekVersion: number
  wrappedDek: string
}

const getMyWrappedDekSchema = z.object({ orgId: z.string().min(1) })

export const getMyWrappedDekFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => getMyWrappedDekSchema.parse(input))
  .handler(async ({ data }): Promise<MyWrappedDek | null> => {
    const user = await requireSessionUser()
    await assertMembership(user.id, data.orgId)

    const r = await pool.query(
      `SELECT mdw.dek_version, mdw.wrapped_dek
         FROM member_dek_wrap mdw
         JOIN organization_dek od
           ON od.org_id = mdw.org_id AND od.version = mdw.dek_version
        WHERE mdw.org_id = $1 AND mdw.user_id = $2
          AND od.retired_at IS NULL
        ORDER BY mdw.dek_version DESC
        LIMIT 1`,
      [data.orgId, user.id],
    )
    const row = r.rows[0]
    if (!row) return null
    return {
      dekVersion: Number(row.dek_version),
      wrappedDek: bufToBase64(row.wrapped_dek),
    }
  })

export interface PendingWrap {
  orgId: string
  targetUserId: string
  targetUserPublicKey: string
}

export const listPendingWrapsForUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PendingWrap[]> => {
    const user = await requireSessionUser()

    const r = await pool.query(
      `SELECT pmw.org_id, pmw.user_id AS target_user_id, uv.public_key
         FROM pending_member_wrap pmw
         JOIN member m ON m."organizationId" = pmw.org_id AND m."userId" = $1
         JOIN user_vault uv ON uv.user_id = pmw.user_id
        ORDER BY pmw.created_at ASC
        LIMIT 100`,
      [user.id],
    )

    return r.rows.map((row) => ({
      orgId: row.org_id,
      targetUserId: row.target_user_id,
      targetUserPublicKey: bufToBase64(row.public_key),
    }))
  },
)

const applyMemberWrapSchema = z.object({
  orgId: z.string().min(1),
  targetUserId: z.string().min(1),
  dekVersion: z.number().int().positive(),
  sealedDek: z.string().min(1),
})

export const applyMemberWrapFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => applyMemberWrapSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    await assertMembership(user.id, data.orgId)

    const targetMembership = await pool.query(
      'SELECT 1 FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
      [data.targetUserId, data.orgId],
    )
    if (targetMembership.rows.length === 0) {
      throw new Error('Target user is not a member of this organization')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO member_dek_wrap
           (id, org_id, user_id, dek_version, wrapped_dek, wrapped_by_user_id)
         VALUES ($1, $2, $3, $4, decode($5,'base64'), $6)
         ON CONFLICT (org_id, user_id, dek_version)
         DO UPDATE SET wrapped_dek = EXCLUDED.wrapped_dek,
                       wrapped_at = now(),
                       wrapped_by_user_id = EXCLUDED.wrapped_by_user_id`,
        [
          nanoid(),
          data.orgId,
          data.targetUserId,
          data.dekVersion,
          data.sealedDek,
          user.id,
        ],
      )
      await client.query(
        `DELETE FROM pending_member_wrap
          WHERE org_id = $1 AND user_id = $2`,
        [data.orgId, data.targetUserId],
      )
      await client.query('COMMIT')
      log.info('member_wrap.applied', {
        orgId: data.orgId,
        targetUserId: data.targetUserId,
        dekVersion: data.dekVersion,
        wrappedByUserId: user.id,
      })
      return { ok: true as const }
    } catch (err) {
      await client.query('ROLLBACK')
      log.error(
        'member_wrap.apply_failed',
        errCtx(err, {
          orgId: data.orgId,
          targetUserId: data.targetUserId,
          userId: user.id,
        }),
      )
      throw err
    } finally {
      client.release()
    }
  })

export interface RotationMember {
  userId: string
  publicKey: string
}

export interface RotationStatus {
  pending: {
    version: number
    pendingAt: string
    reason: string | null
  } | null
  remainingMembers: RotationMember[]
}

const getRotationStatusSchema = z.object({ orgId: z.string().min(1) })

export const getRotationStatusFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => getRotationStatusSchema.parse(input))
  .handler(async ({ data }): Promise<RotationStatus> => {
    const user = await requireSessionUser()
    await assertAdminRole(user.id, data.orgId)

    const dekRes = await pool.query(
      `SELECT version, rotation_pending_at, rotation_reason
         FROM organization_dek
        WHERE org_id = $1
          AND retired_at IS NULL
          AND rotation_pending_at IS NOT NULL
        ORDER BY version DESC
        LIMIT 1`,
      [data.orgId],
    )
    const dekRow = dekRes.rows[0]
    if (!dekRow) return { pending: null, remainingMembers: [] }

    const memberRes = await pool.query(
      `SELECT m."userId" AS user_id, uv.public_key
         FROM member m
         JOIN user_vault uv ON uv.user_id = m."userId"
        WHERE m."organizationId" = $1`,
      [data.orgId],
    )

    return {
      pending: {
        version: Number(dekRow.version),
        pendingAt:
          dekRow.rotation_pending_at instanceof Date
            ? dekRow.rotation_pending_at.toISOString()
            : String(dekRow.rotation_pending_at),
        reason: dekRow.rotation_reason ?? null,
      },
      remainingMembers: memberRes.rows.map((row) => ({
        userId: row.user_id as string,
        publicKey: bufToBase64(row.public_key),
      })),
    }
  })

export interface RotationVariable {
  id: string
  key: string
  environmentId: string
  ciphertext: string
  nonce: string
  dekVersion: number
}

const getAllOrgVariablesForRotationSchema = z.object({
  orgId: z.string().min(1),
})

export const getAllOrgVariablesForRotationFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    getAllOrgVariablesForRotationSchema.parse(input),
  )
  .handler(async ({ data }): Promise<RotationVariable[]> => {
    const user = await requireSessionUser()
    await assertAdminRole(user.id, data.orgId)

    const r = await pool.query(
      `SELECT v.id, v.key, v.environment_id, v.ciphertext, v.nonce, v.dek_version
         FROM variables v
         JOIN environments e ON e.id = v.environment_id
         JOIN projects p ON p.id = e.project_id
        WHERE p.org_id = $1
        ORDER BY v.id`,
      [data.orgId],
    )
    return r.rows.map((row) => ({
      id: row.id as string,
      key: row.key as string,
      environmentId: row.environment_id as string,
      ciphertext: bufToBase64(row.ciphertext),
      nonce: bufToBase64(row.nonce),
      dekVersion: Number(row.dek_version),
    }))
  })

const completeDekRotationSchema = z.object({
  orgId: z.string().min(1),
  oldVersion: z.number().int().positive(),
  newWrapsPerMember: z
    .array(
      z.object({
        userId: z.string().min(1),
        sealedDek: z.string().min(1),
      }),
    )
    .min(1),
  reEncryptedVariables: z.array(
    z.object({
      id: z.string().min(1),
      ciphertext: z.string().min(1),
      nonce: z.string().min(1),
    }),
  ),
})

export const completeDekRotationFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => completeDekRotationSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    await assertAdminRole(user.id, data.orgId)

    const newVersion = data.oldVersion + 1

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const currentRes = await client.query(
        `SELECT version FROM organization_dek
          WHERE org_id = $1
            AND retired_at IS NULL
            AND rotation_pending_at IS NOT NULL
          FOR UPDATE`,
        [data.orgId],
      )
      const current = currentRes.rows[0]
      if (!current) {
        throw new Error('No rotation is pending for this organization')
      }
      if (Number(current.version) !== data.oldVersion) {
        throw new Error(
          `Rotation version mismatch: expected ${data.oldVersion}, found ${current.version}`,
        )
      }

      const variableIdsRes = await client.query(
        `SELECT v.id FROM variables v
           JOIN environments e ON e.id = v.environment_id
           JOIN projects p ON p.id = e.project_id
          WHERE p.org_id = $1
          FOR UPDATE OF v`,
        [data.orgId],
      )
      const orgVariableIds = new Set<string>(
        variableIdsRes.rows.map((row) => row.id as string),
      )

      const providedIds = new Set<string>(
        data.reEncryptedVariables.map((v) => v.id),
      )
      for (const id of providedIds) {
        if (!orgVariableIds.has(id)) {
          throw new Error(`Variable ${id} does not belong to this organization`)
        }
      }
      const missingIds: string[] = []
      for (const id of orgVariableIds) {
        if (!providedIds.has(id)) missingIds.push(id)
      }
      if (missingIds.length > 0) {
        throw new Error(
          `Rotation is missing ${missingIds.length} variable(s). Retry the rotation.`,
        )
      }

      const memberRes = await client.query(
        `SELECT "userId" FROM member WHERE "organizationId" = $1`,
        [data.orgId],
      )
      const orgMemberIds = new Set<string>(
        memberRes.rows.map((row) => row.userId as string),
      )
      for (const wrap of data.newWrapsPerMember) {
        if (!orgMemberIds.has(wrap.userId)) {
          throw new Error(
            `User ${wrap.userId} is not a current member of this organization`,
          )
        }
      }
      const missingMembers: string[] = []
      for (const userId of orgMemberIds) {
        if (!data.newWrapsPerMember.find((w) => w.userId === userId)) {
          missingMembers.push(userId)
        }
      }
      if (missingMembers.length > 0) {
        throw new Error(
          `Rotation is missing wraps for ${missingMembers.length} member(s). Retry the rotation.`,
        )
      }

      await client.query(
        `INSERT INTO organization_dek
           (id, org_id, version, created_by_user_id)
         VALUES ($1, $2, $3, $4)`,
        [nanoid(), data.orgId, newVersion, user.id],
      )

      for (const wrap of data.newWrapsPerMember) {
        await client.query(
          `INSERT INTO member_dek_wrap
             (id, org_id, user_id, dek_version, wrapped_dek, wrapped_by_user_id)
           VALUES ($1, $2, $3, $4, decode($5,'base64'), $6)`,
          [
            nanoid(),
            data.orgId,
            wrap.userId,
            newVersion,
            wrap.sealedDek,
            user.id,
          ],
        )
      }

      if (data.reEncryptedVariables.length > 0) {
        const ids = data.reEncryptedVariables.map((v) => v.id)
        const ciphertexts = data.reEncryptedVariables.map((v) => v.ciphertext)
        const nonces = data.reEncryptedVariables.map((v) => v.nonce)
        await client.query(
          `UPDATE variables v
              SET ciphertext = decode(d.ciphertext, 'base64'),
                  nonce = decode(d.nonce, 'base64'),
                  dek_version = $4,
                  updated_at = now()
             FROM unnest($1::TEXT[], $2::TEXT[], $3::TEXT[])
               AS d(id, ciphertext, nonce)
            WHERE v.id = d.id`,
          [ids, ciphertexts, nonces, newVersion],
        )
      }

      await client.query(
        `UPDATE organization_dek
            SET retired_at = now(),
                rotation_pending_at = NULL
          WHERE org_id = $1 AND version = $2`,
        [data.orgId, data.oldVersion],
      )

      const tokenUpd = await client.query(
        `UPDATE api_tokens
            SET wrapped_dek = NULL, dek_version = NULL
          WHERE org_id = $1 AND wrapped_dek IS NOT NULL`,
        [data.orgId],
      )

      await client.query('COMMIT')

      log.info('dek.rotation.complete', {
        orgId: data.orgId,
        oldVersion: data.oldVersion,
        newVersion,
        variableCount: data.reEncryptedVariables.length,
        memberCount: data.newWrapsPerMember.length,
        tokensInvalidated: tokenUpd.rowCount ?? 0,
        actorUserId: user.id,
      })

      void recordAudit({
        orgId: data.orgId,
        actorUserId: user.id,
        action: 'dek.rotation_complete',
        metadata: {
          oldVersion: data.oldVersion,
          newVersion,
          variableCount: data.reEncryptedVariables.length,
          memberCount: data.newWrapsPerMember.length,
          tokensInvalidated: tokenUpd.rowCount ?? 0,
        },
      })

      return {
        ok: true as const,
        newVersion,
        variableCount: data.reEncryptedVariables.length,
        memberCount: data.newWrapsPerMember.length,
        tokensInvalidated: tokenUpd.rowCount ?? 0,
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      log.error(
        'dek.rotation.failed',
        errCtx(err, {
          orgId: data.orgId,
          oldVersion: data.oldVersion,
          actorUserId: user.id,
        }),
      )
      throw err
    } finally {
      client.release()
    }
  })

const isMemberPendingWrapSchema = z.object({ orgId: z.string().min(1) })

export const isMemberPendingWrapFn = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => isMemberPendingWrapSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSessionUser()
    const r = await pool.query(
      `SELECT 1 FROM pending_member_wrap
        WHERE org_id = $1 AND user_id = $2 LIMIT 1`,
      [data.orgId, user.id],
    )
    return { pending: r.rows.length > 0 }
  })
