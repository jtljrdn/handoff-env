import {
  decryptWithKey,
  deriveKekFromPassphrase,
  deriveRecoveryWrapKey,
  encryptWithKey,
  fromBase64,
  generateIdentity,
  generateKdfSalt,
  generateRecoveryCode,
  getDefaultKdfParams,
  toBase64,
  type IdentityKeypair,
} from '@handoff-env/crypto'

export interface NewVaultMaterials {
  publicKey: string
  encryptedPrivateKey: string
  encPrivNonce: string
  kdfSalt: string
  kdfOpsLimit: number
  kdfMemLimit: number
  recoveryWrappedPrivateKey: string
  recoveryPrivNonce: string
  recoveryDisplay: string
  identity: IdentityKeypair
}

export function buildNewVault(passphrase: string): NewVaultMaterials {
  const identity = generateIdentity()
  const salt = generateKdfSalt()
  const params = getDefaultKdfParams()
  const kek = deriveKekFromPassphrase(passphrase, salt, params)
  const wrappedPriv = encryptWithKey(identity.privateKey, kek)

  const recovery = generateRecoveryCode()
  const recoveryWrapped = encryptWithKey(identity.privateKey, recovery.wrapKey)

  return {
    publicKey: toBase64(identity.publicKey),
    encryptedPrivateKey: toBase64(wrappedPriv.ciphertext),
    encPrivNonce: toBase64(wrappedPriv.nonce),
    kdfSalt: toBase64(salt),
    kdfOpsLimit: params.opsLimit,
    kdfMemLimit: params.memLimit,
    recoveryWrappedPrivateKey: toBase64(recoveryWrapped.ciphertext),
    recoveryPrivNonce: toBase64(recoveryWrapped.nonce),
    recoveryDisplay: recovery.display,
    identity,
  }
}

export interface UnlockMaterials {
  publicKey: string
  encryptedPrivateKey: string
  encPrivNonce: string
  kdfSalt: string
  kdfOpsLimit: number
  kdfMemLimit: number
}

export function unlockWithPassphrase(
  passphrase: string,
  materials: UnlockMaterials,
): IdentityKeypair {
  const kek = deriveKekFromPassphrase(passphrase, fromBase64(materials.kdfSalt), {
    opsLimit: materials.kdfOpsLimit,
    memLimit: materials.kdfMemLimit,
  })
  const privateKey = decryptWithKey(
    {
      ciphertext: fromBase64(materials.encryptedPrivateKey),
      nonce: fromBase64(materials.encPrivNonce),
    },
    kek,
  )
  return { publicKey: fromBase64(materials.publicKey), privateKey }
}

export interface RecoveryMaterials {
  publicKey: string
  recoveryWrappedPrivateKey: string
  recoveryPrivNonce: string
}

export function unlockWithRecoveryCode(
  recoveryCode: string,
  materials: RecoveryMaterials,
): IdentityKeypair {
  const wrapKey = deriveRecoveryWrapKey(recoveryCode)
  const privateKey = decryptWithKey(
    {
      ciphertext: fromBase64(materials.recoveryWrappedPrivateKey),
      nonce: fromBase64(materials.recoveryPrivNonce),
    },
    wrapKey,
  )
  return { publicKey: fromBase64(materials.publicKey), privateKey }
}

export interface ResetPassphraseInput {
  privateKey: Uint8Array
  passphrase: string
}

export interface ResetPassphraseOutput {
  encryptedPrivateKey: string
  encPrivNonce: string
  kdfSalt: string
  kdfOpsLimit: number
  kdfMemLimit: number
}

export function rewrapForNewPassphrase(
  input: ResetPassphraseInput,
): ResetPassphraseOutput {
  const salt = generateKdfSalt()
  const params = getDefaultKdfParams()
  const kek = deriveKekFromPassphrase(input.passphrase, salt, params)
  const wrapped = encryptWithKey(input.privateKey, kek)
  return {
    encryptedPrivateKey: toBase64(wrapped.ciphertext),
    encPrivNonce: toBase64(wrapped.nonce),
    kdfSalt: toBase64(salt),
    kdfOpsLimit: params.opsLimit,
    kdfMemLimit: params.memLimit,
  }
}
