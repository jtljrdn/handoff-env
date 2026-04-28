import { createFileRoute } from '@tanstack/react-router'
import { recordAudit } from '#/lib/services/audit'
import { consumeVariableShareView } from '#/lib/services/variable-shares'
import { logger, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'share.consume' })

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || bucket.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false
  bucket.count += 1
  return true
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function shareIdFromUrl(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  if (!last || !/^[A-Za-z0-9_-]+$/.test(last)) return null
  return last
}

function gone(code: 'EXPIRED' | 'EXHAUSTED' | 'REVOKED'): Response {
  return new Response(JSON.stringify({ error: code, code }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  })
}

function notFound(): Response {
  return new Response(
    JSON.stringify({ error: 'Share not found', code: 'NOT_FOUND' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } },
  )
}

export const Route = createFileRoute('/api/share/$shareId')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const startedAt = performance.now()
        const url = new URL(request.url)
        const shareId = shareIdFromUrl(url)
        if (!shareId) return notFound()

        const ip = clientIp(request)
        if (!checkRateLimit(ip)) {
          log.warn('rate_limited', { shareId, ip })
          return new Response(
            JSON.stringify({
              error: 'Too many requests',
              code: 'RATE_LIMITED',
            }),
            {
              status: 429,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        const result = await consumeVariableShareView(shareId)
        if (!result.ok) {
          log.info('reject', {
            shareId,
            error: result.error,
            durationMs: durationMs(startedAt),
          })
          if (result.error === 'NOT_FOUND') return notFound()
          return gone(result.error)
        }

        void recordAudit({
          orgId: result.orgId,
          actorUserId: result.createdByUserId,
          action: 'variable.share.view',
          environmentId: result.environmentId,
          targetKey: result.payload.label,
          metadata: {
            shareId,
            ip,
            viewsLeft: result.payload.viewsLeft,
          },
        })

        log.info('ok', {
          shareId,
          viewsLeft: result.payload.viewsLeft,
          durationMs: durationMs(startedAt),
        })

        return new Response(JSON.stringify({ data: result.payload }), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
