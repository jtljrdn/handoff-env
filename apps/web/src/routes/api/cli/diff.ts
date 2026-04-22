import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { getDecryptedKeyValuePairs } from '#/lib/services/variables'
import { logger, errCtx, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'cli.diff' })

export const Route = createFileRoute('/api/cli/diff')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now()
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { projectSlug, envName, variables } = body
        const localVars = variables as Record<string, string>

        const req = log.child({
          userId: cliAuth.userId,
          orgId: cliAuth.orgId,
          projectSlug,
          envName,
          localKeyCount: Object.keys(localVars ?? {}).length,
        })
        req.info('request')

        const project = await getProject(cliAuth.orgId, projectSlug)
        if (!project) {
          req.info('project.not_found')
          return notFound(`Project "${projectSlug}" not found`)
        }

        const env = await getEnvironmentByName(project.id, envName)
        if (!env) {
          req.info('env.not_found', { projectId: project.id })
          return notFound(`Environment "${envName}" not found`)
        }

        try {
          const remoteVars = await getDecryptedKeyValuePairs(
            env.id,
            cliAuth.orgId,
          )

          const remoteKeys = new Set(Object.keys(remoteVars))
          const localKeys = new Set(Object.keys(localVars))

          const added = [...localKeys].filter((k) => !remoteKeys.has(k))
          const removed = [...remoteKeys].filter((k) => !localKeys.has(k))
          const changed = [...localKeys].filter(
            (k) => remoteKeys.has(k) && localVars[k] !== remoteVars[k],
          )

          req.info('ok', {
            environmentId: env.id,
            added: added.length,
            removed: removed.length,
            changed: changed.length,
            durationMs: durationMs(startedAt),
          })

          return new Response(
            JSON.stringify({ data: { added, removed, changed } }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        } catch (err) {
          req.error(
            'failed',
            errCtx(err, {
              environmentId: env.id,
              durationMs: durationMs(startedAt),
            }),
          )
          throw err
        }
      },
    },
  },
})
