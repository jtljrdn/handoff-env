import { db } from '#/db'
import { variables, variableVersions } from '#/db/schema'
import {
  encryptValue,
  decryptValue,
  getOrgKey,
} from '#/lib/encryption'
import { eq, and, desc, sql } from 'drizzle-orm'
import type { BulkUpsertVariablesInput } from '@handoff-env/types'

export interface VariableEntry {
  id: string
  key: string
  value?: string
  createdAt: Date
  updatedAt: Date
  updatedBy: string | null
}

export async function getVariables(
  environmentId: string,
  orgId: string,
  reveal: boolean,
): Promise<VariableEntry[]> {
  const rows = await db
    .select()
    .from(variables)
    .where(eq(variables.environmentId, environmentId))
    .orderBy(variables.key)

  if (!reveal) {
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    }))
  }

  const orgKey = await getOrgKey(orgId)

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    value: decryptValue(row.encryptedValue, row.iv, row.authTag, orgKey),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  }))
}

export async function getDecryptedKeyValuePairs(
  environmentId: string,
  orgId: string,
): Promise<Record<string, string>> {
  const orgKey = await getOrgKey(orgId)

  const rows = await db
    .select()
    .from(variables)
    .where(eq(variables.environmentId, environmentId))
    .orderBy(variables.key)

  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = decryptValue(
      row.encryptedValue,
      row.iv,
      row.authTag,
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

  const existing = await db
    .select()
    .from(variables)
    .where(
      and(
        eq(variables.environmentId, environmentId),
        eq(variables.key, key),
      ),
    )
    .limit(1)
    .then((rows) => rows[0])

  if (existing) {
    const [updated] = await db
      .update(variables)
      .set({
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        updatedBy: userId,
        updatedAt: sql`now()`,
      })
      .where(eq(variables.id, existing.id))
      .returning()

    const versionEncrypted = encryptValue(value, orgKey)
    await db.insert(variableVersions).values({
      variableId: existing.id,
      encryptedOldValue: existing.encryptedValue,
      encryptedNewValue: versionEncrypted.encryptedValue,
      iv: versionEncrypted.iv,
      authTag: versionEncrypted.authTag,
      changedBy: userId,
      action: 'update',
    })

    return updated
  }

  const [created] = await db
    .insert(variables)
    .values({
      key,
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      environmentId,
      updatedBy: userId,
    })
    .returning()

  const versionEncrypted = encryptValue(value, orgKey)
  await db.insert(variableVersions).values({
    variableId: created.id,
    encryptedNewValue: versionEncrypted.encryptedValue,
    iv: versionEncrypted.iv,
    authTag: versionEncrypted.authTag,
    changedBy: userId,
    action: 'create',
  })

  return created
}

export async function deleteVariable(variableId: string, userId: string) {
  const existing = await db
    .select()
    .from(variables)
    .where(eq(variables.id, variableId))
    .limit(1)
    .then((rows) => rows[0])

  if (!existing) return

  await db.insert(variableVersions).values({
    variableId: existing.id,
    encryptedOldValue: existing.encryptedValue,
    encryptedNewValue: existing.encryptedValue,
    iv: existing.iv,
    authTag: existing.authTag,
    changedBy: userId,
    action: 'delete',
  })

  await db.delete(variables).where(eq(variables.id, variableId))
}

export async function bulkUpsertVariables(
  environmentId: string,
  orgId: string,
  input: BulkUpsertVariablesInput,
  userId: string,
): Promise<{ created: number; updated: number; deleted: number }> {
  const orgKey = await getOrgKey(orgId)
  let created = 0
  let updated = 0
  let deleted = 0

  await db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(variables)
      .where(eq(variables.environmentId, environmentId))

    const existingByKey = new Map(existingRows.map((r) => [r.key, r]))
    const inputKeys = new Set(input.map((v) => v.key))

    for (const { key, value } of input) {
      const encrypted = encryptValue(value, orgKey)
      const existing = existingByKey.get(key)

      if (existing) {
        await tx
          .update(variables)
          .set({
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            updatedBy: userId,
            updatedAt: sql`now()`,
          })
          .where(eq(variables.id, existing.id))

        const versionEncrypted = encryptValue(value, orgKey)
        await tx.insert(variableVersions).values({
          variableId: existing.id,
          encryptedOldValue: existing.encryptedValue,
          encryptedNewValue: versionEncrypted.encryptedValue,
          iv: versionEncrypted.iv,
          authTag: versionEncrypted.authTag,
          changedBy: userId,
          action: 'update',
        })
        updated++
      } else {
        const [newVar] = await tx
          .insert(variables)
          .values({
            key,
            encryptedValue: encrypted.encryptedValue,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            environmentId,
            updatedBy: userId,
          })
          .returning()

        const versionEncrypted = encryptValue(value, orgKey)
        await tx.insert(variableVersions).values({
          variableId: newVar.id,
          encryptedNewValue: versionEncrypted.encryptedValue,
          iv: versionEncrypted.iv,
          authTag: versionEncrypted.authTag,
          changedBy: userId,
          action: 'create',
        })
        created++
      }
    }

    for (const existing of existingRows) {
      if (!inputKeys.has(existing.key)) {
        await tx.insert(variableVersions).values({
          variableId: existing.id,
          encryptedOldValue: existing.encryptedValue,
          encryptedNewValue: existing.encryptedValue,
          iv: existing.iv,
          authTag: existing.authTag,
          changedBy: userId,
          action: 'delete',
        })
        await tx.delete(variables).where(eq(variables.id, existing.id))
        deleted++
      }
    }
  })

  return { created, updated, deleted }
}

export async function getVariableHistory(
  variableId: string,
  limit = 50,
  offset = 0,
) {
  return db
    .select()
    .from(variableVersions)
    .where(eq(variableVersions.variableId, variableId))
    .orderBy(desc(variableVersions.changedAt))
    .limit(limit)
    .offset(offset)
}
