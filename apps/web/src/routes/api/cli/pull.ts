import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { getDecryptedKeyValuePairs } from '#/lib/services/variables'

export const Route = createFileRoute('/api/cli/pull')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { projectSlug, envName } = body

        const project = await getProject(cliAuth.orgId, projectSlug)
        if (!project) return notFound(`Project "${projectSlug}" not found`)

        const env = await getEnvironmentByName(project.id, envName)
        if (!env)
          return notFound(`Environment "${envName}" not found`)

        const variables = await getDecryptedKeyValuePairs(env.id, cliAuth.orgId)

        return new Response(JSON.stringify({ data: variables }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
