import { supabase } from '#/db'
import { assertCanCreateProject } from '#/lib/billing/entitlements'
import { createOrgEncryptionKey } from '#/lib/encryption'
import { DEFAULT_ENVIRONMENTS } from '@handoff-env/types'
import { nanoid } from 'nanoid'
import { recordAudit } from '#/lib/services/audit'
import { logger, errCtx } from '#/lib/logger'
import type { CreateProjectInput, UpdateProjectInput } from '@handoff-env/types'

const log = logger.child({ scope: 'service.projects' })

export async function verifyProjectOrg(projectId: string, orgId: string) {
  const project = await getProjectById(projectId)
  if (!project) throw new Error('Project not found')
  if (project.org_id !== orgId) throw new Error('Access denied')
  return project
}

export async function createProject(
  orgId: string,
  input: CreateProjectInput,
  actorUserId?: string,
) {
  await assertCanCreateProject(orgId)

  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('org_id', orgId)
    .eq('slug', input.slug)
    .limit(1)
    .single()

  if (existing) {
    log.info('create.duplicate_slug', { orgId, slug: input.slug })
    throw new Error(`Project with slug "${input.slug}" already exists in this organization`)
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      id: nanoid(),
      name: input.name,
      slug: input.slug,
      org_id: orgId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      log.info('create.duplicate_slug', { orgId, slug: input.slug })
      throw new Error(`Project with slug "${input.slug}" already exists in this organization`)
    }
    log.error('create.insert_failed', errCtx(error, { orgId, slug: input.slug }))
    throw error
  }

  const envValues = DEFAULT_ENVIRONMENTS.map((name: string, index: number) => ({
    id: nanoid(),
    name,
    project_id: project.id,
    sort_order: index,
  }))
  const { error: envError } = await supabase
    .from('environments')
    .insert(envValues)

  if (envError) {
    log.error(
      'create.env_seed_failed',
      errCtx(envError, { projectId: project.id, orgId }),
    )
    throw envError
  }

  const { data: existingKey } = await supabase
    .from('org_encryption_keys')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)
    .single()

  if (!existingKey) {
    log.info('create.provisioning_org_key', { orgId })
    await createOrgEncryptionKey(orgId)
  }

  log.info('create.ok', {
    orgId,
    projectId: project.id,
    slug: project.slug,
    actorUserId,
    envSeedCount: envValues.length,
  })

  if (actorUserId) {
    void recordAudit({
      orgId,
      actorUserId,
      action: 'project.create',
      projectId: project.id,
      targetKey: project.name,
    })
  }

  return project
}

export async function getProject(orgId: string, projectSlug: string) {
  const { data } = await supabase
    .from('projects')
    .select()
    .eq('org_id', orgId)
    .eq('slug', projectSlug)
    .limit(1)
    .single()

  return data ?? null
}

export async function getProjectById(projectId: string) {
  const { data } = await supabase
    .from('projects')
    .select()
    .eq('id', projectId)
    .limit(1)
    .single()

  return data ?? null
}

export async function listProjects(orgId: string) {
  const { data: projectRows, error } = await supabase
    .from('projects')
    .select('id, name, slug, org_id, created_at, updated_at')
    .eq('org_id', orgId)
    .order('name')

  if (error) throw error
  if (!projectRows || projectRows.length === 0) return []

  const projectIds = projectRows.map((p) => p.id)

  const { data: envRows, error: countError } = await supabase
    .from('environments')
    .select('project_id')
    .in('project_id', projectIds)

  if (countError) throw countError

  const countMap = new Map<string, number>()
  for (const row of envRows ?? []) {
    countMap.set(row.project_id, (countMap.get(row.project_id) ?? 0) + 1)
  }

  return projectRows.map((p) => ({
    ...p,
    environmentCount: countMap.get(p.id) ?? 0,
  }))
}

export async function updateProject(
  projectId: string,
  orgId: string,
  input: UpdateProjectInput,
) {
  if (input.slug) {
    const { data: existing } = await supabase
      .from('projects')
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', input.slug)
      .neq('id', projectId)
      .limit(1)
      .single()

    if (existing) {
      throw new Error(`Project with slug "${input.slug}" already exists in this organization`)
    }
  }

  const { data: updated, error } = await supabase
    .from('projects')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      log.info('update.duplicate_slug', { projectId, orgId, slug: input.slug })
      throw new Error(`Project with slug "${input.slug}" already exists in this organization`)
    }
    log.error('update.failed', errCtx(error, { projectId, orgId }))
    throw error
  }

  log.info('update.ok', { projectId, orgId, fields: Object.keys(input) })
  return updated ?? null
}

export async function deleteProject(projectId: string, orgId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('org_id', orgId)

  if (error) {
    log.error('delete.failed', errCtx(error, { projectId, orgId }))
    throw error
  }
  log.info('delete.ok', { projectId, orgId })
}
