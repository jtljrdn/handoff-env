import { createFileRoute } from '@tanstack/react-router'
import { requireCliAuth, notFound } from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { getEncryptedVariables } from '#/lib/services/variables'
import { logger, errCtx, durationMs } from '#/lib/logger'

const log = logger.child({ scope: 'cli.pull' })

export const Route = createFileRoute('/api/cli/pull')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now()
        const cliAuth = await requireCliAuth(request)

        const body = await request.json()
        const { projectSlug, envName } = body
        const req = log.child({
          userId: cliAuth.userId,
          orgId: cliAuth.orgId,
          projectSlug,
          envName,
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
          const variables = await getEncryptedVariables(env.id, cliAuth.orgId)
          req.info('ok', {
            environmentId: env.id,
            keyCount: variables.length,
            durationMs: durationMs(startedAt),
          })
          return new Response(
            JSON.stringify({
              data: {
                environmentId: env.id,
                wrappedDek: cliAuth.wrappedDek,
                dekVersion: cliAuth.dekVersion,
                variables: variables.map((v) => ({
                  id: v.id,
                  key: v.key,
                  ciphertext: v.ciphertext,
                  nonce: v.nonce,
                  dekVersion: v.dekVersion,
                })),
              },
            }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        } catch (err) {
          req.error(
            'fetch.failed',
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
