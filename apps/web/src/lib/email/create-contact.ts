import { getResend } from './client'
import { logger } from '#/lib/logger'

const log = logger.child({ scope: 'email.create_contact' })

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
    log.warn('skipped', {
      reason: 'no_audience_id',
      email: input.email,
    })
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
    log.error('failed', {
      email: input.email,
      errMessage: error.message ?? JSON.stringify(error),
    })
    throw new Error(
      `[Handoff] Resend contacts.create failed for ${input.email}: ${error.message ?? JSON.stringify(error)}`,
    )
  }
  log.info('ok', { email: input.email })
}
