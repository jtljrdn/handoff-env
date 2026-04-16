import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'
import { verifyEnvironmentOrg } from '#/lib/services/environments'
import { getDecryptedKeyValuePairs } from '#/lib/services/variables'

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
        const session = await auth.api.getSession({
          headers: request.headers,
        })
        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 })
        }

        const orgId = session.session.activeOrganizationId
        if (!orgId) {
          return new Response('No active organization', { status: 403 })
        }

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

        return new Response(content, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        })
      },
    },
  },
})
