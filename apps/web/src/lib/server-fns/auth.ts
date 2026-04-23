import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { pool } from '#/db/pool'
import { createResendContact } from '#/lib/email/create-contact'

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

export const createResendContactFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    try {
      await createResendContact({
        email: session.user.email,
        name: data.name,
      })
    } catch (err) {
      console.error('[Handoff] createResendContact failed:', err)
    }

    return { ok: true as const }
  })

export const checkEmailFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim()

    const userRes = await pool.query(
      'SELECT id FROM "user" WHERE lower(email) = $1 LIMIT 1',
      [email],
    )
    const isNewUser = userRes.rows.length === 0
    if (!isNewUser) return { isNewUser: false, isAllowed: true }

    const inviteRes = await pool.query(
      `SELECT 1 FROM signup_invite
        WHERE lower(email) = $1
          AND used_at IS NULL
          AND expires_at > now()
        LIMIT 1`,
      [email],
    )
    if ((inviteRes.rowCount ?? 0) > 0) return { isNewUser: true, isAllowed: true }

    const orgInviteRes = await pool.query(
      `SELECT 1 FROM invitation
        WHERE lower(email) = $1
          AND status = 'pending'
          AND "expiresAt" > now()
        LIMIT 1`,
      [email],
    )
    if ((orgInviteRes.rowCount ?? 0) > 0) {
      return { isNewUser: true, isAllowed: true }
    }

    return { isNewUser: true, isAllowed: false }
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
    let activeOrgId: string | null = session.session.activeOrganizationId ?? null

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
          role: ((session.user as { role?: string | null }).role ?? 'user') as
            | 'admin'
            | 'user',
        },
      },
      onboardingStatus: { hasOrganization: hasOrgs, activeOrgId },
    }
  },
)
