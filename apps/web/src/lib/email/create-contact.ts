import { getResend } from './client'

export function splitName(fullName: string): {
  firstName: string
  lastName: string
} {
  const trimmed = fullName.trim().replace(/\s+/g, ' ')
  if (!trimmed) return { firstName: '', lastName: '' }
  const idx = trimmed.indexOf(' ')
  if (idx === -1) return { firstName: trimmed, lastName: '' }
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1),
  }
}

export async function createResendContact(input: {
  email: string
  name: string
}): Promise<void> {
  const audienceId = process.env.RESEND_AUDIENCE_ID
  if (!audienceId) {
    console.warn(
      '[Handoff] RESEND_AUDIENCE_ID not set; skipping contact creation',
    )
    return
  }

  const { firstName, lastName } = splitName(input.name)
  const resend = getResend()

  const { error } = await resend.contacts.create({
    audienceId,
    email: input.email,
    firstName,
    lastName,
    unsubscribed: false,
  })

  if (error) {
    throw new Error(
      `[Handoff] Resend contacts.create failed for ${input.email}: ${error.message ?? JSON.stringify(error)}`,
    )
  }
}
