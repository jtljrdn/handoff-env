import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { pool } from '#/db/pool'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) return null

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
      },
    }
  },
)

export const checkEmailFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const result = await pool.query(
      'SELECT id FROM "user" WHERE email = $1 LIMIT 1',
      [data.email],
    )
    return { isNewUser: result.rows.length === 0 }
  })

export const getOnboardingStatusFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) return { hasOrganization: false, activeOrgId: null }

    const orgs = await auth.api.listOrganizations({
      headers: request.headers,
    })

    const hasOrgs = Array.isArray(orgs) && orgs.length > 0
    let activeOrgId = session.session.activeOrganizationId

    if (!activeOrgId && hasOrgs) {
      activeOrgId = orgs[0].id
      await auth.api.setActiveOrganization({
        headers: request.headers,
        body: { organizationId: activeOrgId },
      })
    }

    return {
      hasOrganization: hasOrgs,
      activeOrgId,
    }
  },
)

export const getAuthContextFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return {
        session: null,
        onboardingStatus: { hasOrganization: false, activeOrgId: null as string | null },
      }
    }

    const orgs = await auth.api.listOrganizations({
      headers: request.headers,
    })

    const hasOrgs = Array.isArray(orgs) && orgs.length > 0
    let activeOrgId: string | null = session.session.activeOrganizationId

    if (!activeOrgId && hasOrgs) {
      activeOrgId = orgs[0].id
      await auth.api.setActiveOrganization({
        headers: request.headers,
        body: { organizationId: activeOrgId },
      })
    }

    return {
      session: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image ?? null,
        },
      },
      onboardingStatus: { hasOrganization: hasOrgs, activeOrgId },
    }
  },
)
