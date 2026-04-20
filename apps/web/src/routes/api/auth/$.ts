import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'

function logStripeWebhookIfApplicable(request: Request): void {
  const url = new URL(request.url)
  if (!url.pathname.endsWith('/stripe/webhook')) return
  const sig = request.headers.get('stripe-signature')
  const len = request.headers.get('content-length') ?? '?'
  console.log(
    `[Handoff][billing] Inbound stripe webhook request — method=${request.method} path=${url.pathname} hasSignature=${!!sig} contentLength=${len}`,
  )
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => {
        logStripeWebhookIfApplicable(request)
        return auth.handler(request)
      },
    },
  },
})
