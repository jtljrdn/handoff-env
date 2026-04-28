import { requireReady } from './sodium.ts'

export interface AeadPayload {
  ciphertext: Uint8Array
  nonce: Uint8Array
}

const KEY_LENGTH = 32
const NONCE_LENGTH = 24

export function generateDek(): Uint8Array {
  return requireReady().randombytes_buf(KEY_LENGTH)
}

function assertKey(key: Uint8Array): void {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes, got ${key.length}`)
  }
}

function assertNonce(nonce: Uint8Array): void {
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Nonce must be ${NONCE_LENGTH} bytes, got ${nonce.length}`)
  }
}

export function encryptWithKey(
  plaintext: Uint8Array,
  key: Uint8Array,
  associatedData?: Uint8Array,
): AeadPayload {
  const s = requireReady()
  assertKey(key)
  const nonce = s.randombytes_buf(NONCE_LENGTH)
  const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    associatedData ?? null,
    null,
    nonce,
    key,
  )
  return { ciphertext, nonce }
}

export function decryptWithKey(
  payload: AeadPayload,
  key: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array {
  const s = requireReady()
  assertKey(key)
  assertNonce(payload.nonce)
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    payload.ciphertext,
    associatedData ?? null,
    payload.nonce,
    key,
  )
}
