import { createServerFn } from '@tanstack/react-start'
import { requireOrgSession } from '#/lib/middleware/auth'
import { auth } from '#/lib/auth'
import { pool } from '#/db/pool'
import { getRequest } from '@tanstack/react-start/server'
import { listProjects } from '#/lib/services/projects'
import { getOrgPlan } from '#/lib/billing/entitlements'
import { getLimits } from '#/lib/billing/plans'
import type { OrgRole } from '@handoff-env/types'

export const getDashboardDataFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await requireOrgSession()
    const request = getRequest()

    const fullOrg = await auth.api.getFullOrganization({
      headers: request.headers,
      query: { organizationId: user.orgId },
    })

    const projects = await listProjects(user.orgId)
    const plan = await getOrgPlan(user.orgId)
    const limits = getLimits(plan)
    const memberCount = fullOrg?.members?.length ?? 0
    const pendingInvites =
      fullOrg?.invitations?.filter((i) => i.status === 'pending').length ?? 0
    // Member limit counts both active members and pending invitations — same
    // rule the backend enforces in assertCanInviteMember.
    const memberSeatsUsed = memberCount + pendingInvites
    const atProjectLimit = projects.length >= limits.maxProjects
    const atMemberLimit = memberSeatsUsed >= limits.maxMembers

    const roleRes = await pool.query(
      'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
      [user.userId, user.orgId],
    )
    const currentUserRole = (roleRes.rows[0]?.role ?? 'member') as OrgRole

    const serializeLimit = (v: number) => (Number.isFinite(v) ? v : null)

    return {
      org: {
        id: user.orgId,
        name: fullOrg?.name ?? '',
        slug: fullOrg?.slug ?? '',
        memberCount,
      },
      plan,
      currentUserRole,
      atProjectLimit,
      atMemberLimit,
      usage: {
        projects: projects.length,
        memberSeats: memberSeatsUsed,
      },
      limits: {
        maxProjects: serializeLimit(limits.maxProjects),
        maxMembers: serializeLimit(limits.maxMembers),
      },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        environmentCount: p.environmentCount,
        createdAt: p.created_at,
      })),
    }
  })
