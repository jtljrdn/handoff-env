import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { organization } from 'better-auth/plugins/organization'
import { bearer } from 'better-auth/plugins/bearer'
import { createAccessControl } from 'better-auth/plugins/access'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { admin } from 'better-auth/plugins/admin'
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
import { logger, errCtx } from '#/lib/logger'
import { recordAudit } from '#/lib/services/audit'

const authLog = logger.child({ scope: 'auth.config' })
const billingLog = logger.child({ scope: 'billing' })

const ac = createAccessControl({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
  subscription: ['manage'],
  apiToken: ['create', 'revoke', 'revokeAny', 'viewAll'],
} as const)

const ownerRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
  subscription: ['manage'],
  apiToken: ['create', 'revoke', 'revokeAny', 'viewAll'],
})

const adminRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update'],
  organization: ['update'],
  apiToken: ['create', 'revoke', 'revokeAny', 'viewAll'],
})

const memberRole = ac.newRole({
  project: ['create'],
  environment: ['create'],
  variable: ['create', 'update'],
  apiToken: ['create', 'revoke'],
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
        before: async (user) => {
          if (!user.email) {
            throw new APIError('FORBIDDEN', {
              message: 'Email is required to sign up.',
              code: 'EMAIL_REQUIRED',
            })
          }

          const email = user.email.toLowerCase().trim()

          const inviteRes = await pool.query(
            `SELECT 1 FROM signup_invite
              WHERE lower(email) = $1
                AND used_at IS NULL
                AND expires_at > now()
              LIMIT 1`,
            [email],
          )
          if ((inviteRes.rowCount ?? 0) > 0) return

          const orgInviteRes = await pool.query(
            `SELECT 1 FROM invitation
              WHERE lower(email) = $1
                AND status = 'pending'
                AND "expiresAt" > now()
              LIMIT 1`,
            [email],
          )
          if ((orgInviteRes.rowCount ?? 0) > 0) return

          authLog.info('signup.blocked', { email })
          throw new APIError('FORBIDDEN', {
            message: 'This email is not invited.',
            code: 'INVITE_REQUIRED',
          })
        },
        after: async (user, context) => {
          if (user.email) {
            try {
              const upd = await pool.query(
                `UPDATE signup_invite
                    SET used_at = now(), used_by_user_id = $2
                  WHERE lower(email) = lower($1)
                    AND used_at IS NULL`,
                [user.email, user.id],
              )
              if ((upd.rowCount ?? 0) > 0) {
                authLog.info('signup_invite.consumed', {
                  userId: user.id,
                  email: user.email,
                })
              }
            } catch (err) {
              authLog.error(
                'signup_invite.consume_failed',
                errCtx(err, { userId: user.id, email: user.email }),
              )
            }
          }

          const path = context?.path ?? ''
          const isOAuthSignup =
            path.startsWith('/callback/') ||
            path.startsWith('/oauth2/callback/')
          if (!isOAuthSignup) return
          authLog.info('user.oauth_signup', {
            userId: user.id,
            hasEmail: !!user.email,
            hasName: !!user.name,
            path,
          })
          if (!user.email || !user.name) return

          try {
            await createResendContact({
              email: user.email,
              name: user.name,
            })
            authLog.info('resend_contact.created', { userId: user.id })
          } catch (err) {
            authLog.error(
              'resend_contact.failed',
              errCtx(err, { userId: user.id }),
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
    admin(),
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
        authLog.info('invitation.email_stub', {
          email,
          invitationId: invitation.id,
          inviteLink,
        })
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
            authLog.info('invitation.allowed', {
              orgId: org.id,
              inviterId: inviter.id,
              inviterRole,
            })
          } catch (err) {
            if (err instanceof Response) {
              const body = await err
                .clone()
                .json()
                .catch(() => ({}))
              authLog.warn('invitation.blocked', {
                orgId: org.id,
                inviterId: inviter.id,
                status: err.status,
                code: body.code,
              })
              throw new APIError('PAYMENT_REQUIRED', {
                message: body.error ?? 'Member limit reached',
                code: body.code ?? 'PLAN_LIMIT_REACHED',
              })
            }
            authLog.error(
              'invitation.precheck_failed',
              errCtx(err, { orgId: org.id, inviterId: inviter.id }),
            )
            throw err
          }
        },
        afterAddMember: async ({ organization: org }) => {
          authLog.info('member.added', { orgId: org.id })
          await syncSeatsForOrg(org.id).catch((e) =>
            billingLog.error(
              'seat_sync.after_add.failed',
              errCtx(e, { orgId: org.id }),
            ),
          )
        },
        afterAcceptInvitation: async ({ organization: org, member }) => {
          authLog.info('invitation.accepted', { orgId: org.id })
          await syncSeatsForOrg(org.id).catch((e) =>
            billingLog.error(
              'seat_sync.after_accept.failed',
              errCtx(e, { orgId: org.id }),
            ),
          )
          if (member?.userId) {
            try {
              await pool.query(
                `INSERT INTO pending_member_wrap (id, org_id, user_id)
                 VALUES (gen_random_uuid()::TEXT, $1, $2)
                 ON CONFLICT (org_id, user_id) DO NOTHING`,
                [org.id, member.userId],
              )
              authLog.info('pending_member_wrap.inserted', {
                orgId: org.id,
                userId: member.userId,
              })
            } catch (err) {
              authLog.error(
                'pending_member_wrap.insert_failed',
                errCtx(err, { orgId: org.id, userId: member.userId }),
              )
            }
          }
        },
        afterRemoveMember: async ({ organization: org, member, user }) => {
          const userId: string | undefined = member?.userId ?? user?.id
          if (!userId) {
            authLog.error('member.remove.no_user_id', { orgId: org.id })
            return
          }

          const client = await pool.connect()
          let wrapsDeleted = 0
          let tokensRevoked: Array<{ id: string; name: string }> = []
          let sessionsRevoked = 0
          let rotationEnqueued = false
          try {
            await client.query('BEGIN')

            const wrapDel = await client.query(
              `DELETE FROM member_dek_wrap
                WHERE org_id = $1 AND user_id = $2`,
              [org.id, userId],
            )
            wrapsDeleted = wrapDel.rowCount ?? 0

            await client.query(
              `DELETE FROM pending_member_wrap
                WHERE org_id = $1 AND user_id = $2`,
              [org.id, userId],
            )

            const tokenDel = await client.query(
              `DELETE FROM api_tokens
                WHERE user_id = $1 AND org_id = $2
                RETURNING id, name`,
              [userId, org.id],
            )
            tokensRevoked = tokenDel.rows as Array<{ id: string; name: string }>

            const sessionDel = await client.query(
              `DELETE FROM session WHERE "userId" = $1`,
              [userId],
            )
            sessionsRevoked = sessionDel.rowCount ?? 0

            const rotationUpd = await client.query(
              `UPDATE organization_dek
                  SET rotation_pending_at = now(),
                      rotation_reason = $2
                WHERE org_id = $1
                  AND retired_at IS NULL
                  AND rotation_pending_at IS NULL`,
              [org.id, `member_removed:${userId}`],
            )
            rotationEnqueued = (rotationUpd.rowCount ?? 0) > 0

            await client.query('COMMIT')
          } catch (err) {
            await client.query('ROLLBACK').catch(() => {})
            authLog.error(
              'member.remove.hard_revoke_failed',
              errCtx(err, { orgId: org.id, userId }),
            )
            client.release()
            throw err
          }
          client.release()

          authLog.info('member.removed', {
            orgId: org.id,
            userId,
            wrapsDeleted,
            tokensRevoked: tokensRevoked.length,
            sessionsRevoked,
            rotationEnqueued,
          })

          void recordAudit({
            orgId: org.id,
            actorUserId: userId,
            action: 'member.remove',
            metadata: {
              wrapsDeleted,
              tokensRevoked: tokensRevoked.map((t) => t.name),
            },
          })
          if (sessionsRevoked > 0) {
            void recordAudit({
              orgId: org.id,
              actorUserId: userId,
              action: 'member.revoke_sessions',
              metadata: { count: sessionsRevoked },
            })
          }
          if (rotationEnqueued) {
            void recordAudit({
              orgId: org.id,
              actorUserId: userId,
              action: 'dek.rotation_enqueued',
              metadata: { reason: 'member_removed' },
            })
          }

          await syncSeatsForOrg(org.id).catch((e) =>
            billingLog.error(
              'seat_sync.after_remove.failed',
              errCtx(e, { orgId: org.id }),
            ),
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
        // `onSubscriptionUpdate`: status transitions from `incomplete` to
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
          billingLog.info('subscription.completed', {
            orgId: subscription.referenceId,
            plan: plan.name,
            status: stripeSubscription.status,
            seats: subscription.seats ?? null,
            stripeCustomerId: subscription.stripeCustomerId ?? null,
            stripeSubscriptionId: stripeSubscription.id,
            amountPaid,
            currency,
            eventId: event.id,
          })
        },
        onSubscriptionUpdate: async ({ event, subscription }) => {
          const status = subscription.status
          const wasUpgrade = status === 'active' || status === 'trialing'
          billingLog.info('subscription.updated', {
            orgId: subscription.referenceId,
            status,
            seats: subscription.seats ?? null,
            plan: subscription.plan,
            eventId: event.id,
            entitlementsUnlocked: wasUpgrade,
          })
        },
        onSubscriptionCancel: async ({ subscription }) => {
          billingLog.info('subscription.cancelled', {
            orgId: subscription.referenceId,
            status: subscription.status,
            plan: subscription.plan,
          })
        },
      },
      organization: {
        enabled: true,
      },
      // Fires on EVERY stripe webhook the plugin decodes successfully.
      // Use this to verify webhooks are reaching the plugin at all. If you
      // see no logs here, the problem is upstream of better-auth (URL,
      // reverse proxy, or signature verification).
      onEvent: async (event) => {
        billingLog.info('stripe.webhook.received', {
          type: event.type,
          eventId: event.id,
          livemode: event.livemode,
        })
      },
    }),
    bearer(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        try {
          if (process.env.NODE_ENV === 'development') {
            authLog.debug('otp.dev_echo', { email, type, otp })
          }
          await sendOtpEmail({ email, otp, type })
          authLog.info('otp.sent', { email, type })
        } catch (err) {
          authLog.error('otp.send_failed', errCtx(err, { email, type }))
          throw err
        }
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
