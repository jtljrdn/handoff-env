import { createServerFn } from '@tanstack/react-start'
import { requireOrgSession } from '#/lib/middleware/auth'
import { auth } from '#/lib/auth'
import { supabase } from '#/db'
import { pool } from '#/db/pool'
import { getRequest } from '@tanstack/react-start/server'
import { listProjects } from '#/lib/services/projects'
import { getOrgPlan } from '#/lib/billing/entitlements'
import { getLimits } from '#/lib/billing/plans'
import {
  listRecentActivity,
  listUserRecents,
  listProjectActivitySummaries,
} from '#/lib/services/audit'
import { formatRelativeTime, isFresh } from '#/lib/relative-time'
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
    const orgLogo = fullOrg?.logo ?? ''
    const pendingInvites =
      fullOrg?.invitations?.filter((i) => i.status === 'pending').length ?? 0
    const memberSeatsUsed = memberCount + pendingInvites
    const atProjectLimit = projects.length >= limits.maxProjects
    const atMemberLimit = memberSeatsUsed >= limits.maxMembers

    const roleRes = await pool.query(
      'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
      [user.userId, user.orgId],
    )
    const currentUserRole = (roleRes.rows[0]?.role ?? 'member') as OrgRole

    const projectIds = projects.map((p) => p.id)

    const variableCountMap = new Map<string, number>()
    if (projectIds.length > 0) {
      const { data: envRows } = await supabase
        .from('environments')
        .select('id, project_id')
        .in('project_id', projectIds)
      const envIds = (envRows ?? []).map((e) => e.id)
      const envToProject = new Map<string, string>()
      for (const e of envRows ?? []) envToProject.set(e.id, e.project_id)

      if (envIds.length > 0) {
        const { rows: countRows } = await pool.query(
          `SELECT environment_id, COUNT(*)::int AS c
             FROM variables WHERE environment_id = ANY($1::text[])
             GROUP BY environment_id`,
          [envIds],
        )
        for (const row of countRows) {
          const projectId = envToProject.get(row.environment_id as string)
          if (!projectId) continue
          variableCountMap.set(
            projectId,
            (variableCountMap.get(projectId) ?? 0) + (row.c as number),
          )
        }
      }
    }

    const activitySummaries = await listProjectActivitySummaries(user.orgId)

    const [recents, activity] = await Promise.all([
      listUserRecents(user.orgId, user.userId, 4),
      listRecentActivity(user.orgId, 20),
    ])

    // Pin a single "now" so all relative-time labels and fresh flags in this
    // response are coherent, which prevents server/client drift causing hydration
    // mismatches in the UI.
    const now = Date.now()

    const recentsWithCounts = await Promise.all(
      recents.map(async (r) => {
        const { count } = await supabase
          .from('variables')
          .select('id', { count: 'exact', head: true })
          .eq('environment_id', r.environmentId)
        return {
          projectId: r.projectId,
          projectName: r.projectName,
          projectSlug: r.projectSlug,
          environmentId: r.environmentId,
          environmentName: r.environmentName,
          variableCount: count ?? 0,
          lastActivityAt: r.lastActivityAt,
          lastActivityLabel: formatRelativeTime(r.lastActivityAt, now),
          isFresh: isFresh(r.lastActivityAt, 24, now),
        }
      }),
    )

    const serializeLimit = (v: number) => (Number.isFinite(v) ? v : null)

    return {
      org: {
        id: user.orgId,
        name: fullOrg?.name ?? '',
        logo: orgLogo,
      },
      plan,
      currentUserRole,
      atProjectLimit,
      atMemberLimit,
      limits: {
        maxProjects: serializeLimit(limits.maxProjects),
        maxMembers: serializeLimit(limits.maxMembers),
      },
      projects: projects.map((p) => {
        const summary = activitySummaries.get(p.id)
        const lastActivityAt = summary?.lastActivityAt ?? null
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          environmentCount: p.environmentCount,
          variableCount: variableCountMap.get(p.id) ?? 0,
          createdAt: p.created_at,
          lastActivityAt,
          lastActivityLabel: lastActivityAt
            ? formatRelativeTime(lastActivityAt, now)
            : 'No activity',
          lastActivityBy: summary
            ? {
                userId: summary.lastActorUserId,
                name: summary.lastActorName,
                email: summary.lastActorEmail,
              }
            : null,
        }
      }),
      recents: recentsWithCounts,
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        actor: {
          userId: a.actorUserId,
          name: a.actorName,
          email: a.actorEmail,
        },
        projectId: a.projectId,
        projectName: a.projectName,
        projectSlug: a.projectSlug,
        environmentName: a.environmentName,
        targetKey: a.targetKey,
        createdAt: a.createdAt,
        createdAtLabel: formatRelativeTime(a.createdAt, now),
      })),
    }
  })
