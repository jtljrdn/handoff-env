import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { auth } from '#/lib/auth'
import { pool } from '#/db/pool'
import { logger, errCtx } from '#/lib/logger'

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
