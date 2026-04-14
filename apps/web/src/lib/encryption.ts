import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { db } from '#/db'
import { orgEncryptionKeys } from '#/db/schema'
import { eq } from 'drizzle-orm'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_MASTER_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY must be a 64-character hex string (32 bytes)',
    )
  }
  return Buffer.from(hex, 'hex')
}

function encrypt(
  data: Buffer,
  key: Buffer,
): { ciphertext: string; iv: string; authTag: string } {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

function decrypt(
  ciphertext: string,
  iv: string,
  authTag: string,
  key: Buffer,
): Buffer {
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH },
  )
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ])
}

export function generateOrgKey(): Buffer {
  return randomBytes(32)
}

export function encryptWithMasterKey(data: Buffer): {
  ciphertext: string
  iv: string
  authTag: string
} {
  return encrypt(data, getMasterKey())
}

export function decryptWithMasterKey(
  ciphertext: string,
  iv: string,
  authTag: string,
): Buffer {
  return decrypt(ciphertext, iv, authTag, getMasterKey())
}

export function encryptValue(
  value: string,
  orgKey: Buffer,
): { encryptedValue: string; iv: string; authTag: string } {
  const result = encrypt(Buffer.from(value, 'utf-8'), orgKey)
  return {
    encryptedValue: result.ciphertext,
    iv: result.iv,
    authTag: result.authTag,
  }
}

export function decryptValue(
  encryptedValue: string,
  iv: string,
  authTag: string,
  orgKey: Buffer,
): string {
  return decrypt(encryptedValue, iv, authTag, orgKey).toString('utf-8')
}

const orgKeyCache = new Map<
  string,
  { key: Buffer; expiresAt: number }
>()
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_SIZE = 100

function evictExpired() {
  const now = Date.now()
  for (const [id, entry] of orgKeyCache) {
    if (entry.expiresAt <= now) {
      orgKeyCache.delete(id)
    }
  }
}

export async function getOrgKey(orgId: string): Promise<Buffer> {
  const cached = orgKeyCache.get(orgId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key
  }

  const row = await db
    .select()
    .from(orgEncryptionKeys)
    .where(eq(orgEncryptionKeys.orgId, orgId))
    .limit(1)
    .then((rows) => rows[0])

  if (!row) {
    throw new Error(`No encryption key found for org ${orgId}`)
  }

  const orgKey = decryptWithMasterKey(row.encryptedKey, row.iv, row.authTag)

  if (orgKeyCache.size >= CACHE_MAX_SIZE) {
    evictExpired()
  }
  if (orgKeyCache.size >= CACHE_MAX_SIZE) {
    const firstKey = orgKeyCache.keys().next().value
    if (firstKey) orgKeyCache.delete(firstKey)
  }

  orgKeyCache.set(orgId, {
    key: orgKey,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  return orgKey
}

export async function createOrgEncryptionKey(orgId: string): Promise<void> {
  const orgKey = generateOrgKey()
  const { ciphertext, iv, authTag } = encryptWithMasterKey(orgKey)

  await db.insert(orgEncryptionKeys).values({
    orgId,
    encryptedKey: ciphertext,
    iv,
    authTag,
  })
}
