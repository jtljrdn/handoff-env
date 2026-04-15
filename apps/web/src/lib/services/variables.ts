import { supabase } from '#/db'
import {
  encryptValue,
  decryptValue,
  getOrgKey,
} from '#/lib/encryption'
import { nanoid } from 'nanoid'
import type { BulkUpsertVariablesInput } from '@handoff-env/types'

export interface VariableEntry {
  id: string
  key: string
  value?: string
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

export async function getVariables(
  environmentId: string,
  orgId: string,
  reveal: boolean,
): Promise<VariableEntry[]> {
  const { data: rows, error } = await supabase
    .from('variables')
    .select()
    .eq('environment_id', environmentId)
    .order('key')

  if (error) throw error
  if (!rows) return []

  if (!reveal) {
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    }))
  }

  const orgKey = await getOrgKey(orgId)

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    value: decryptValue(row.encrypted_value, row.iv, row.auth_tag, orgKey),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }))
}

export async function getDecryptedKeyValuePairs(
  environmentId: string,
  orgId: string,
): Promise<Record<string, string>> {
  const orgKey = await getOrgKey(orgId)

  const { data: rows, error } = await supabase
    .from('variables')
    .select()
    .eq('environment_id', environmentId)
    .order('key')

  if (error) throw error

  const result: Record<string, string> = {}
  for (const row of rows ?? []) {
    result[row.key] = decryptValue(
      row.encrypted_value,
      row.iv,
      row.auth_tag,
      orgKey,
    )
  }
  return result
}

export async function setVariable(
  environmentId: string,
  orgId: string,
  key: string,
  value: string,
  userId: string,
) {
  const orgKey = await getOrgKey(orgId)
  const encrypted = encryptValue(value, orgKey)

  const { data: existing } = await supabase
    .from('variables')
    .select()
    .eq('environment_id', environmentId)
    .eq('key', key)
    .limit(1)
    .single()

  if (existing) {
    const { data: updated, error } = await supabase
      .from('variables')
      .update({
        encrypted_value: encrypted.encryptedValue,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error

    const versionEncrypted = encryptValue(value, orgKey)
    const { error: versionError } = await supabase
      .from('variable_versions')
      .insert({
        id: nanoid(),
        variable_id: existing.id,
        encrypted_old_value: existing.encrypted_value,
        encrypted_new_value: versionEncrypted.encryptedValue,
        iv: versionEncrypted.iv,
        auth_tag: versionEncrypted.authTag,
        changed_by: userId,
        action: 'update',
      })

    if (versionError) throw versionError

    return updated
  }

  const newId = nanoid()
  const { data: created, error } = await supabase
    .from('variables')
    .insert({
      id: newId,
      key,
      encrypted_value: encrypted.encryptedValue,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      environment_id: environmentId,
      updated_by: userId,
    })
    .select()
    .single()

  if (error) throw error

  const versionEncrypted = encryptValue(value, orgKey)
  const { error: versionError } = await supabase
    .from('variable_versions')
    .insert({
      id: nanoid(),
      variable_id: newId,
      encrypted_new_value: versionEncrypted.encryptedValue,
      iv: versionEncrypted.iv,
      auth_tag: versionEncrypted.authTag,
      changed_by: userId,
      action: 'create',
    })

  if (versionError) throw versionError

  return created
}

export async function deleteVariable(variableId: string, userId: string) {
  const { data: existing } = await supabase
    .from('variables')
    .select()
    .eq('id', variableId)
    .limit(1)
    .single()

  if (!existing) return

  const { error: versionError } = await supabase
    .from('variable_versions')
    .insert({
      id: nanoid(),
      variable_id: existing.id,
      encrypted_old_value: existing.encrypted_value,
      encrypted_new_value: existing.encrypted_value,
      iv: existing.iv,
      auth_tag: existing.auth_tag,
      changed_by: userId,
      action: 'delete',
    })

  if (versionError) throw versionError

  const { error } = await supabase
    .from('variables')
    .delete()
    .eq('id', variableId)

  if (error) throw error
}

export async function bulkUpsertVariables(
  environmentId: string,
  orgId: string,
  input: BulkUpsertVariablesInput,
  userId: string,
): Promise<{ created: number; updated: number; deleted: number }> {
  const orgKey = await getOrgKey(orgId)

  const variables = input.map((v) => {
    const encrypted = encryptValue(v.value, orgKey)
    const versionEncrypted = encryptValue(v.value, orgKey)
    return {
      id: nanoid(),
      key: v.key,
      encrypted_value: encrypted.encryptedValue,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      version_id: nanoid(),
      version_encrypted_value: versionEncrypted.encryptedValue,
      version_iv: versionEncrypted.iv,
      version_auth_tag: versionEncrypted.authTag,
    }
  })

  const { data, error } = await supabase.rpc('bulk_upsert_variables', {
    p_environment_id: environmentId,
    p_variables: variables,
    p_user_id: userId,
  })

  if (error) throw error

  const result = data as { created: number; updated: number; deleted: number }
  return result
}

export async function getVariableHistory(
  variableId: string,
  limit = 50,
  offset = 0,
) {
  const { data, error } = await supabase
    .from('variable_versions')
    .select()
    .eq('variable_id', variableId)
    .order('changed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return data ?? []
}
