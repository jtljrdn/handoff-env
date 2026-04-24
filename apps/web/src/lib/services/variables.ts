import { pool } from '#/db/pool'
import { nanoid } from 'nanoid'
import { recordAudit } from '#/lib/services/audit'
import { logger, errCtx, durationMs } from '#/lib/logger'
import type { BulkUpsertEncryptedVariablesInput } from '@handoff-env/types'

const log = logger.child({ scope: 'service.variables' })

async function getEnvironmentProjectId(environmentId: string): Promise<string | null> {
  const r = await pool.query(
    'SELECT project_id FROM environments WHERE id = $1 LIMIT 1',
    [environmentId],
  )
  return (r.rows[0]?.project_id as string | undefined) ?? null
}

function bytesToBase64(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) {
      return Buffer.from(value.slice(2), 'hex').toString('base64')
    }
    return value
  }
  throw new Error(`Cannot encode ${typeof value} as base64`)
}

export interface EncryptedVariableEntry {
  id: string
  key: string
  ciphertext: string
  nonce: string
  dekVersion: number
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

export async function getVariableById(variableId: string) {
  const r = await pool.query(
    `SELECT id, key, ciphertext, nonce, dek_version, environment_id,
            updated_by, created_at, updated_at
       FROM variables WHERE id = $1 LIMIT 1`,
    [variableId],
  )
  return r.rows[0] ?? null
}

export async function getEncryptedVariables(
  environmentId: string,
  orgId: string,
): Promise<EncryptedVariableEntry[]> {
  try {
    const r = await pool.query(
      `SELECT id, key, ciphertext, nonce, dek_version,
              updated_by, created_at, updated_at
         FROM variables
        WHERE environment_id = $1
        ORDER BY key`,
      [environmentId],
    )
    log.debug('getEncryptedVariables.ok', {
      environmentId,
      orgId,
      count: r.rows.length,
    })
    return r.rows.map((row) => ({
      id: row.id,
      key: row.key,
      ciphertext: bytesToBase64(row.ciphertext),
      nonce: bytesToBase64(row.nonce),
      dekVersion: Number(row.dek_version),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    }))
  } catch (err) {
    log.error(
      'getEncryptedVariables.failed',
      errCtx(err, { environmentId, orgId }),
    )
    throw err
  }
}

export interface SetEncryptedVariableInput {
  key: string
  ciphertext: string
  nonce: string
  dekVersion: number
}

export async function setEncryptedVariable(
  environmentId: string,
  orgId: string,
  input: SetEncryptedVariableInput,
  userId: string,
) {
  const existingResult = await pool.query(
    `SELECT id, ciphertext, nonce, dek_version
       FROM variables
      WHERE environment_id = $1 AND key = $2
      LIMIT 1`,
    [environmentId, input.key],
  )
  const existing = existingResult.rows[0]

  if (existing) {
    const updated = await pool.query(
      `UPDATE variables
          SET ciphertext = decode($1, 'base64'),
              nonce = decode($2, 'base64'),
              dek_version = $3,
              updated_by = $4,
              updated_at = now()
        WHERE id = $5
        RETURNING id, key, ciphertext, nonce, dek_version, updated_by, created_at, updated_at`,
      [input.ciphertext, input.nonce, input.dekVersion, userId, existing.id],
    )

    await pool.query(
      `INSERT INTO variable_versions (
         id, variable_id,
         old_ciphertext, old_nonce, old_dek_version,
         new_ciphertext, new_nonce, new_dek_version,
         changed_by, action
       ) VALUES (
         $1, $2,
         $3, $4, $5,
         decode($6, 'base64'), decode($7, 'base64'), $8,
         $9, 'update'
       )`,
      [
        nanoid(),
        existing.id,
        existing.ciphertext,
        existing.nonce,
        existing.dek_version,
        input.ciphertext,
        input.nonce,
        input.dekVersion,
        userId,
      ],
    )

    log.info('setEncryptedVariable.updated', {
      environmentId,
      orgId,
      key: input.key,
      variableId: existing.id,
      userId,
    })

    void recordAudit({
      orgId,
      actorUserId: userId,
      action: 'variable.update',
      projectId: await getEnvironmentProjectId(environmentId),
      environmentId,
      targetKey: input.key,
    })

    return updated.rows[0]
  }

  const newId = nanoid()
  const created = await pool.query(
    `INSERT INTO variables (
       id, key, ciphertext, nonce, dek_version, environment_id, updated_by
     ) VALUES (
       $1, $2, decode($3, 'base64'), decode($4, 'base64'), $5, $6, $7
     )
     RETURNING id, key, ciphertext, nonce, dek_version, updated_by, created_at, updated_at`,
    [
      newId,
      input.key,
      input.ciphertext,
      input.nonce,
      input.dekVersion,
      environmentId,
      userId,
    ],
  )

  await pool.query(
    `INSERT INTO variable_versions (
       id, variable_id,
       new_ciphertext, new_nonce, new_dek_version,
       changed_by, action
     ) VALUES (
       $1, $2,
       decode($3, 'base64'), decode($4, 'base64'), $5,
       $6, 'create'
     )`,
    [
      nanoid(),
      newId,
      input.ciphertext,
      input.nonce,
      input.dekVersion,
      userId,
    ],
  )

  log.info('setEncryptedVariable.created', {
    environmentId,
    orgId,
    key: input.key,
    variableId: newId,
    userId,
  })

  void recordAudit({
    orgId,
    actorUserId: userId,
    action: 'variable.create',
    projectId: await getEnvironmentProjectId(environmentId),
    environmentId,
    targetKey: input.key,
  })

  return created.rows[0]
}

export async function deleteVariable(variableId: string, userId: string, orgId?: string) {
  const r = await pool.query(
    `SELECT id, key, environment_id, ciphertext, nonce, dek_version
       FROM variables WHERE id = $1 LIMIT 1`,
    [variableId],
  )
  const existing = r.rows[0]
  if (!existing) {
    log.warn('deleteVariable.not_found', { variableId, userId, orgId })
    return
  }

  await pool.query(
    `INSERT INTO variable_versions (
       id, variable_id,
       old_ciphertext, old_nonce, old_dek_version,
       changed_by, action
     ) VALUES ($1, $2, $3, $4, $5, $6, 'delete')`,
    [
      nanoid(),
      existing.id,
      existing.ciphertext,
      existing.nonce,
      existing.dek_version,
      userId,
    ],
  )

  await pool.query('DELETE FROM variables WHERE id = $1', [variableId])

  log.info('deleteVariable.ok', {
    variableId,
    userId,
    orgId,
    key: existing.key,
    environmentId: existing.environment_id,
  })

  if (orgId) {
    void recordAudit({
      orgId,
      actorUserId: userId,
      action: 'variable.delete',
      projectId: await getEnvironmentProjectId(existing.environment_id),
      environmentId: existing.environment_id,
      targetKey: existing.key,
    })
  }
}

export async function bulkUpsertEncryptedVariables(
  environmentId: string,
  orgId: string,
  input: BulkUpsertEncryptedVariablesInput,
  userId: string,
  mode: 'sync' | 'merge' = 'sync',
): Promise<{ created: number; updated: number; deleted: number }> {
  const startedAt = performance.now()

  if (mode === 'merge') {
    let created = 0
    let updated = 0
    for (const entry of input) {
      const existsResult = await pool.query(
        'SELECT id FROM variables WHERE environment_id = $1 AND key = $2 LIMIT 1',
        [environmentId, entry.key],
      )
      const wasExisting = existsResult.rows.length > 0
      await setEncryptedVariable(environmentId, orgId, entry, userId)
      if (wasExisting) updated++
      else created++
    }

    log.info('bulkUpsertEncryptedVariables.merge_ok', {
      environmentId,
      orgId,
      userId,
      inputCount: input.length,
      created,
      updated,
      durationMs: durationMs(startedAt),
    })

    return { created, updated, deleted: 0 }
  }

  const variables = input.map((v) => ({
    id: nanoid(),
    key: v.key,
    ciphertext: v.ciphertext,
    nonce: v.nonce,
    dek_version: v.dekVersion,
    version_id: nanoid(),
  }))

  const r = await pool.query(
    `SELECT bulk_upsert_variables($1, $2::jsonb, $3) AS result`,
    [environmentId, JSON.stringify(variables), userId],
  )

  const result = r.rows[0].result as { created: number; updated: number; deleted: number }

  log.info('bulkUpsertEncryptedVariables.ok', {
    environmentId,
    orgId,
    userId,
    inputCount: input.length,
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
    durationMs: durationMs(startedAt),
  })

  if (result.created + result.updated + result.deleted > 0) {
    void recordAudit({
      orgId,
      actorUserId: userId,
      action: 'variable.bulk',
      projectId: await getEnvironmentProjectId(environmentId),
      environmentId,
      metadata: result,
    })
  }

  return result
}

export async function getVariableHistory(
  variableId: string,
  retentionDays: number,
  limit = 50,
  offset = 0,
) {
  const params: Array<unknown> = [variableId]
  let where = 'variable_id = $1'
  if (Number.isFinite(retentionDays)) {
    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString()
    params.push(cutoff)
    where += ` AND changed_at >= $${params.length}`
  }
  params.push(limit, offset)

  const r = await pool.query(
    `SELECT id, variable_id, action, changed_by, changed_at,
            old_ciphertext, old_nonce, old_dek_version,
            new_ciphertext, new_nonce, new_dek_version
       FROM variable_versions
      WHERE ${where}
      ORDER BY changed_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  )

  return r.rows.map((row) => ({
    id: row.id,
    variableId: row.variable_id,
    action: row.action,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    oldCiphertext: row.old_ciphertext ? bytesToBase64(row.old_ciphertext) : null,
    oldNonce: row.old_nonce ? bytesToBase64(row.old_nonce) : null,
    oldDekVersion: row.old_dek_version,
    newCiphertext: row.new_ciphertext ? bytesToBase64(row.new_ciphertext) : null,
    newNonce: row.new_nonce ? bytesToBase64(row.new_nonce) : null,
    newDekVersion: row.new_dek_version,
  }))
}
