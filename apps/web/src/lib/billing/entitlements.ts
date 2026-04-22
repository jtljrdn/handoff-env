import { supabase } from '#/db'
import { pool } from '#/db/pool'
import {
  FREE_LIMITS,
  TEAM_INCLUDED_SEATS,
  TEAM_LIMITS,
  getLimits,
  type PlanLimits,
  type PlanName,
} from '#/lib/billing/plans'

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export async function getOrgPlan(orgId: string): Promise<PlanName> {
  const result = await pool.query(
    `SELECT status FROM subscription
     WHERE "referenceId" = $1 AND status = ANY($2::text[])
     ORDER BY "periodEnd" DESC NULLS LAST
     LIMIT 1`,
    [orgId, ['active', 'trialing', 'past_due']],
  )
  const row = result.rows[0]
  if (row && ACTIVE_STATUSES.has(row.status)) return 'team'
  return 'free'
}

export async function getOrgLimits(orgId: string): Promise<PlanLimits> {
  return getLimits(await getOrgPlan(orgId))
}

export { FREE_LIMITS, TEAM_LIMITS }

type LimitError = {
  error: string
  code: 'PLAN_LIMIT_REACHED' | 'PLAN_UPGRADE_REQUIRED'
  limit: number
  current: number
  resource: string
}

function paymentRequired(body: LimitError): never {
  throw new Response(JSON.stringify(body), {
    status: 402,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function assertCanCreateProject(orgId: string): Promise<void> {
  const limits = await getOrgLimits(orgId)
  if (!Number.isFinite(limits.maxProjects)) return

  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
  if (error) throw error

  const current = count ?? 0
  if (current >= limits.maxProjects) {
    paymentRequired({
      error: `Free plan allows ${limits.maxProjects} project${limits.maxProjects === 1 ? '' : 's'}. Upgrade to Team for unlimited.`,
      code: 'PLAN_LIMIT_REACHED',
      limit: limits.maxProjects,
      current,
      resource: 'project',
    })
  }
}

export async function assertCanCreateEnvironment(
  orgId: string,
  projectId: string,
): Promise<void> {
  const limits = await getOrgLimits(orgId)
  if (!Number.isFinite(limits.maxEnvironmentsPerProject)) return

  const { count, error } = await supabase
    .from('environments')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
  if (error) throw error

  const current = count ?? 0
  if (current >= limits.maxEnvironmentsPerProject) {
    paymentRequired({
      error: `Free plan allows ${limits.maxEnvironmentsPerProject} environments per project. Upgrade to Team for unlimited.`,
      code: 'PLAN_LIMIT_REACHED',
      limit: limits.maxEnvironmentsPerProject,
      current,
      resource: 'environment',
    })
  }
}

export async function assertCanInviteMember(orgId: string): Promise<void> {
  const limits = await getOrgLimits(orgId)
  if (!Number.isFinite(limits.maxMembers)) return

  const members = await pool.query(
    'SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1',
    [orgId],
  )
  const pending = await pool.query(
    `SELECT count(*)::int AS n FROM invitation
     WHERE "organizationId" = $1 AND status = 'pending'`,
    [orgId],
  )
  const current = (members.rows[0]?.n ?? 0) + (pending.rows[0]?.n ?? 0)

  if (current >= limits.maxMembers) {
    paymentRequired({
      error: `Free plan allows ${limits.maxMembers} members. Upgrade to Team for unlimited.`,
      code: 'PLAN_LIMIT_REACHED',
      limit: limits.maxMembers,
      current,
      resource: 'member',
    })
  }
}

export async function assertCanIncreaseBillableSeats(
  orgId: string,
  inviterRole: string,
): Promise<void> {
  if (inviterRole === 'owner') return

  const plan = await getOrgPlan(orgId)
  if (plan !== 'team') return

  const members = await pool.query(
    'SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1',
    [orgId],
  )
  const pending = await pool.query(
    `SELECT count(*)::int AS n FROM invitation
     WHERE "organizationId" = $1 AND status = 'pending'`,
    [orgId],
  )
  const nextSeats =
    (members.rows[0]?.n ?? 0) + (pending.rows[0]?.n ?? 0) + 1

  if (nextSeats > TEAM_INCLUDED_SEATS) {
    paymentRequired({
      error: `This invitation would require paying for an extra seat. Only the owner can authorize additional billable seats, so please ask them to invite this member.`,
      code: 'PLAN_UPGRADE_REQUIRED',
      limit: TEAM_INCLUDED_SEATS,
      current: nextSeats - 1,
      resource: 'seat',
    })
  }
}

export async function assertCliApiAccess(orgId: string): Promise<void> {
  const limits = await getOrgLimits(orgId)
  if (limits.cliApiAccess) return
  paymentRequired({
    error:
      'CLI and API access require the Team plan. Upgrade at /billing to continue.',
    code: 'PLAN_UPGRADE_REQUIRED',
    limit: 0,
    current: 0,
    resource: 'cli',
  })
}

export async function getOrgUsage(orgId: string) {
  const [projectsRes, membersRes, invitesRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId),
    pool.query(
      'SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1',
      [orgId],
    ),
    pool.query(
      `SELECT count(*)::int AS n FROM invitation
       WHERE "organizationId" = $1 AND status = 'pending'`,
      [orgId],
    ),
  ])
  if (projectsRes.error) throw projectsRes.error
  return {
    projects: projectsRes.count ?? 0,
    members: membersRes.rows[0]?.n ?? 0,
    pendingInvitations: invitesRes.rows[0]?.n ?? 0,
  }
}
