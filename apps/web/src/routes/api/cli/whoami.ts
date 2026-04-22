import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth } from '#/lib/middleware/auth'
import { getOrgPlan } from '#/lib/billing/entitlements'
import { pool } from '#/db/pool'

export const Route = createFileRoute('/api/cli/whoami')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cliAuth = await requireCliAuth(request)

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
          return new Response(
            JSON.stringify({ error: 'User or organization not found', code: 'NOT_FOUND' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          )
        }

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
