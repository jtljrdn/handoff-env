import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { getRequest } from '@tanstack/react-start/server'
import { requireOrgSession } from '#/lib/middleware/auth'
import { getOrgPlan } from '#/lib/billing/entitlements'
import { getLimits } from '#/lib/billing/plans'
import { formatRelativeTime } from '#/lib/relative-time'
import {
  listAuditPage,
  listEnvironmentAuditRecent,
  listVariableAuditRecent,
  listAuditFacets,
  collectAuditExportRows,
  buildAuditCsv,
  type AuditAction,
  type AuditPageRow,
} from '#/lib/services/audit'

const AUDIT_ACTIONS: ReadonlyArray<AuditAction> = [
  'project.create',
  'project.delete',
  'environment.create',
  'environment.delete',
  'variable.create',
  'variable.update',
  'variable.delete',
  'variable.bulk',
  'token.create',
  'token.revoke',
  'variable.share.create',
  'variable.share.revoke',
  'variable.share.view',
  'member.remove',
  'member.revoke_sessions',
  'dek.rotation_enqueued',
  'dek.rotation_complete',
] as const

const auditActionSchema = z.enum(
  AUDIT_ACTIONS as readonly [AuditAction, ...AuditAction[]],
)

const cursorSchema = z
  .object({
    createdAt: z.string(),
    id: z.string(),
  })
  .nullable()

const filterShape = {
  projectId: z.string().nullish(),
  environmentId: z.string().nullish(),
  actorUserId: z.string().nullish(),
  actions: z.array(auditActionSchema).nullish(),
  targetKeySearch: z.string().nullish(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
}

const listAuditSchema = z.object({
  ...filterShape,
  cursor: cursorSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

export type ListAuditInput = z.input<typeof listAuditSchema>

function decoratePage<T extends AuditPageRow>(rows: T[]): Array<
  T & { createdAtLabel: string }
> {
  const now = Date.now()
  return rows.map((r) => ({ ...r, createdAtLabel: formatRelativeTime(r.createdAt, now) }))
}

export const listAuditFn = createServerFn({ method: 'GET' })
  .inputValidator((input: ListAuditInput) => listAuditSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    const plan = await getOrgPlan(user.orgId)
    const retentionDays = getLimits(plan).auditRetentionDays
    const page = await listAuditPage(
      {
        orgId: user.orgId,
        projectId: data.projectId ?? null,
        environmentId: data.environmentId ?? null,
        actorUserId: data.actorUserId ?? null,
        actions: data.actions ?? null,
        targetKeySearch: data.targetKeySearch ?? null,
        dateFrom: data.dateFrom ?? null,
        dateTo: data.dateTo ?? null,
      },
      {
        limit: data.limit ?? 50,
        cursor: data.cursor ?? null,
        retentionDays,
      },
    )
    return {
      ...page,
      rows: decoratePage(page.rows),
      plan,
    }
  })

export const listAuditFacetsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: { projectId?: string | null }) =>
    z.object({ projectId: z.string().nullish() }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    return listAuditFacets(user.orgId, data.projectId ?? null)
  })

const envRecentSchema = z.object({
  environmentId: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
})

export const listEnvironmentAuditFn = createServerFn({ method: 'GET' })
  .inputValidator((input: z.input<typeof envRecentSchema>) =>
    envRecentSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    const plan = await getOrgPlan(user.orgId)
    const retentionDays = getLimits(plan).auditRetentionDays
    const rows = await listEnvironmentAuditRecent(
      user.orgId,
      data.environmentId,
      retentionDays,
      data.limit ?? 10,
    )
    return decoratePage(rows)
  })

const variableRecentSchema = z.object({
  projectId: z.string().min(1),
  targetKey: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
})

export const listVariableAuditFn = createServerFn({ method: 'GET' })
  .inputValidator((input: z.input<typeof variableRecentSchema>) =>
    variableRecentSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    const plan = await getOrgPlan(user.orgId)
    const retentionDays = getLimits(plan).auditRetentionDays
    const rows = await listVariableAuditRecent(
      user.orgId,
      data.projectId,
      data.targetKey,
      retentionDays,
      data.limit ?? 10,
    )
    return decoratePage(rows)
  })

const exportSchema = z.object({
  ...filterShape,
})

export const exportAuditCsvFn = createServerFn({ method: 'POST' })
  .inputValidator((input: z.input<typeof exportSchema>) =>
    exportSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireOrgSession()
    const plan = await getOrgPlan(user.orgId)
    if (plan !== 'team') {
      throw new Response(
        JSON.stringify({
          error: 'Audit log export requires the Team plan.',
          code: 'PLAN_UPGRADE_REQUIRED',
          limit: 0,
          current: 0,
          resource: 'audit_export',
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const retentionDays = getLimits(plan).auditRetentionDays
    const rows = await collectAuditExportRows(
      {
        orgId: user.orgId,
        projectId: data.projectId ?? null,
        environmentId: data.environmentId ?? null,
        actorUserId: data.actorUserId ?? null,
        actions: data.actions ?? null,
        targetKeySearch: data.targetKeySearch ?? null,
        dateFrom: data.dateFrom ?? null,
        dateTo: data.dateTo ?? null,
      },
      retentionDays,
    )
    const csv = buildAuditCsv(rows)
    const orgSlug = await fetchOrgSlug(user.orgId)
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..*$/, '')
      .replace('T', '-')
    const filename = `handoff-audit-${orgSlug}-${stamp}.csv`
    return { filename, csv, count: rows.length }
  })

async function fetchOrgSlug(orgId: string): Promise<string> {
  try {
    const request = getRequest()
    const fullOrg = await auth.api.getFullOrganization({
      headers: request.headers,
      query: { organizationId: orgId },
    })
    return (fullOrg?.slug ?? fullOrg?.id ?? orgId).replace(/[^a-z0-9-]/gi, '')
  } catch {
    return orgId
  }
}
