import { supabase } from '#/db'
import { nanoid } from 'nanoid'
import type { CreateEnvironmentInput } from '@handoff-env/types'

export async function createEnvironment(
  projectId: string,
  input: CreateEnvironmentInput,
) {
  const { data: existing } = await supabase
    .from('environments')
    .select('id')
    .eq('project_id', projectId)
    .eq('name', input.name)
    .limit(1)
    .single()

  if (existing) {
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

  if (error) throw error

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

  if (error) throw error
}

export async function reorderEnvironments(
  projectId: string,
  orderedIds: string[],
) {
  const { error } = await supabase.rpc('reorder_environments', {
    p_project_id: projectId,
    p_ordered_ids: orderedIds,
  })

  if (error) throw error
}
