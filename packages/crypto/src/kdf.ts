import { requireReady } from './sodium.ts'

export interface KdfParams {
  opsLimit: number
  memLimit: number
}

const KDF_OUTPUT_LENGTH = 32
const KDF_SALT_LENGTH = 16

let cachedDefaults: KdfParams | null = null

export function getDefaultKdfParams(): KdfParams {
  if (!cachedDefaults) {
    const s = requireReady()
    cachedDefaults = {
      opsLimit: s.crypto_pwhash_OPSLIMIT_MODERATE,
      memLimit: s.crypto_pwhash_MEMLIMIT_MODERATE,
    }
  }
  return cachedDefaults
}

export function generateKdfSalt(): Uint8Array {
  return requireReady().randombytes_buf(KDF_SALT_LENGTH)
}

export function deriveKekFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  params?: KdfParams,
): Uint8Array {
  const s = requireReady()
  if (salt.length !== KDF_SALT_LENGTH) {
    throw new Error(
      `KDF salt must be ${KDF_SALT_LENGTH} bytes, got ${salt.length}`,
    )
  }
  if (passphrase.length === 0) {
    throw new Error('Passphrase must not be empty')
  }
  const { opsLimit, memLimit } = params ?? getDefaultKdfParams()
  return s.crypto_pwhash(
    KDF_OUTPUT_LENGTH,
    passphrase,
    salt,
    opsLimit,
    memLimit,
    s.crypto_pwhash_ALG_ARGON2ID13,
  )
}
