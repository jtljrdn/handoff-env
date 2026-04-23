import { getFromAddress, getResend } from './client'
import { renderInviteEmail } from './templates/invite'
import { logger } from '#/lib/logger'

const log = logger.child({ scope: 'email.invite' })

export async function sendInviteEmail(input: {
  email: string
  expiresAt: Date
  note?: string | null
}): Promise<void> {
  const baseUrl = process.env.BETTER_AUTH_URL ?? ''
  const signInUrl = `${baseUrl}/sign-in?invited=1`
  const { subject, html } = renderInviteEmail({
    signInUrl,
    expiresAt: input.expiresAt,
    note: input.note,
  })
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: input.email,
    subject,
    html,
  })

  if (error) {
    log.error('send_failed', {
      email: input.email,
      errMessage: error.message ?? JSON.stringify(error),
    })
    throw new Error(
      `[Handoff] Failed to send invite email to ${input.email}: ${error.message ?? JSON.stringify(error)}`,
    )
  }
  log.info('sent', { email: input.email })
}
