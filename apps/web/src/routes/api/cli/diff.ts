import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { getDecryptedKeyValuePairs } from '#/lib/services/variables'

export const Route = createFileRoute('/api/cli/diff')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { projectSlug, envName, variables } = body
        const localVars = variables as Record<string, string>

        const project = await getProject(cliAuth.orgId, projectSlug)
        if (!project) return notFound(`Project "${projectSlug}" not found`)

        const env = await getEnvironmentByName(project.id, envName)
        if (!env)
          return notFound(`Environment "${envName}" not found`)

        const remoteVars = await getDecryptedKeyValuePairs(env.id, cliAuth.orgId)

        const remoteKeys = new Set(Object.keys(remoteVars))
        const localKeys = new Set(Object.keys(localVars))

        const added = [...localKeys].filter((k) => !remoteKeys.has(k))
        const removed = [...remoteKeys].filter((k) => !localKeys.has(k))
        const changed = [...localKeys].filter(
          (k) => remoteKeys.has(k) && localVars[k] !== remoteVars[k],
        )

        return new Response(
          JSON.stringify({ data: { added, removed, changed } }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
