import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { createProject } from '#/lib/services/projects'
import { listEnvironments } from '#/lib/services/environments'
import { getEnvironmentByName } from '#/lib/services/environments'
import { bulkUpsertVariables } from '#/lib/services/variables'
import { parseEnvText } from '@handoff-env/types'
import { pool } from '#/db/pool'

async function requireSession() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('Unauthorized')
  return { session, request }
}

export const createOnboardingProjectFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { name: string; slug: string }) => input)
  .handler(async ({ data }) => {
    const { session } = await requireSession()

    const activeOrgId = session.session.activeOrganizationId
    if (!activeOrgId) throw new Error('No active organization')

    const project = await createProject(activeOrgId, {
      name: data.name,
      slug: data.slug,
    })

    const environments = await listEnvironments(project.id)

    return {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
      },
      environments: environments.map((env) => ({
        id: env.id,
        name: env.name,
      })),
    }
  })

export const pasteEnvVariablesFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { projectId: string; environmentName: string; envText: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const { session } = await requireSession()

    const activeOrgId = session.session.activeOrganizationId
    if (!activeOrgId) throw new Error('No active organization')

    const environment = await getEnvironmentByName(
      data.projectId,
      data.environmentName,
    )
    if (!environment) throw new Error(`Environment "${data.environmentName}" not found`)

    const entries = parseEnvText(data.envText)
    if (entries.length === 0) return { created: 0, updated: 0, deleted: 0 }

    const variables = entries.map((entry) => ({
      key: entry.key,
      value: entry.value,
    }))

    const result = await bulkUpsertVariables(
      environment.id,
      activeOrgId,
      variables,
      session.user.id,
    )

    return result
  })

export const getInvitationDetailsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { invitationId: string }) => input)
  .handler(async ({ data }) => {
    const result = await pool.query(
      `SELECT i.id, i.email, i.role, i.status, i."expiresAt", i."organizationId",
              o.name as org_name, o.slug as org_slug
       FROM invitation i
       JOIN organization o ON o.id = i."organizationId"
       WHERE i.id = $1
       LIMIT 1`,
      [data.invitationId],
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      id: row.id as string,
      email: row.email as string,
      role: row.role as string,
      status: row.status as string,
      expiresAt: row.expiresAt as string,
      orgName: row.org_name as string,
      orgSlug: row.org_slug as string,
    }
  })
