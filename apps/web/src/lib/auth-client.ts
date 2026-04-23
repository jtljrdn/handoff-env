import { createAuthClient } from 'better-auth/react'
import { organizationClient } from 'better-auth/client/plugins'
import { emailOTPClient } from 'better-auth/client/plugins'
import { adminClient } from 'better-auth/client/plugins'
import { stripeClient } from '@better-auth/stripe/client'

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    emailOTPClient(),
    adminClient(),
    stripeClient({ subscription: true }),
  ],
})
