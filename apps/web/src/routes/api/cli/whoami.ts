import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth } from '#/lib/middleware/auth'
import { getOrgPlan } from '#/lib/billing/entitlements'
import { pool } from '#/db/pool'
import { logger, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'cli.whoami' })

export const Route = createFileRoute('/api/cli/whoami')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const startedAt = performance.now()
        const cliAuth = await requireCliAuth(request)
        const req = log.child({
          userId: cliAuth.userId,
          orgId: cliAuth.orgId,
        })
        req.info('request')

        const [userRes, orgRes, plan] = await Promise.all([
          pool.query(
            'SELECT id, email FROM "user" WHERE id = $1 LIMIT 1',
            [cliAuth.userId],
          ),
          pool.query(
            'SELECT id, slug, name FROM organization WHERE id = $1 LIMIT 1',
            [cliAuth.orgId],
          ),
          getOrgPlan(cliAuth.orgId),
        ])

        const user = userRes.rows[0]
        const org = orgRes.rows[0]

        if (!user || !org) {
          req.warn('not_found', {
            userMissing: !user,
            orgMissing: !org,
            durationMs: durationMs(startedAt),
          })
          return new Response(
            JSON.stringify({ error: 'User or organization not found', code: 'NOT_FOUND' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          )
        }

        req.info('ok', { plan, durationMs: durationMs(startedAt) })

        return new Response(
          JSON.stringify({
            data: {
              userId: user.id as string,
              email: user.email as string,
              orgId: org.id as string,
              orgSlug: org.slug as string,
              orgName: org.name as string,
              plan,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
