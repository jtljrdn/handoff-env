import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { listEnvironments } from '#/lib/services/environments'
import { auth } from '#/lib/auth'

export const Route = createFileRoute('/api/cli/init')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireCliAuth(request)

        const body = await request.json()
        const { orgSlug, projectSlug } = body

        const orgs = await auth.api.listOrganizations({
          headers: request.headers,
        })
        const org = (orgs as Array<{ id: string; slug: string; name: string }>).find(
          (o) => o.slug === orgSlug,
        )
        if (!org) return notFound(`Organization "${orgSlug}" not found`)

        const project = await getProject(org.id, projectSlug)
        if (!project) return notFound(`Project "${projectSlug}" not found`)

        const envs = await listEnvironments(project.id)

        return new Response(
          JSON.stringify({
            data: {
              orgSlug: org.slug,
              orgName: org.name,
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
