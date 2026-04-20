import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { listEnvironments } from '#/lib/services/environments'

export const Route = createFileRoute('/api/cli/init')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { projectSlug } = body

        const project = await getProject(cliAuth.orgId, projectSlug)
        if (!project) return notFound(`Project "${projectSlug}" not found`)

        const envs = await listEnvironments(project.id)

        return new Response(
          JSON.stringify({
            data: {
              orgId: cliAuth.orgId,
              projectSlug: project.slug,
              projectName: project.name,
              environments: envs.map((e) => e.name),
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
