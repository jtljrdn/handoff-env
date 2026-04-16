import Stripe from 'stripe'
import { pool } from '#/db/pool'

const client = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function syncSeatsForOrg(orgId: string): Promise<void> {
  const sub = await pool.query(
    `SELECT "stripeSubscriptionId" FROM subscription
     WHERE "referenceId" = $1 AND status = ANY($2::text[])
     ORDER BY "periodEnd" DESC NULLS LAST
     LIMIT 1`,
    [orgId, ['active', 'trialing', 'past_due']],
  )
  const subId = sub.rows[0]?.stripeSubscriptionId
  if (!subId) return

  const memberCount = await pool.query(
    'SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1',
    [orgId],
  )
  const quantity = Math.max(1, memberCount.rows[0]?.n ?? 1)

  const stripeSub = await client.subscriptions.retrieve(subId)
  const firstItem = stripeSub.items.data[0]
  if (!firstItem) return
  if (firstItem.quantity === quantity) return

  await client.subscriptionItems.update(firstItem.id, {
    quantity,
    proration_behavior: 'create_prorations',
  })
}
