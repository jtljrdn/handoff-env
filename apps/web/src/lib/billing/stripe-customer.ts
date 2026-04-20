import Stripe from 'stripe'
import { pool } from '#/db/pool'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function getOrgOwnerEmail(orgId: string): Promise<string | null> {
  // There's only ever one `role = 'owner'` in our transfer model (the
  // previous owner is demoted to admin), so ORDER BY is a belt-and-braces
  // guarantee rather than a tiebreaker that matters in practice.
  const res = await pool.query(
    `SELECT u.email
     FROM member m
     JOIN "user" u ON u.id = m."userId"
     WHERE m."organizationId" = $1 AND m.role = 'owner'
     ORDER BY m."createdAt" ASC
     LIMIT 1`,
    [orgId],
  )
  return (res.rows[0]?.email as string | undefined) ?? null
}

export async function getOrCreateStripeCustomer(orgId: string): Promise<string> {
  const existing = await pool.query(
    'SELECT "stripeCustomerId", name FROM organization WHERE id = $1 LIMIT 1',
    [orgId],
  )
  const row = existing.rows[0]
  if (!row) throw new Error('Organization not found')
  if (row.stripeCustomerId) return row.stripeCustomerId

  const ownerEmail = await getOrgOwnerEmail(orgId)

  const customer = await stripeClient.customers.create({
    name: row.name,
    ...(ownerEmail ? { email: ownerEmail } : {}),
    metadata: { organizationId: orgId },
  })
  await pool.query(
    'UPDATE organization SET "stripeCustomerId" = $1 WHERE id = $2',
    [customer.id, orgId],
  )
  return customer.id
}

/**
 * Drops any stored Stripe customer id for the org and provisions a fresh one.
 * Used as a fallback when the stored id no longer resolves in Stripe (e.g.
 * the customer was deleted upstream, or the Stripe account was reset between
 * test and live modes). Any subscription rows pointing at the old id stay
 * put — they'll be cleaned up by the webhook handler or on next cancel —
 * because we never want a failed customer lookup to cascade into data loss.
 */
export async function recreateStripeCustomerForOrg(
  orgId: string,
): Promise<string> {
  await pool.query(
    'UPDATE organization SET "stripeCustomerId" = NULL WHERE id = $1',
    [orgId],
  )
  return getOrCreateStripeCustomer(orgId)
}

export function isStripeMissingCustomerError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const anyErr = err as {
    code?: string
    type?: string
    raw?: { code?: string }
    statusCode?: number
  }
  return (
    anyErr.code === 'resource_missing' ||
    anyErr.raw?.code === 'resource_missing' ||
    (anyErr.type === 'StripeInvalidRequestError' &&
      anyErr.statusCode === 404)
  )
}

/**
 * Push the current owner's email (and org name) onto the Stripe customer so
 * receipts, card-expiry warnings, and dunning mail reach the right person
 * after an ownership transfer or org rename. Best-effort — never rethrows,
 * because a Stripe hiccup must not undo an already-committed auth change.
 */
export async function syncStripeCustomerContact(orgId: string): Promise<void> {
  const res = await pool.query(
    'SELECT "stripeCustomerId", name FROM organization WHERE id = $1 LIMIT 1',
    [orgId],
  )
  const row = res.rows[0]
  const customerId = row?.stripeCustomerId as string | undefined
  if (!customerId) return

  const email = await getOrgOwnerEmail(orgId)
  if (!email) return

  try {
    await stripeClient.customers.update(customerId, {
      email,
      name: row.name as string,
    })
  } catch (err) {
    console.error(
      `[Handoff][billing] Failed to sync Stripe customer ${customerId} for org=${orgId}:`,
      err,
    )
  }
}
