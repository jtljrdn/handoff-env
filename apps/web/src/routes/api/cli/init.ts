import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { listEnvironments } from '#/lib/services/environments'
import { logger, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'cli.init' })

export const Route = createFileRoute('/api/cli/init')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now()
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { projectSlug } = body
        const req = log.child({
          userId: cliAuth.userId,
          orgId: cliAuth.orgId,
          projectSlug,
        })
        req.info('request')

        const project = await getProject(cliAuth.orgId, projectSlug)
        if (!project) {
          req.info('project.not_found')
          return notFound(`Project "${projectSlug}" not found`)
        }

        const envs = await listEnvironments(project.id)
        req.info('ok', {
          projectId: project.id,
          envCount: envs.length,
          durationMs: durationMs(startedAt),
        })

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
