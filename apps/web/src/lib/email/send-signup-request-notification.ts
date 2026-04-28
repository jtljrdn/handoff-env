import { getFromAddress, getResend } from './client'
import { renderSignupRequestNotificationEmail } from './templates/signup-request-notification'
import { logger, errCtx } from '#/lib/logger'

const log = logger.child({ scope: 'email.signup-notify' })

const DEFAULT_NOTIFY_ADDRESS = 'jordan@jtlee.dev'

export async function sendSignupRequestNotificationEmail(input: {
  email: string
  name?: string | null
  reason?: string | null
}): Promise<void> {
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? DEFAULT_NOTIFY_ADDRESS
  const baseUrl = process.env.BETTER_AUTH_URL ?? ''
  const reviewUrl = baseUrl ? `${baseUrl}/admin/requests` : null

  const { subject, html } = renderSignupRequestNotificationEmail({
    email: input.email,
    name: input.name,
    reason: input.reason,
    reviewUrl,
  })

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject,
    html,
    replyTo: input.email,
  })

  if (error) {
    log.error(
      'send_failed',
      errCtx(error, {
        to,
        errMessage: error.message ?? JSON.stringify(error),
      }),
    )
    throw new Error(
      `[Handoff] Failed to send signup notification to ${to}: ${error.message ?? JSON.stringify(error)}`,
    )
  }
  log.info('sent', { to, email: input.email })
}
