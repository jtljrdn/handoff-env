import Stripe from 'stripe'
import { pool } from '#/db/pool'
import { logger, errCtx } from '#/lib/logger'

const client = new Stripe(process.env.STRIPE_SECRET_KEY!)
const log = logger.child({ scope: 'billing.seats' })

export async function syncSeatsForOrg(orgId: string): Promise<void> {
  const sub = await pool.query(
    `SELECT "stripeSubscriptionId" FROM subscription
     WHERE "referenceId" = $1 AND status = ANY($2::text[])
     ORDER BY "periodEnd" DESC NULLS LAST
     LIMIT 1`,
    [orgId, ['active', 'trialing', 'past_due']],
  )
  const subId = sub.rows[0]?.stripeSubscriptionId
  if (!subId) {
    log.debug('sync.skip_no_subscription', { orgId })
    return
  }

  const memberCount = await pool.query(
    'SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1',
    [orgId],
  )
  const quantity = Math.max(1, memberCount.rows[0]?.n ?? 1)

  try {
    const stripeSub = await client.subscriptions.retrieve(subId)
    const firstItem = stripeSub.items.data[0]
    if (!firstItem) {
      log.warn('sync.no_sub_item', { orgId, subId })
      return
    }
    if (firstItem.quantity === quantity) {
      log.debug('sync.noop', { orgId, subId, quantity })
      return
    }

    await client.subscriptionItems.update(firstItem.id, {
      quantity,
      proration_behavior: 'create_prorations',
    })
    log.info('sync.updated', {
      orgId,
      subId,
      from: firstItem.quantity ?? null,
      to: quantity,
    })
  } catch (err) {
    log.error('sync.failed', errCtx(err, { orgId, subId, quantity }))
    throw err
  }
}
