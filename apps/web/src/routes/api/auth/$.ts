import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { logger, errCtx, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'auth.http' })

function logInbound(request: Request): void {
  const url = new URL(request.url)
  const path = url.pathname
  const isStripeWebhook = path.endsWith('/stripe/webhook')
  if (isStripeWebhook) {
    log.info('stripe.webhook.inbound', {
      method: request.method,
      path,
      hasSignature: !!request.headers.get('stripe-signature'),
      contentLength: request.headers.get('content-length') ?? null,
    })
  } else {
    log.debug('inbound', { method: request.method, path })
  }
}

async function handle(request: Request): Promise<Response> {
  const startedAt = performance.now()
  logInbound(request)
  const url = new URL(request.url)
  try {
    const res = await auth.handler(request)
    log.debug('auth.handler.ok', {
      method: request.method,
      path: url.pathname,
      status: res.status,
      durationMs: durationMs(startedAt),
    })
    return res
  } catch (err) {
    log.error(
      'auth.handler.failed',
      errCtx(err, {
        method: request.method,
        path: url.pathname,
        durationMs: durationMs(startedAt),
      }),
    )
    throw err
  }
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
