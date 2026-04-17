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
              const body = await err.clone().json().catch(() => ({}))
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
      },
      organization: {
        enabled: true,
      },
    }),
    bearer(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.log(`[Handoff] OTP for ${email} (${type}): ${otp}`)
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
