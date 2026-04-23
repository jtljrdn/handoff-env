import {
  decryptWithKey,
  encryptWithKey,
  fromBase64,
  generateDek,
  openSealedBox,
  ready,
  sealToPublicKey,
  toBase64,
} from '@handoff-env/crypto'
import {
  applyMemberWrapFn,
  completeDekRotationFn,
  getAllOrgVariablesForRotationFn,
  getMyWrappedDekFn,
  getRotationStatusFn,
  initOrgDekFn,
  listPendingWrapsForUserFn,
  type RotationStatus,
} from '#/lib/server-fns/org-vault'
import { getUnlocked } from '#/lib/vault/store'
import { logger } from '#/lib/logger'

const log = logger.child({ scope: 'vault.org' })
const enc = new TextEncoder()

export async function seedOrgDek(orgId: string): Promise<void> {
  await ready()
  const unlocked = getUnlocked()
  if (!unlocked) {
    throw new Error('Vault is locked. Please unlock before creating an organization.')
  }
  const dek = generateDek()
  try {
    const sealed = sealToPublicKey(dek, unlocked.publicKey)
    await initOrgDekFn({
      data: {
        orgId,
        founderWrappedDek: toBase64(sealed),
      },
    })
  } finally {
    dek.fill(0)
  }
}

export async function unwrapOrgDek(orgId: string): Promise<{
  dek: Uint8Array
  dekVersion: number
} | null> {
  await ready()
  const unlocked = getUnlocked()
  if (!unlocked) return null

  const wrapped = await getMyWrappedDekFn({ data: { orgId } })
  if (!wrapped) return null

  const dek = openSealedBox(
    fromBase64(wrapped.wrappedDek),
    unlocked.publicKey,
    unlocked.privateKey,
  )
  return { dek, dekVersion: wrapped.dekVersion }
}

export async function grantPendingWrap(params: {
  orgId: string
  targetUserId: string
  targetPublicKey: string
}): Promise<void> {
  await ready()
  const unlocked = getUnlocked()
  if (!unlocked) {
    throw new Error('Your vault is locked. Unlock it to grant access.')
  }

  const wrapped = await unwrapOrgDek(params.orgId)
  if (!wrapped) {
    throw new Error('You do not have access to this organization key.')
  }

  try {
    const sealed = sealToPublicKey(wrapped.dek, fromBase64(params.targetPublicKey))
    await applyMemberWrapFn({
      data: {
        orgId: params.orgId,
        targetUserId: params.targetUserId,
        dekVersion: wrapped.dekVersion,
        sealedDek: toBase64(sealed),
      },
    })
  } finally {
    wrapped.dek.fill(0)
  }
}

export async function processPendingWraps(): Promise<{
  processed: number
  failures: number
}> {
  await ready()
  const unlocked = getUnlocked()
  if (!unlocked) return { processed: 0, failures: 0 }

  const pending = await listPendingWrapsForUserFn()
  if (pending.length === 0) return { processed: 0, failures: 0 }

  let processed = 0
  let failures = 0
  const dekCache = new Map<string, { dek: Uint8Array; version: number }>()

  for (const item of pending) {
    try {
      let entry = dekCache.get(item.orgId)
      if (!entry) {
        const got = await unwrapOrgDek(item.orgId)
        if (!got) {
          failures++
          continue
        }
        entry = { dek: got.dek, version: got.dekVersion }
        dekCache.set(item.orgId, entry)
      }
      const sealed = sealToPublicKey(
        entry.dek,
        fromBase64(item.targetUserPublicKey),
      )
      await applyMemberWrapFn({
        data: {
          orgId: item.orgId,
          targetUserId: item.targetUserId,
          dekVersion: entry.version,
          sealedDek: toBase64(sealed),
        },
      })
      processed++
    } catch (err) {
      failures++
      log.warn('pending_wrap.failed', {
        orgId: item.orgId,
        targetUserId: item.targetUserId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  for (const entry of dekCache.values()) entry.dek.fill(0)

  return { processed, failures }
}

export interface RotateOrgDekResult {
  rotated: boolean
  variableCount: number
  memberCount: number
  tokensInvalidated: number
  newVersion: number
}

export async function rotateOrgDek(
  orgId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<RotateOrgDekResult> {
  await ready()
  const unlocked = getUnlocked()
  if (!unlocked) {
    throw new Error('Your vault is locked. Unlock it to rotate keys.')
  }

  const status: RotationStatus = await getRotationStatusFn({ data: { orgId } })
  if (!status.pending) {
    return {
      rotated: false,
      variableCount: 0,
      memberCount: 0,
      tokensInvalidated: 0,
      newVersion: 0,
    }
  }

  const oldVersion = status.pending.version
  const wrapped = await getMyWrappedDekFn({ data: { orgId } })
  if (!wrapped) {
    throw new Error('You do not have access to this organization key.')
  }
  if (wrapped.dekVersion !== oldVersion) {
    throw new Error(
      `DEK version mismatch: expected ${oldVersion}, have ${wrapped.dekVersion}`,
    )
  }

  const oldDek = openSealedBox(
    fromBase64(wrapped.wrappedDek),
    unlocked.publicKey,
    unlocked.privateKey,
  )
  const newDek = generateDek()

  try {
    const variables = await getAllOrgVariablesForRotationFn({
      data: { orgId },
    })

    const reEncryptedVariables = variables.map((v, i) => {
      const plaintext = decryptWithKey(
        {
          ciphertext: fromBase64(v.ciphertext),
          nonce: fromBase64(v.nonce),
        },
        oldDek,
        enc.encode(`${v.environmentId}:${v.key}`),
      )
      const payload = encryptWithKey(
        plaintext,
        newDek,
        enc.encode(`${v.environmentId}:${v.key}`),
      )
      plaintext.fill(0)
      onProgress?.(i + 1, variables.length)
      return {
        id: v.id,
        ciphertext: toBase64(payload.ciphertext),
        nonce: toBase64(payload.nonce),
      }
    })

    const newWrapsPerMember = status.remainingMembers.map((member) => ({
      userId: member.userId,
      sealedDek: toBase64(
        sealToPublicKey(newDek, fromBase64(member.publicKey)),
      ),
    }))

    const result = await completeDekRotationFn({
      data: {
        orgId,
        oldVersion,
        newWrapsPerMember,
        reEncryptedVariables,
      },
    })

    log.info('dek.rotated', {
      orgId,
      oldVersion,
      newVersion: result.newVersion,
      variableCount: result.variableCount,
      memberCount: result.memberCount,
      tokensInvalidated: result.tokensInvalidated,
    })

    return {
      rotated: true,
      variableCount: result.variableCount,
      memberCount: result.memberCount,
      tokensInvalidated: result.tokensInvalidated,
      newVersion: result.newVersion,
    }
  } finally {
    oldDek.fill(0)
    newDek.fill(0)
  }
}
