import { randomUUID } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { pool } from '#/db/pool'
import { requirePlatformAdmin } from '#/lib/middleware/auth'
import { sendInviteEmail } from '#/lib/email/send-invite'
import { logger, errCtx } from '#/lib/logger'

const log = logger.child({ scope: 'admin' })

const INVITE_TTL_DAYS = 30
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SignupRequestStatus = 'pending' | 'approved' | 'denied'

export interface SignupRequest {
  id: string
  email: string
  name: string | null
  reason: string | null
  status: SignupRequestStatus
  createdAt: string
  reviewedAt: string | null
  reviewedByUserId: string | null
}

export interface SignupInvite {
  id: string
  email: string
  invitedByUserId: string
  invitedByEmail: string | null
  note: string | null
  createdAt: string
  expiresAt: string
  usedAt: string | null
  usedByUserId: string | null
}

function normalizeEmail(input: string): string {
  return input.toLowerCase().trim()
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export const listSignupRequestsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { status?: SignupRequestStatus | 'all' }) => input)
  .handler(async ({ data }): Promise<SignupRequest[]> => {
    await requirePlatformAdmin()
    const status = data.status ?? 'pending'
    const params: unknown[] = []
    let where = ''
    if (status !== 'all') {
      where = 'WHERE status = $1'
      params.push(status)
    }
    const res = await pool.query(
      `SELECT id, email, name, reason, status, created_at,
              reviewed_at, reviewed_by_user_id
         FROM signup_request
         ${where}
         ORDER BY created_at DESC
         LIMIT 200`,
      params,
    )
    return res.rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      reason: r.reason,
      status: r.status,
      createdAt: isoOrNull(r.created_at) ?? '',
      reviewedAt: isoOrNull(r.reviewed_at),
      reviewedByUserId: r.reviewed_by_user_id,
    }))
  })

export const listSignupInvitesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SignupInvite[]> => {
    await requirePlatformAdmin()
    const res = await pool.query(
      `SELECT i.id, i.email, i.invited_by_user_id, i.note,
              i.created_at, i.expires_at, i.used_at, i.used_by_user_id,
              u.email AS invited_by_email
         FROM signup_invite i
         LEFT JOIN "user" u ON u.id = i.invited_by_user_id
         ORDER BY i.created_at DESC
         LIMIT 200`,
    )
    return res.rows.map((r) => ({
      id: r.id,
      email: r.email,
      invitedByUserId: r.invited_by_user_id,
      invitedByEmail: r.invited_by_email,
      note: r.note,
      createdAt: isoOrNull(r.created_at) ?? '',
      expiresAt: isoOrNull(r.expires_at) ?? '',
      usedAt: isoOrNull(r.used_at),
      usedByUserId: r.used_by_user_id,
    }))
  },
)

async function createInvite(args: {
  email: string
  invitedByUserId: string
  note: string | null
}): Promise<{ id: string; expiresAt: Date }> {
  const id = randomUUID()
  const token = randomUUID()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  await pool.query(
    `INSERT INTO signup_invite (id, email, token, invited_by_user_id, note, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE
       SET token = EXCLUDED.token,
           invited_by_user_id = EXCLUDED.invited_by_user_id,
           note = EXCLUDED.note,
           expires_at = EXCLUDED.expires_at,
           used_at = NULL,
           used_by_user_id = NULL,
           created_at = now()`,
    [id, args.email, token, args.invitedByUserId, args.note, expiresAt],
  )

  return { id, expiresAt }
}

export const createSignupInviteFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { email: string; note?: string }) => input)
  .handler(async ({ data }) => {
    const admin = await requirePlatformAdmin()
    const email = normalizeEmail(data.email)
    if (!EMAIL_RE.test(email)) {
      throw new Error('Invalid email')
    }
    const note = data.note?.trim().slice(0, 500) || null

    const { id, expiresAt } = await createInvite({
      email,
      invitedByUserId: admin.userId,
      note,
    })

    try {
      await sendInviteEmail({ email, expiresAt, note })
    } catch (err) {
      log.error('invite.email_failed', errCtx(err, { email, inviteId: id }))
    }

    log.info('invite.created', { email, inviteId: id, by: admin.userId })
    return { ok: true as const, inviteId: id }
  })

export const approveSignupRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const admin = await requirePlatformAdmin()
    const client = await pool.connect()
    let email = ''
    let note: string | null = null
    let expiresAt: Date | null = null
    try {
      await client.query('BEGIN')
      const reqRes = await client.query(
        `UPDATE signup_request
            SET status = 'approved',
                reviewed_at = now(),
                reviewed_by_user_id = $2
          WHERE id = $1 AND status = 'pending'
          RETURNING email, reason`,
        [data.requestId, admin.userId],
      )
      if (reqRes.rowCount === 0) {
        await client.query('ROLLBACK')
        throw new Error('Request not found or already reviewed')
      }
      email = normalizeEmail(reqRes.rows[0].email)
      note = reqRes.rows[0].reason
      const id = randomUUID()
      const token = randomUUID()
      expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
      await client.query(
        `INSERT INTO signup_invite (id, email, token, invited_by_user_id, note, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE
           SET token = EXCLUDED.token,
               invited_by_user_id = EXCLUDED.invited_by_user_id,
               note = EXCLUDED.note,
               expires_at = EXCLUDED.expires_at,
               used_at = NULL,
               used_by_user_id = NULL,
               created_at = now()`,
        [id, email, token, admin.userId, note, expiresAt],
      )
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      client.release()
      throw err
    }
    client.release()

    if (expiresAt) {
      try {
        await sendInviteEmail({ email, expiresAt, note })
      } catch (err) {
        log.error(
          'approve.email_failed',
          errCtx(err, { email, requestId: data.requestId }),
        )
      }
    }

    log.info('request.approved', {
      requestId: data.requestId,
      email,
      by: admin.userId,
    })
    return { ok: true as const }
  })

export const denySignupRequestFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const admin = await requirePlatformAdmin()
    const res = await pool.query(
      `UPDATE signup_request
          SET status = 'denied',
              reviewed_at = now(),
              reviewed_by_user_id = $2
        WHERE id = $1 AND status = 'pending'`,
      [data.requestId, admin.userId],
    )
    if ((res.rowCount ?? 0) === 0) {
      throw new Error('Request not found or already reviewed')
    }
    log.info('request.denied', { requestId: data.requestId, by: admin.userId })
    return { ok: true as const }
  })

export const revokeSignupInviteFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { inviteId: string }) => input)
  .handler(async ({ data }) => {
    const admin = await requirePlatformAdmin()
    const res = await pool.query(
      `UPDATE signup_invite
          SET used_at = now(),
              used_by_user_id = $2
        WHERE id = $1 AND used_at IS NULL`,
      [data.inviteId, admin.userId],
    )
    if ((res.rowCount ?? 0) === 0) {
      throw new Error('Invite not found or already used')
    }
    log.info('invite.revoked', { inviteId: data.inviteId, by: admin.userId })
    return { ok: true as const }
  })
