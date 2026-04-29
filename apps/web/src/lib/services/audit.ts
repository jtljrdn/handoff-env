import { pool } from '#/db/pool'
import { nanoid } from 'nanoid'
import { logger, errCtx } from '#/lib/logger'

const log = logger.child({ scope: 'service.audit' })

export type AuditAction =
  | 'project.create'
  | 'project.delete'
  | 'environment.create'
  | 'environment.delete'
  | 'variable.create'
  | 'variable.update'
  | 'variable.delete'
  | 'variable.bulk'
  | 'token.create'
  | 'token.revoke'
  | 'variable.share.create'
  | 'variable.share.revoke'
  | 'variable.share.view'
  | 'member.remove'
  | 'member.revoke_sessions'
  | 'dek.rotation_enqueued'
  | 'dek.rotation_complete'

export interface AuditEntry {
  orgId: string
  actorUserId: string
  action: AuditAction
  projectId?: string | null
  environmentId?: string | null
  targetKey?: string | null
  metadata?: Record<string, unknown>
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log
         (id, org_id, project_id, environment_id, actor_user_id, action, target_key, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        nanoid(),
        entry.orgId,
        entry.projectId ?? null,
        entry.environmentId ?? null,
        entry.actorUserId,
        entry.action,
        entry.targetKey ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ],
    )
    log.debug('record.ok', {
      orgId: entry.orgId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      projectId: entry.projectId ?? null,
      environmentId: entry.environmentId ?? null,
      targetKey: entry.targetKey ?? null,
    })
  } catch (err) {
    log.error(
      'record.failed',
      errCtx(err, {
        orgId: entry.orgId,
        actorUserId: entry.actorUserId,
        action: entry.action,
      }),
    )
  }
}

export interface ActivityRow {
  id: string
  action: AuditAction
  actorUserId: string
  actorName: string | null
  actorEmail: string | null
  projectId: string | null
  projectName: string | null
  projectSlug: string | null
  environmentName: string | null
  targetKey: string | null
  createdAt: string
}

export async function listRecentActivity(
  orgId: string,
  limit = 20,
): Promise<ActivityRow[]> {
  const result = await pool.query(
    `SELECT a.id, a.action, a.actor_user_id, a.target_key, a.created_at,
            a.project_id, a.environment_id,
            p.name AS project_name, p.slug AS project_slug,
            e.name AS environment_name,
            u.name AS actor_name, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN projects p ON p.id = a.project_id
       LEFT JOIN environments e ON e.id = a.environment_id
       LEFT JOIN "user" u ON u.id = a.actor_user_id
      WHERE a.org_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2`,
    [orgId, limit],
  )
  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name ?? null,
    actorEmail: row.actor_email ?? null,
    projectId: row.project_id ?? null,
    projectName: row.project_name ?? null,
    projectSlug: row.project_slug ?? null,
    environmentName: row.environment_name ?? null,
    targetKey: row.target_key ?? null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }))
}

export interface RecentAccessRow {
  projectId: string
  projectName: string
  projectSlug: string
  environmentId: string
  environmentName: string
  lastActivityAt: string
}

export async function listUserRecents(
  orgId: string,
  userId: string,
  limit = 4,
): Promise<RecentAccessRow[]> {
  const result = await pool.query(
    `SELECT DISTINCT ON (a.project_id, a.environment_id)
            a.project_id, a.environment_id, a.created_at,
            p.name AS project_name, p.slug AS project_slug,
            e.name AS environment_name
       FROM audit_log a
       JOIN projects p ON p.id = a.project_id
       JOIN environments e ON e.id = a.environment_id
      WHERE a.org_id = $1
        AND a.actor_user_id = $2
        AND a.project_id IS NOT NULL
        AND a.environment_id IS NOT NULL
      ORDER BY a.project_id, a.environment_id, a.created_at DESC`,
    [orgId, userId],
  )
  const rows: RecentAccessRow[] = result.rows.map((row) => ({
    projectId: row.project_id,
    projectName: row.project_name,
    projectSlug: row.project_slug,
    environmentId: row.environment_id,
    environmentName: row.environment_name,
    lastActivityAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }))
  rows.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
  return rows.slice(0, limit)
}

