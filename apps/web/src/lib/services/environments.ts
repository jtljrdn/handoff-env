import { supabase } from '#/db'
import { assertCanCreateEnvironment } from '#/lib/billing/entitlements'
import { verifyProjectOrg } from '#/lib/services/projects'
import { nanoid } from 'nanoid'
import { logger, errCtx } from '#/lib/logger'
import type { CreateEnvironmentInput } from '@handoff-env/types'

const log = logger.child({ scope: 'service.environments' })

export async function verifyEnvironmentOrg(environmentId: string, orgId: string) {
  const env = await getEnvironment(environmentId)
  if (!env) throw new Error('Environment not found')
  await verifyProjectOrg(env.project_id, orgId)
  return env
}

export async function createEnvironment(
  projectId: string,
  orgId: string,
  input: CreateEnvironmentInput,
) {
  await assertCanCreateEnvironment(orgId, projectId)

  const { data: existing } = await supabase
    .from('environments')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', input.name)
    .limit(1)
    .single()

  if (existing) {
    log.info('create.duplicate_name', { projectId, orgId, name: input.name })
    throw new Error(
      `Environment "${input.name}" already exists in this project`,
    )
  }

  const { data: env, error } = await supabase
    .from('environments')
    .insert({
      id: nanoid(),
      name: input.name,
      project_id: projectId,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single()

  if (error) {
    log.error(
      'create.insert_failed',
      errCtx(error, { projectId, orgId, name: input.name }),
    )
    throw error
  }

  log.info('create.ok', {
    projectId,
    orgId,
    environmentId: env.id,
    name: env.name,
  })
  return env
}

export async function listEnvironments(projectId: string) {
  const { data, error } = await supabase
    .from('environments')
    .select()
    .eq('project_id', projectId)
    .order('sort_order')
    .order('name')

  if (error) throw error

  return data ?? []
}

export async function getEnvironment(envId: string) {
  const { data } = await supabase
    .from('environments')
    .select()
    .eq('id', envId)
    .limit(1)
    .single()

  return data ?? null
}

export async function getEnvironmentByName(
  projectId: string,
  envName: string,
) {
  const { data } = await supabase
    .from('environments')
    .select()
    .eq('project_id', projectId)
    .eq('name', envName)
    .limit(1)
    .single()

  return data ?? null
}

export async function deleteEnvironment(envId: string) {
  const { error } = await supabase
    .from('environments')
    .delete()
    .eq('id', envId)

  if (error) {
    log.error('delete.failed', errCtx(error, { environmentId: envId }))
    throw error
  }
  log.info('delete.ok', { environmentId: envId })
}

export async function reorderEnvironments(
  projectId: string,
  orderedIds: string[],
) {
  const { error } = await supabase.rpc('reorder_environments', {
    p_project_id: projectId,
    p_ordered_ids: orderedIds,
  })

  if (error) {
    log.error(
      'reorder.failed',
      errCtx(error, { projectId, count: orderedIds.length }),
    )
    throw error
  }
  log.info('reorder.ok', { projectId, count: orderedIds.length })
}
