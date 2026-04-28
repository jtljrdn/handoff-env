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
