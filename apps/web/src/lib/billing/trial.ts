import { nanoid } from 'nanoid'
import { pool } from '#/db/pool'
import { logger, errCtx } from '#/lib/logger'

const log = logger.child({ scope: 'billing.trial' })

const TRIAL_DAYS = 14

export type TrialStatus =
  | { status: 'none' }
  | {
      status: 'trialing'
      trialEnd: string
      daysLeft: number
    }
  | {
      status: 'expired'
      trialEnd: string
    }

export async function activateTrialForOrg(opts: {
  orgId: string
  userId: string
}): Promise<{ activated: boolean; trialEnd?: Date }> {
  const { orgId, userId } = opts

  const [otherMembership, existing] = await Promise.all([
    pool.query(
      `SELECT 1 FROM member
        WHERE "userId" = $1 AND "organizationId" <> $2
        LIMIT 1`,
      [userId, orgId],
    ),
    pool.query(
      `SELECT 1 FROM subscription WHERE "referenceId" = $1 LIMIT 1`,
      [orgId],
    ),
  ])
  if ((otherMembership.rowCount ?? 0) > 0) {
    log.info('trial.skip.subsequent_org', { orgId, userId })
    return { activated: false }
  }
  if ((existing.rowCount ?? 0) > 0) {
    log.info('trial.skip.subscription_exists', { orgId })
    return { activated: false }
  }

  const now = new Date()
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const subId = `sub_${nanoid(21)}`

  try {
    await pool.query(
      `INSERT INTO subscription
         (id, plan, "referenceId", "stripeCustomerId", status,
          "periodStart", "periodEnd", "trialStart", "trialEnd",
          seats, "billingInterval")
       VALUES ($1, 'team', $2, $3, 'trialing', $4, $5, $4, $5, NULL, 'trial')`,
      [subId, orgId, `trial_${orgId}`, now.toISOString(), trialEnd.toISOString()],
    )
    log.info('trial.activated', {
      orgId,
      userId,
      subId,
      trialEnd: trialEnd.toISOString(),
    })
    return { activated: true, trialEnd }
  } catch (err) {
    log.error('trial.activate_failed', errCtx(err, { orgId, userId }))
    return { activated: false }
  }
}

export async function getTrialStatusForOrg(orgId: string): Promise<TrialStatus> {
  const result = await pool.query(
    `SELECT "trialEnd"
       FROM subscription
      WHERE "referenceId" = $1
        AND status = 'trialing'
        AND "billingInterval" = 'trial'
      ORDER BY "trialEnd" DESC NULLS LAST
      LIMIT 1`,
    [orgId],
  )
  const row = result.rows[0]
  if (!row || !row.trialEnd) return { status: 'none' }

  const trialEnd = new Date(row.trialEnd)
  const msLeft = trialEnd.getTime() - Date.now()
  if (msLeft <= 0) {
    return { status: 'expired', trialEnd: trialEnd.toISOString() }
  }
  return {
    status: 'trialing',
    trialEnd: trialEnd.toISOString(),
    daysLeft: Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000))),
  }
}

