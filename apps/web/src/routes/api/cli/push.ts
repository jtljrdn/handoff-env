import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { bulkUpsertVariables } from '#/lib/services/variables'
import { bulkUpsertVariablesSchema } from '@handoff-env/types'

export const Route = createFileRoute('/api/cli/push')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { projectSlug, envName, variables } = body

        const project = await getProject(cliAuth.orgId, projectSlug)
        if (!project) return notFound(`Project "${projectSlug}" not found`)

        const env = await getEnvironmentByName(project.id, envName)
        if (!env)
          return notFound(`Environment "${envName}" not found`)

        const entries = Object.entries(
          variables as Record<string, string>,
        ).map(([key, value]) => ({ key, value }))
        bulkUpsertVariablesSchema.parse(entries)

        const result = await bulkUpsertVariables(
          env.id,
          cliAuth.orgId,
          entries,
          cliAuth.userId,
        )

        return new Response(JSON.stringify({ data: result }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
