import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { organization } from 'better-auth/plugins/organization'
import { bearer } from 'better-auth/plugins/bearer'
import { createAccessControl } from 'better-auth/plugins/access'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { pool } from '#/db/pool'

const ac = createAccessControl({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
} as const)

const ownerRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
  invitation: ['create', 'cancel'],
  member: ['create', 'update', 'delete'],
  organization: ['update', 'delete'],
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

export const auth = betterAuth({
  database: pool,
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