export interface AuditFilter {
  orgId: string
  projectId?: string | null
  environmentId?: string | null
  actorUserId?: string | null
  actions?: AuditAction[] | null
  targetKeySearch?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

export interface AuditCursor {
  createdAt: string
  id: string
}

export type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | AuditMetadataValue[]
  | { [key: string]: AuditMetadataValue }

export interface AuditPageRow extends ActivityRow {
  environmentId: string | null
  metadata: { [key: string]: AuditMetadataValue } | null
}

export interface AuditPage {
  rows: AuditPageRow[]
  nextCursor: AuditCursor | null
  retentionDays: number
  retentionCutoff: string
  hasLockedBeyondRetention: boolean
  lockedRowCountEstimate: number
}

export interface AuditPageOpts {
  limit: number
  cursor?: AuditCursor | null
  retentionDays: number
}

const MAX_LOCKED_COUNT_SCAN = 1000
const MAX_RETENTION_DAYS = 180

function buildAuditWhere(
  filter: AuditFilter,
  startParamIndex: number,
): { sql: string; params: unknown[] } {
  const params: unknown[] = []
  const clauses: string[] = []

  params.push(filter.orgId)
  clauses.push(`a.org_id = $${startParamIndex + params.length - 1}`)

  if (filter.projectId) {
    params.push(filter.projectId)
    clauses.push(`a.project_id = $${startParamIndex + params.length - 1}`)
  }
  if (filter.environmentId) {
    params.push(filter.environmentId)
    clauses.push(`a.environment_id = $${startParamIndex + params.length - 1}`)
  }
  if (filter.actorUserId) {
    params.push(filter.actorUserId)
    clauses.push(`a.actor_user_id = $${startParamIndex + params.length - 1}`)
  }
  if (filter.actions && filter.actions.length > 0) {
    params.push(filter.actions)
    clauses.push(`a.action = ANY($${startParamIndex + params.length - 1}::text[])`)
  }
  if (filter.targetKeySearch && filter.targetKeySearch.trim().length > 0) {
    params.push(`%${filter.targetKeySearch.trim()}%`)
    clauses.push(`a.target_key ILIKE $${startParamIndex + params.length - 1}`)
  }
  if (filter.dateFrom) {
    params.push(filter.dateFrom)
    clauses.push(`a.created_at >= $${startParamIndex + params.length - 1}::timestamptz`)
  }
  if (filter.dateTo) {
    params.push(filter.dateTo)
    clauses.push(`a.created_at <= $${startParamIndex + params.length - 1}::timestamptz`)
  }

  return { sql: clauses.join(' AND '), params }
}

export async function listAuditPage(
  filter: AuditFilter,
  opts: AuditPageOpts,
): Promise<AuditPage> {
  const retentionDays = Math.min(
    Math.max(opts.retentionDays, 0),
    MAX_RETENTION_DAYS,
  )
  const retentionCutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  const where = buildAuditWhere(filter, 1)
  const params = [...where.params]

  let cutoffClause = `a.created_at >= $${params.length + 1}::timestamptz`
  params.push(retentionCutoff)

  if (opts.cursor) {
    params.push(opts.cursor.createdAt)
    params.push(opts.cursor.id)
    cutoffClause += ` AND (a.created_at, a.id) < ($${params.length - 1}::timestamptz, $${params.length})`
  }

  const limit = Math.min(Math.max(opts.limit, 1), 100)
  params.push(limit + 1)
  const limitParam = `$${params.length}`

  const result = await pool.query(
    `SELECT a.id, a.action, a.actor_user_id, a.target_key, a.created_at,
            a.project_id, a.environment_id, a.metadata,
            p.name AS project_name, p.slug AS project_slug,
            e.name AS environment_name,
            u.name AS actor_name, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN projects p ON p.id = a.project_id
       LEFT JOIN environments e ON e.id = a.environment_id
       LEFT JOIN "user" u ON u.id = a.actor_user_id
      WHERE ${where.sql} AND ${cutoffClause}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${limitParam}`,
    params,
  )

  const allRows = result.rows
  const hasMore = allRows.length > limit
  const sliced = hasMore ? allRows.slice(0, limit) : allRows

  const rows: AuditPageRow[] = sliced.map(rowToAuditPageRow)
  const last = sliced[sliced.length - 1]
  const nextCursor: AuditCursor | null =
    hasMore && last
      ? {
          createdAt:
            last.created_at instanceof Date
              ? last.created_at.toISOString()
              : String(last.created_at),
          id: last.id,
        }
      : null

  let hasLockedBeyondRetention = false
  let lockedRowCountEstimate = 0

  if (retentionDays < MAX_RETENTION_DAYS) {
    const lockedFloor = new Date(
      Date.now() - MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()
    const lockedWhere = buildAuditWhere(filter, 1)
    const lockedParams = [
      ...lockedWhere.params,
      retentionCutoff,
      lockedFloor,
      MAX_LOCKED_COUNT_SCAN,
    ]
    const lockedRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM (
         SELECT 1 FROM audit_log a
          WHERE ${lockedWhere.sql}
            AND a.created_at < $${lockedWhere.params.length + 1}::timestamptz
            AND a.created_at >= $${lockedWhere.params.length + 2}::timestamptz
          LIMIT $${lockedWhere.params.length + 3}
       ) s`,
      lockedParams,
    )
    lockedRowCountEstimate = lockedRes.rows[0]?.n ?? 0
    hasLockedBeyondRetention = lockedRowCountEstimate > 0
  }

  return {
    rows,
    nextCursor,
    retentionDays,
    retentionCutoff,
    hasLockedBeyondRetention,
    lockedRowCountEstimate,
  }
}

function rowToAuditPageRow(row: Record<string, unknown>): AuditPageRow {
  const metadata =
    row.metadata && typeof row.metadata === 'object'
      ? (row.metadata as { [key: string]: AuditMetadataValue })
      : null
  return {
    id: row.id as string,
    action: row.action as AuditAction,
    actorUserId: row.actor_user_id as string,
    actorName: (row.actor_name as string | null) ?? null,
    actorEmail: (row.actor_email as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    projectName: (row.project_name as string | null) ?? null,
    projectSlug: (row.project_slug as string | null) ?? null,
    environmentName: (row.environment_name as string | null) ?? null,
    environmentId: (row.environment_id as string | null) ?? null,
    targetKey: (row.target_key as string | null) ?? null,
    metadata,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }
}

export async function listEnvironmentAuditRecent(
  orgId: string,
  environmentId: string,
  retentionDays: number,
  limit = 10,
): Promise<AuditPageRow[]> {
  const cutoff = new Date(
    Date.now() - Math.min(Math.max(retentionDays, 0), MAX_RETENTION_DAYS) * 24 * 60 * 60 * 1000,
  ).toISOString()
  const result = await pool.query(
    `SELECT a.id, a.action, a.actor_user_id, a.target_key, a.created_at,
            a.project_id, a.environment_id, a.metadata,
            p.name AS project_name, p.slug AS project_slug,
            e.name AS environment_name,
            u.name AS actor_name, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN projects p ON p.id = a.project_id
       LEFT JOIN environments e ON e.id = a.environment_id
       LEFT JOIN "user" u ON u.id = a.actor_user_id
      WHERE a.org_id = $1
        AND a.environment_id = $2
        AND a.created_at >= $3::timestamptz
      ORDER BY a.created_at DESC
      LIMIT $4`,
    [orgId, environmentId, cutoff, Math.min(Math.max(limit, 1), 50)],
  )
  return result.rows.map(rowToAuditPageRow)
}

export async function listVariableAuditRecent(
  orgId: string,
  projectId: string,
  targetKey: string,
  retentionDays: number,
  limit = 10,
): Promise<AuditPageRow[]> {
  const cutoff = new Date(
    Date.now() - Math.min(Math.max(retentionDays, 0), MAX_RETENTION_DAYS) * 24 * 60 * 60 * 1000,
  ).toISOString()
  const result = await pool.query(
    `SELECT a.id, a.action, a.actor_user_id, a.target_key, a.created_at,
            a.project_id, a.environment_id, a.metadata,
            p.name AS project_name, p.slug AS project_slug,
            e.name AS environment_name,
            u.name AS actor_name, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN projects p ON p.id = a.project_id
       LEFT JOIN environments e ON e.id = a.environment_id
       LEFT JOIN "user" u ON u.id = a.actor_user_id
      WHERE a.org_id = $1
        AND a.project_id = $2
        AND a.target_key = $3
        AND a.created_at >= $4::timestamptz
      ORDER BY a.created_at DESC
      LIMIT $5`,
    [orgId, projectId, targetKey, cutoff, Math.min(Math.max(limit, 1), 50)],
  )
  return result.rows.map(rowToAuditPageRow)
}

export interface AuditFacets {
  members: Array<{ id: string; name: string | null; email: string | null }>
  projects: Array<{ id: string; name: string; slug: string }>
  environments: Array<{ id: string; name: string; projectId: string }>
}

export async function listAuditFacets(
  orgId: string,
  projectId?: string | null,
): Promise<AuditFacets> {
  const memberQ = pool.query(
    `SELECT u.id, u.name, u.email
       FROM "user" u
       JOIN member m ON m."userId" = u.id
      WHERE m."organizationId" = $1
      ORDER BY COALESCE(u.name, u.email)`,
    [orgId],
  )

  const projectQ = pool.query(
    `SELECT id, name, slug FROM projects
      WHERE org_id = $1
      ORDER BY name`,
    [orgId],
  )

  const envParams = projectId ? [orgId, projectId] : [orgId]
  const envQ = pool.query(
    projectId
      ? `SELECT e.id, e.name, e.project_id
           FROM environments e
           JOIN projects p ON p.id = e.project_id
          WHERE p.org_id = $1 AND e.project_id = $2
          ORDER BY e.name`
      : `SELECT e.id, e.name, e.project_id
           FROM environments e
           JOIN projects p ON p.id = e.project_id
          WHERE p.org_id = $1
          ORDER BY e.name`,
    envParams,
  )

  const [members, projects, envs] = await Promise.all([memberQ, projectQ, envQ])
  return {
    members: members.rows.map((r) => ({
      id: r.id,
      name: r.name ?? null,
      email: r.email ?? null,
    })),
    projects: projects.rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
    })),
    environments: envs.rows.map((r) => ({
      id: r.id,
      name: r.name,
      projectId: r.project_id,
    })),
  }
}

export interface CsvRow extends AuditPageRow {}

export function buildAuditCsv(rows: CsvRow[]): string {
  const header = [
    'created_at',
    'action',
    'actor_email',
    'actor_name',
    'project_name',
    'environment_name',
    'target_key',
    'metadata_json',
  ]
  const lines = [header.map(csvEscape).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.createdAt,
        r.action,
        r.actorEmail ?? '',
        r.actorName ?? '',
        r.projectName ?? '',
        r.environmentName ?? '',
        r.targetKey ?? '',
        r.metadata ? JSON.stringify(r.metadata) : '',
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return lines.join('\n')
}

function csvEscape(value: string): string {
  if (value === '' || value == null) return ''
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function collectAuditExportRows(
  filter: AuditFilter,
  retentionDays: number,
  hardCap = 10_000,
): Promise<AuditPageRow[]> {
  const rows: AuditPageRow[] = []
  let cursor: AuditCursor | null = null
  while (rows.length < hardCap) {
    const page: AuditPage = await listAuditPage(filter, {
      limit: 100,
      cursor,
      retentionDays,
    })
    rows.push(...page.rows)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return rows.slice(0, hardCap)
}

export interface ProjectActivitySummary {
  projectId: string
  lastActivityAt: string
  lastActorUserId: string
  lastActorName: string | null
  lastActorEmail: string | null
}

export async function listProjectActivitySummaries(
  orgId: string,
): Promise<Map<string, ProjectActivitySummary>> {
  const result = await pool.query(
    `SELECT DISTINCT ON (a.project_id)
            a.project_id, a.created_at, a.actor_user_id,
            u.name AS actor_name, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN "user" u ON u.id = a.actor_user_id
      WHERE a.org_id = $1
        AND a.project_id IS NOT NULL
      ORDER BY a.project_id, a.created_at DESC`,
    [orgId],
  )
  const map = new Map<string, ProjectActivitySummary>()
  for (const row of result.rows) {
    map.set(row.project_id, {
      projectId: row.project_id,
      lastActivityAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      lastActorUserId: row.actor_user_id,
      lastActorName: row.actor_name ?? null,
      lastActorEmail: row.actor_email ?? null,
    })
  }
  return map
}
