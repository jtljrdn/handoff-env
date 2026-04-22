import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { verifyEnvironmentOrg } from '#/lib/services/environments'
import { getDecryptedKeyValuePairs } from '#/lib/services/variables'
import { logger, errCtx, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'api.env.download' })

function escapeEnvValue(val: string): string {
  if (!val || /[\n\r"\s#]/.test(val)) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return val
}

export const Route = createFileRoute(
  '/api/environments/$environmentId/download',
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const startedAt = performance.now()
        const session = await auth.api.getSession({
          headers: request.headers,
        })
        if (!session?.user) {
          log.info('reject', {
            reason: 'no_session',
            environmentId: params.environmentId,
          })
          return new Response('Unauthorized', { status: 401 })
        }

        const orgId = session.session.activeOrganizationId
        if (!orgId) {
          log.info('reject', {
            reason: 'no_active_org',
            userId: session.user.id,
            environmentId: params.environmentId,
          })
          return new Response('No active organization', { status: 403 })
        }

        const req = log.child({
          userId: session.user.id,
          orgId,
          environmentId: params.environmentId,
        })

        try {
          const env = await verifyEnvironmentOrg(params.environmentId, orgId)
          const pairs = await getDecryptedKeyValuePairs(
            params.environmentId,
            orgId,
          )

          const content =
            Object.entries(pairs)
              .map(([key, value]) => `${key}=${escapeEnvValue(value)}`)
              .join('\n') + '\n'

          const filename = `.env.${env.name}`
          req.info('ok', {
            envName: env.name,
            keyCount: Object.keys(pairs).length,
            byteLength: content.length,
            durationMs: durationMs(startedAt),
          })

          return new Response(content, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': `attachment; filename="${filename}"`,
            },
          })
        } catch (err) {
          req.error(
            'failed',
            errCtx(err, { durationMs: durationMs(startedAt) }),
          )
          throw err
        }
      },
    },
  },
})
