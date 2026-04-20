import { getFromAddress, getResend } from './client'
import { renderOtpEmail, type OtpEmailType } from './templates/otp'

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
    throw new Error(
      `[Handoff] Failed to send OTP email to ${input.email}: ${error.message ?? JSON.stringify(error)}`,
    )
  }
}
