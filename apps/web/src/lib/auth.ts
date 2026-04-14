import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { organization } from 'better-auth/plugins/organization'
import { bearer } from 'better-auth/plugins/bearer'
import { createAccessControl } from 'better-auth/plugins/access'

const ac = createAccessControl({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
} as const)

const ownerRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
})

const adminRole = ac.newRole({
  project: ['create', 'update', 'delete'],
  environment: ['create', 'update', 'delete'],
  variable: ['create', 'update', 'delete'],
})

const memberRole = ac.newRole({
  project: ['create'],
  environment: ['create'],
  variable: ['create', 'update'],
})

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
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
        console.log(
          `[Handoff] Invitation email for ${email}, invitationId: ${invitation.id}`,
        )
      },
    }),
    bearer(),
  ],
})

export type Session = typeof auth.$Infer.Session
