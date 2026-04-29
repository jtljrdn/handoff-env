import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { hostname } from 'node:os'
import { auth } from '#/lib/auth'
import { pool } from '#/db/pool'
import { createApiToken } from '#/lib/services/api-tokens'
import {
  assertCanCreateApiToken,
  getOrgApiTokenCount,
  getOrgPlan,
} from '#/lib/billing/entitlements'
import { getLimits } from '#/lib/billing/plans'

const mintInput = z.object({
  state: z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/, 'Invalid state'),
  port: z.number().int().min(1).max(65535),
  orgId: z.string().min(1),
  hostname: z.string().min(1).max(100).optional(),
  hashedToken: z.string().min(1),
  prefix: z.string().min(1).max(64),
  tokenPublicKey: z.string().min(1),
  wrappedDek: z.string().min(1),
  dekVersion: z.number().int().positive(),
})

export interface CliAuthorizeOrg {
  id: string
  slug: string
  name: string
  role: string
  plan: 'free' | 'team'
  tokenCount: number
  maxApiTokens: number
}

export type CliAuthorizeContext =
  | { signedIn: false }
  | {
      signedIn: true
      user: { email: string; name: string }
      orgs: CliAuthorizeOrg[]
      activeOrgId: string | null
    }

export const getCliAuthorizeContextFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CliAuthorizeContext> => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) return { signedIn: false }

    const orgs = await auth.api.listOrganizations({ headers: request.headers })
    if (!Array.isArray(orgs) || orgs.length === 0) {
      return {
        signedIn: true,
        user: { email: session.user.email, name: session.user.name },
        orgs: [],
        activeOrgId: null,
      }
    }

    // Fetch role for this user in every org, plus plan and token usage, in parallel.
    const userId = session.user.id
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const [roleRes, plan, tokenCount] = await Promise.all([
          pool.query(
            'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
            [userId, org.id],
          ),
          getOrgPlan(org.id),
          getOrgApiTokenCount(org.id),
        ])
        const role = roleRes.rows[0]?.role as string | undefined
        if (!role) return null
        return {
          id: org.id,
          slug: org.slug,
          name: org.name,
          role,
          plan,
          tokenCount,
          maxApiTokens: getLimits(plan).maxApiTokens,
        } satisfies CliAuthorizeOrg
      }),
    )
    const memberOrgs = enriched.filter((o): o is CliAuthorizeOrg => o !== null)

    return {
      signedIn: true,
      user: { email: session.user.email, name: session.user.name },
      orgs: memberOrgs,
      activeOrgId: session.session.activeOrganizationId ?? null,
    }
  },
)

export const mintCliTokenFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => mintInput.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      throw new Error('Not signed in.')
    }

    // Verify the caller is actually a member of the org they're minting for.
    const memberRes = await pool.query(
      'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
      [session.user.id, data.orgId],
    )
    if (memberRes.rows.length === 0) {
      throw new Error('You are not a member of that organization.')
    }

    await assertCanCreateApiToken(data.orgId)

    // Sync the web session's active org to what the user just authorized as,
    // so the dashboard and CLI agree on "which org am I in right now".
    if (session.session.activeOrganizationId !== data.orgId) {
      await auth.api.setActiveOrganization({
        headers: request.headers,
        body: { organizationId: data.orgId },
      })
    }

    const tokenName = `CLI · ${data.hostname ?? hostname()}`
    await createApiToken(session.user.id, data.orgId, {
      name: tokenName.slice(0, 100),
      expiresInDays: undefined,
      hashedToken: data.hashedToken,
      prefix: data.prefix,
      tokenPublicKey: data.tokenPublicKey,
      wrappedDek: data.wrappedDek,
      dekVersion: data.dekVersion,
    })

    return { state: data.state, port: data.port, orgId: data.orgId }
  })
