import { createServerFn } from '@tanstack/react-start'
import Stripe from 'stripe'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { pool } from '#/db/pool'
import { auth } from '#/lib/auth'
import { requireOrgSession, requirePermission } from '#/lib/middleware/auth'
import { getOrgPlan, getOrgUsage } from '#/lib/billing/entitlements'
import {
  FREE_LIMITS,
  TEAM_INCLUDED_SEATS,
  TEAM_LIMITS,
} from '#/lib/billing/plans'
import {
  getOrCreateStripeCustomer,
  isStripeMissingCustomerError,
  recreateStripeCustomerForOrg,
} from '#/lib/billing/stripe-customer'
import { getRequest } from '@tanstack/react-start/server'
import { logger, errCtx } from '#/lib/logger'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)
const log = logger.child({ scope: 'billing.server_fn' })

export const createCheckoutIntentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { annual: boolean }) => {
    z.object({ annual: z.boolean() }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('subscription', 'manage')
    const currentPlan = await getOrgPlan(user.orgId)
    if (currentPlan === 'team') {
      throw new Error('Organization already on the Team plan')
    }

    const request = getRequest()
    const fullOrg = await auth.api.getFullOrganization({
      headers: request.headers,
      query: { organizationId: user.orgId },
    })
    const memberCount = fullOrg?.members?.length ?? 1
    const quantity = Math.max(1, memberCount)

    const priceId = data.annual
      ? process.env.STRIPE_TEAM_YEARLY!
      : process.env.STRIPE_TEAM_MONTHLY!

    let customerId = await getOrCreateStripeCustomer(user.orgId)

    // Fallback: the org may have a stored stripeCustomerId pointing at a
    // customer that's been deleted in Stripe (test-mode resets, manual
    // cleanup, account migration). If Stripe returns resource_missing, mint
    // a fresh customer and retry the subscription create exactly once.
    const subscriptionParams = {
      items: [{ price: priceId, quantity }],
      payment_behavior: 'default_incomplete' as const,
      payment_settings: {
        save_default_payment_method: 'on_subscription' as const,
      },
      expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
      metadata: {
        organizationId: user.orgId,
        referenceId: user.orgId,
      },
    }

    let subscription: Stripe.Subscription
    try {
      subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        ...subscriptionParams,
      })
    } catch (err) {
      if (!isStripeMissingCustomerError(err)) {
        log.error(
          'checkout.stripe_create_failed',
          errCtx(err, { orgId: user.orgId, customerId, priceId, quantity }),
        )
        throw err
      }
      log.warn('checkout.stale_customer', {
        orgId: user.orgId,
        staleCustomerId: customerId,
      })
      customerId = await recreateStripeCustomerForOrg(user.orgId)
      subscription = await stripeClient.subscriptions.create({
        customer: customerId,
        ...subscriptionParams,
      })
    }

    const invoice = subscription.latest_invoice as Stripe.Invoice | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const confirmationSecret = (invoice as any)?.confirmation_secret?.client_secret as
      | string
      | undefined
    const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null

    const clientSecret = confirmationSecret ?? setupIntent?.client_secret
    if (!clientSecret) {
      log.error('checkout.no_client_secret', {
        orgId: user.orgId,
        stripeSubId: subscription.id,
      })
      throw new Error('Unable to create checkout session: no client secret returned')
    }

    const subRecordId = nanoid()
    await pool.query(
      `INSERT INTO subscription
         (id, plan, "referenceId", "stripeCustomerId", "stripeSubscriptionId",
          status, "periodStart", "periodEnd", seats, "billingInterval")
       VALUES ($1, 'team', $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        subRecordId,
        user.orgId,
        customerId,
        subscription.id,
        subscription.status,
        subscription.start_date
          ? new Date(subscription.start_date * 1000).toISOString()
          : null,
        null,
        quantity,
        data.annual ? 'year' : 'month',
      ],
    )

    log.info('checkout.initiated', {
      orgId: user.orgId,
      interval: data.annual ? 'year' : 'month',
      seats: quantity,
      stripeSubId: subscription.id,
      status: subscription.status,
      customerId,
      mode: confirmationSecret ? 'payment' : 'setup',
    })

    return {
      clientSecret,
      subscriptionId: subscription.id,
      mode: confirmationSecret ? 'payment' : 'setup',
      quantity,
      annual: data.annual,
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY!,
    }
  })

export const getSeatChangePreviewFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { seatDelta: number }) => {
    z.object({ seatDelta: z.number().int() }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    const plan = await getOrgPlan(user.orgId)

    const memberRes = await pool.query(
      'SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1',
      [user.orgId],
    )
    const currentSeats = memberRes.rows[0]?.n ?? 1
    const nextSeats = Math.max(1, currentSeats + data.seatDelta)

    if (plan !== 'team') {
      const base = nextSeats > TEAM_INCLUDED_SEATS ? TEAM_INCLUDED_SEATS : nextSeats
      return {
        plan: 'free' as const,
        currentSeats,
        nextSeats,
        includedSeats: TEAM_INCLUDED_SEATS,
        crossesThreshold: false,
        currentCostCents: 0,
        nextCostCents: 0,
        deltaCents: 0,
        interval: null,
        base,
      }
    }

    const subRes = await pool.query(
      `SELECT "stripeSubscriptionId", "billingInterval" FROM subscription
       WHERE "referenceId" = $1 AND status = ANY($2::text[])
       ORDER BY "periodEnd" DESC NULLS LAST
       LIMIT 1`,
      [user.orgId, ['active', 'trialing', 'past_due']],
    )
    const subId = subRes.rows[0]?.stripeSubscriptionId
    const interval = subRes.rows[0]?.billingInterval as 'month' | 'year' | null

    const perSeatCents = interval === 'year' ? 4200 : 400
    const baseCents = interval === 'year' ? 20000 : 2000

    const costFor = (seats: number) => {
      const extra = Math.max(0, seats - TEAM_INCLUDED_SEATS)
      return baseCents + extra * perSeatCents
    }

    const currentCostCents = costFor(currentSeats)
    const nextCostCents = costFor(nextSeats)
    const deltaCents = nextCostCents - currentCostCents
    const crossesThreshold =
      currentSeats <= TEAM_INCLUDED_SEATS && nextSeats > TEAM_INCLUDED_SEATS

    let prorationCents: number | null = null
    if (subId && deltaCents !== 0) {
      try {
        const sub = await stripeClient.subscriptions.retrieve(subId)
        const firstItem = sub.items.data[0]
        if (firstItem) {
          const invoice = await stripeClient.invoices.createPreview({
            customer: sub.customer as string,
            subscription: subId,
            subscription_details: {
              items: [{ id: firstItem.id, quantity: nextSeats }],
              proration_behavior: 'create_prorations',
            },
          })
          const prorationLines = invoice.lines.data.filter((l) => {
            const parent = l.parent
            if (!parent) return false
            if (
              parent.type === 'subscription_item_details' &&
              parent.subscription_item_details
            ) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (parent.subscription_item_details as any).proration === true
            }
            if (
              parent.type === 'invoice_item_details' &&
              parent.invoice_item_details
            ) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return (parent.invoice_item_details as any).proration === true
            }
            return false
          })
          if (prorationLines.length > 0) {
            prorationCents = prorationLines.reduce((sum, l) => sum + l.amount, 0)
          }
        }
      } catch (err) {
        log.warn(
          'proration.preview_failed',
          errCtx(err, { orgId: user.orgId, subId, nextSeats }),
        )
      }
    }

    return {
      plan: 'team' as const,
      currentSeats,
      nextSeats,
      includedSeats: TEAM_INCLUDED_SEATS,
      crossesThreshold,
      currentCostCents,
      nextCostCents,
      deltaCents,
      prorationCents,
      interval,
      base: null,
    }
  })

export const createBillingPortalSessionFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { returnUrl?: string }) => {
    z.object({ returnUrl: z.string().url().optional() }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('subscription', 'manage')
    const custRow = await pool.query(
      'SELECT "stripeCustomerId" FROM organization WHERE id = $1 LIMIT 1',
      [user.orgId],
    )
    const customerId = custRow.rows[0]?.stripeCustomerId
    if (!customerId) {
      log.warn('portal.no_customer', { orgId: user.orgId })
      throw new Error('No billing customer exists for this organization yet')
    }
    const session = await stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: data.returnUrl ?? `${process.env.BETTER_AUTH_URL}/billing`,
    })
    log.info('portal.created', { orgId: user.orgId, customerId })
    return { url: session.url }
  })

export const getBillingDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requirePermission('subscription', 'manage')
    const plan = await getOrgPlan(user.orgId)
    const usage = await getOrgUsage(user.orgId)

    const subRes = await pool.query(
      `SELECT status, "periodStart", "periodEnd", "cancelAtPeriodEnd",
              "trialStart", "trialEnd", seats, "billingInterval"
       FROM subscription
       WHERE "referenceId" = $1
       ORDER BY "periodEnd" DESC NULLS LAST
       LIMIT 1`,
      [user.orgId],
    )
    const row = subRes.rows[0] ?? null

    return {
      orgId: user.orgId,
      plan,
      limits: plan === 'team' ? TEAM_LIMITS : FREE_LIMITS,
      includedSeats: TEAM_INCLUDED_SEATS,
      usage,
      subscription: row
        ? {
            status: row.status as string,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            cancelAtPeriodEnd: row.cancelAtPeriodEnd as boolean | null,
            trialStart: row.trialStart,
            trialEnd: row.trialEnd,
            seats: row.seats as number | null,
            billingInterval: row.billingInterval as string | null,
          }
        : null,
    }
  },
)
