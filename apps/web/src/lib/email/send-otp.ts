import { getFromAddress, getResend } from './client'
import { renderOtpEmail, type OtpEmailType } from './templates/otp'
import { logger } from '#/lib/logger'

const log = logger.child({ scope: 'email.otp' })

export async function sendOtpEmail(input: {
  email: string
  otp: string
  type: OtpEmailType
}): Promise<void> {
  const { subject, html } = renderOtpEmail({ otp: input.otp, type: input.type })
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
      type: input.type,
      errMessage: error.message ?? JSON.stringify(error),
    })
    throw new Error(
      `[Handoff] Failed to send OTP email to ${input.email}: ${error.message ?? JSON.stringify(error)}`,
    )
  }
  log.info('sent', { email: input.email, type: input.type })
}
