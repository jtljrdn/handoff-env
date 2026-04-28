import { createFileRoute } from '@tanstack/react-router'
import {
  requireCliAuth,
  requireCliPermission,
  notFound,
  forbidden,
} from '#/lib/middleware/auth'
import { getProject } from '#/lib/services/projects'
import { getEnvironmentByName } from '#/lib/services/environments'
import { getOrgPlan } from '#/lib/billing/entitlements'
import { createVariableShare } from '#/lib/services/variable-shares'
import { cliCreateVariableShareSchema } from '@handoff-env/types'
import { logger, durationMs, errCtx } from '#/lib/logger'

const log = logger.child({ scope: 'cli.share' })

function publicBaseUrl(request: Request): string {
  const envUrl = process.env.PUBLIC_BASE_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return 'https://gethandoff.dev'
  return `${proto}://${host}`
}

export const Route = createFileRoute('/api/cli/share')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const startedAt = performance.now()
        const cliAuth = await requireCliAuth(request)
        const req = log.child({
          userId: cliAuth.userId,
          orgId: cliAuth.orgId,
        })

        await requireCliPermission(cliAuth, 'variableShare', 'create')

        const plan = await getOrgPlan(cliAuth.orgId)
        if (plan !== 'team') {
          forbidden(
            'Variable sharing requires the Team plan. Upgrade at /billing to continue.',
          )
        }

        const raw = await request.json()
        const input = cliCreateVariableShareSchema.parse(raw)

        const project = await getProject(cliAuth.orgId, input.projectSlug)
        if (!project) return notFound(`Project "${input.projectSlug}" not found`)

        const env = await getEnvironmentByName(project.id, input.envName)
        if (!env) return notFound(`Environment "${input.envName}" not found`)

        try {
          const { id, expiresAt } = await createVariableShare(
            cliAuth.userId,
            cliAuth.orgId,
            {
              environmentId: env.id,
              label: input.key,
              pwSalt: input.pwSalt,
              kdfOpsLimit: input.kdfOpsLimit,
              kdfMemLimit: input.kdfMemLimit,
              wrapCiphertext: input.wrapCiphertext,
              wrapNonce: input.wrapNonce,
              ciphertext: input.ciphertext,
              nonce: input.nonce,
              ttlSeconds: input.ttlSeconds,
              maxViews: input.maxViews,
            },
            project.id,
          )

          const url = `${publicBaseUrl(request)}/s/${id}`

          req.info('ok', {
            shareId: id,
            projectId: project.id,
            environmentId: env.id,
            expiresAt,
            durationMs: durationMs(startedAt),
          })

          return new Response(
            JSON.stringify({ data: { id, url, expiresAt } }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        } catch (err) {
          req.error(
            'create.failed',
            errCtx(err, {
              projectId: project.id,
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
