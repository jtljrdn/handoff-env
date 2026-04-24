import { randomUUID } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { pool } from '#/db/pool'
import { logger, errCtx } from '#/lib/logger'

const log = logger.child({ scope: 'signup-request' })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const submitSignupRequestFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { email: string; name?: string; reason?: string }) => input,
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim()
    if (!EMAIL_RE.test(email) || email.length > 320) {
      return { ok: true as const }
    }

    const name = data.name?.trim().slice(0, 120) || null
    const reason = data.reason?.trim().slice(0, 1000) || null

    try {
      await pool.query(
        `INSERT INTO signup_request (id, email, name, reason)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), email, name, reason],
      )
      log.info('submitted', { email })
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === '23505') {
        log.info('duplicate', { email })
      } else {
        log.error('submit_failed', errCtx(err, { email }))
      }
    }

    return { ok: true as const }
  })
