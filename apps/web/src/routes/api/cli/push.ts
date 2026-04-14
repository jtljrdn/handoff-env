import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { bulkUpsertVariables } from '#/lib/services/variables'
import { bulkUpsertVariablesSchema } from '@handoff-env/types'
import { auth } from '#/lib/auth'

export const Route = createFileRoute('/api/cli/push')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { orgSlug, projectSlug, envName, variables } = body

        const orgs = await auth.api.listOrganizations({
          headers: request.headers,
        })
        const org = (orgs as Array<{ id: string; slug: string }>).find(
          (o) => o.slug === orgSlug,
        )
        if (!org) return notFound(`Organization "${orgSlug}" not found`)

        const project = await getProject(org.id, projectSlug)
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
          org.id,
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
