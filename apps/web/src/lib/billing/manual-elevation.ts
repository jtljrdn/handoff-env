import { nanoid } from 'nanoid'
import type { Pool } from 'pg'
import { pool as defaultPool } from '#/db/pool'
import { logger } from '#/lib/logger'

const log = logger.child({ scope: 'billing.manual_elevation' })

export type ElevateResult = {
  orgId: string
  orgName: string
  orgSlug: string
  periodEnd: Date
  action: 'created' | 'extended'
}

export type RevokeResult = {
  orgId: string
  orgName: string
  orgSlug: string
  revoked: number
}

export class OrgNotFoundError extends Error {
  constructor(target: string) {
    super(`No organization found matching "${target}"`)
    this.name = 'OrgNotFoundError'
  }
}

async function findOrg(
  pool: Pool,
  target: string,
): Promise<{ id: string; name: string; slug: string }> {
  const res = await pool.query(
    `SELECT id, name, slug FROM organization WHERE id = $1 OR slug = $1 LIMIT 1`,
    [target],
  )
  const org = res.rows[0]
  if (!org) throw new OrgNotFoundError(target)
  return org
}

export async function elevateOrg(opts: {
  target: string
  months: number
  pool?: Pool
}): Promise<ElevateResult> {
  const pool = opts.pool ?? defaultPool
  if (!Number.isFinite(opts.months) || opts.months <= 0) {
    throw new Error('months must be a positive number')
  }
  const org = await findOrg(pool, opts.target)

  const existing = await pool.query(
    `SELECT id FROM subscription
      WHERE "referenceId" = $1 AND "stripeCustomerId" LIKE 'manual_%'
      LIMIT 1`,
    [org.id],
  )

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + opts.months)

  if (existing.rows[0]) {
    await pool.query(
      `UPDATE subscription SET
         status = 'active',
         "periodStart" = $2,
         "periodEnd" = $3,
         "cancelAtPeriodEnd" = false,
         "canceledAt" = NULL,
         "endedAt" = NULL,
         plan = 'team',
         "billingInterval" = 'manual'
       WHERE id = $1`,
      [existing.rows[0].id, now.toISOString(), periodEnd.toISOString()],
    )
    log.info('elevate.extended', {
      orgId: org.id,
      months: opts.months,
      periodEnd: periodEnd.toISOString(),
    })
    return {
      orgId: org.id,
      orgName: org.name,
      orgSlug: org.slug,
      periodEnd,
      action: 'extended',
    }
  }

  const subId = nanoid()
  await pool.query(
    `INSERT INTO subscription
       (id, plan, "referenceId", "stripeCustomerId", status,
        "periodStart", "periodEnd", seats, "billingInterval")
     VALUES ($1, 'team', $2, $3, 'active', $4, $5, NULL, 'manual')`,
    [
      subId,
      org.id,
      `manual_${org.id}`,
      now.toISOString(),
      periodEnd.toISOString(),
    ],
  )
  log.info('elevate.created', {
    orgId: org.id,
    months: opts.months,
    periodEnd: periodEnd.toISOString(),
    subId,
  })
  return {
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    periodEnd,
    action: 'created',
  }
}

export async function revokeManualElevation(opts: {
  target: string
  pool?: Pool
}): Promise<RevokeResult> {
  const pool = opts.pool ?? defaultPool
  const org = await findOrg(pool, opts.target)

  const del = await pool.query(
    `DELETE FROM subscription
      WHERE "referenceId" = $1 AND "stripeCustomerId" LIKE 'manual_%'
      RETURNING id`,
    [org.id],
  )
  const revoked = del.rowCount ?? 0
  log.info('elevate.revoked', { orgId: org.id, revoked })
  return {
    orgId: org.id,
    orgName: org.name,
    orgSlug: org.slug,
    revoked,
  }
}
