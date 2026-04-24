import { createFileRoute } from '@tanstack/react-router'
import {
  requireCliAuth,
  assertCliTokenRewrapped,
  requireCliPermission,
  notFound,
} from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { bulkUpsertEncryptedVariables } from '#/lib/services/variables'
import { bulkUpsertEncryptedVariablesSchema } from '@handoff-env/types'
import { logger, errCtx, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'cli.push' })

export const Route = createFileRoute('/api/cli/push')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now()
        const cliAuth = await requireCliAuth(request)
        assertCliTokenRewrapped(cliAuth)
        await requireCliPermission(cliAuth, 'variable', 'delete')

        const body = await request.json()
        const { projectSlug, envName, entries } = body
        const req = log.child({
          userId: cliAuth.userId,
          orgId: cliAuth.orgId,
          projectSlug,
          envName,
          keyCount: Array.isArray(entries) ? entries.length : 0,
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

        const validated = bulkUpsertEncryptedVariablesSchema.parse(entries)

        try {
          const result = await bulkUpsertEncryptedVariables(
            env.id,
            cliAuth.orgId,
            validated,
            cliAuth.userId,
          )
          req.info('ok', {
            environmentId: env.id,
            created: result.created,
            updated: result.updated,
            deleted: result.deleted,
            durationMs: durationMs(startedAt),
          })
          return new Response(JSON.stringify({ data: result }), {
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          req.error(
            'bulk_upsert.failed',
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
