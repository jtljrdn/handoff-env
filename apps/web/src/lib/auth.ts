import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { organization } from 'better-auth/plugins/organization'
import { bearer } from 'better-auth/plugins/bearer'
import { createAccessControl } from 'better-auth/plugins/access'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { stripe } from '@better-auth/stripe'
import Stripe from 'stripe'
import { pool } from '#/db/pool'
import { getStripePlans } from '#/lib/billing/plans'
import {
  assertCanIncreaseBillableSeats,
  assertCanInviteMember,
} from '#/lib/billing/entitlements'
import { syncSeatsForOrg } from '#/lib/billing/seats'
import { sendOtpEmail } from '#/lib/email/send-otp'
import { createResendContact } from '#/lib/email/create-contact'

const ac = createAccessControl({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
  subscription: ['manage'],
} as const)

const ownerRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
  subscription: ['manage'],
})

const adminRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update'],
  organization: ['update'],
})

const memberRole = ac.newRole({
  project: ['create'],
  environment: ['create'],
  variable: ['create', 'update'],
})

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          const path = context?.path ?? ''
          const isOAuthSignup =
            path.startsWith('/callback/') ||
            path.startsWith('/oauth2/callback/')
          if (!isOAuthSignup) return
          if (!user.email || !user.name) return

          try {
            await createResendContact({
              email: user.email,
              name: user.name,
            })
          } catch (err) {
            console.error(
              '[Handoff] createResendContact (OAuth signup) failed:',
              err,
            )
          }
        },
      },
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    tanstackStartCookies(),
    organization({
      ac,
      roles: {
        owner: ownerRole,
        admin: adminRole,
        member: memberRole,
      },
      async sendInvitationEmail({ email, invitation }) {
        // TODO: send via SMTP in a later phase
        const inviteLink = `${process.env.BETTER_AUTH_URL}/invite/${invitation.id}`
        console.log(
          `[Handoff] Invitation email for ${email}, invitationId: ${invitation.id}, invite link: ${inviteLink}`,
        )
      },
      organizationHooks: {
        beforeCreateInvitation: async ({ organization: org, inviter }) => {
          try {
            await assertCanInviteMember(org.id)
            const roleRes = await pool.query(
              'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
              [inviter.id, org.id],
            )
            const inviterRole = roleRes.rows[0]?.role ?? 'member'
            await assertCanIncreaseBillableSeats(org.id, inviterRole)
          } catch (err) {
            if (err instanceof Response) {
              const body = await err
                .clone()
                .json()
                .catch(() => ({}))
              throw new APIError('PAYMENT_REQUIRED', {
                message: body.error ?? 'Member limit reached',
                code: body.code ?? 'PLAN_LIMIT_REACHED',
              })
            }
            throw err
          }
        },
        afterAddMember: async ({ organization: org }) => {
          await syncSeatsForOrg(org.id).catch((e) =>
            console.error('[Handoff] seat sync after add failed:', e),
          )
        },
        afterAcceptInvitation: async ({ organization: org }) => {
          await syncSeatsForOrg(org.id).catch((e) =>
            console.error('[Handoff] seat sync after accept failed:', e),
          )
        },
        afterRemoveMember: async ({ organization: org }) => {
          await syncSeatsForOrg(org.id).catch((e) =>
            console.error('[Handoff] seat sync after remove failed:', e),
          )
        },
      },
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: false,
      subscription: {
        enabled: true,
        plans: getStripePlans(),
        authorizeReference: async ({ user, referenceId }) => {
          const result = await pool.query(
            'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
            [user.id, referenceId],
          )
          const role = result.rows[0]?.role
          return role === 'owner'
        },
        // NOTE: onSubscriptionComplete only fires on `checkout.session.completed`
        // webhooks. We use Stripe Elements + a manually-created subscription
        // (billing.ts#createCheckoutIntentFn), so Checkout Sessions are never
        // used and this hook will never fire in prod. We keep it for
        // parity with future Checkout-based flows; the real upgrade signal is
        // `onSubscriptionUpdate` — status transitions from `incomplete` to
        // `active` when the payment intent confirms.
        onSubscriptionComplete: async ({
          event,
          stripeSubscription,
          subscription,
          plan,
        }) => {
          const invoice = stripeSubscription.latest_invoice
          const amountPaid =
            invoice && typeof invoice !== 'string' ? invoice.amount_paid : null
          const currency =
            invoice && typeof invoice !== 'string' ? invoice.currency : null
          console.log(
            `[Handoff][billing] Subscription completed — org=${subscription.referenceId} plan=${plan.name} status=${stripeSubscription.status} seats=${subscription.seats ?? '-'} customer=${subscription.stripeCustomerId ?? '-'} stripeSubId=${stripeSubscription.id}` +
              (amountPaid !== null
                ? ` amountPaid=${amountPaid} currency=${currency}`
                : '') +
              ` event=${event.id}`,
          )
        },
        onSubscriptionUpdate: async ({ event, subscription }) => {
          // Correlate with the `Stripe webhook received` log above — if the
          // org status here is `active`/`trialing`, getOrgPlan() will now
          // return 'team' and entitlements will unlock.
          const status = subscription.status
          const wasUpgrade = status === 'active' || status === 'trialing'
          console.log(
            `[Handoff][billing] Subscription updated — org=${subscription.referenceId} status=${status} seats=${subscription.seats ?? '-'} plan=${subscription.plan} event=${event.id}${wasUpgrade ? ' → entitlements unlocked' : ''}`,
          )
        },
        onSubscriptionCancel: async ({ subscription }) => {
          console.log(
            `[Handoff][billing] Subscription cancelled — org=${subscription.referenceId} status=${subscription.status} plan=${subscription.plan}`,
          )
        },
      },
      organization: {
        enabled: true,
      },
      // Fires on EVERY stripe webhook the plugin decodes successfully.
      // Use this to verify webhooks are reaching the plugin at all — if you
      // see no logs here, the problem is upstream of better-auth (URL,
      // reverse proxy, or signature verification).
      onEvent: async (event) => {
        console.log(
          `[Handoff][billing] Stripe webhook received — type=${event.type} id=${event.id} livemode=${event.livemode}`,
        )
      },
    }),
    bearer(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Handoff] OTP for ${email} (${type}): ${otp}`)
          }
          await sendOtpEmail({ email, otp, type })
        } catch (err) {
          console.error('[Handoff] sendOtpEmail failed:', err)
          throw err
        }
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
