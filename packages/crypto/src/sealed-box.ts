import { requireReady } from './sodium.ts'

const PUBLIC_KEY_LENGTH = 32
const PRIVATE_KEY_LENGTH = 32

export function sealToPublicKey(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
): Uint8Array {
  const s = requireReady()
  if (recipientPublicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new Error(
      `Public key must be ${PUBLIC_KEY_LENGTH} bytes, got ${recipientPublicKey.length}`,
    )
  }
  return s.crypto_box_seal(plaintext, recipientPublicKey)
}

export function openSealedBox(
  ciphertext: Uint8Array,
  recipientPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array,
): Uint8Array {
  const s = requireReady()
  if (recipientPublicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new Error(
      `Public key must be ${PUBLIC_KEY_LENGTH} bytes, got ${recipientPublicKey.length}`,
    )
  }
  if (recipientPrivateKey.length !== PRIVATE_KEY_LENGTH) {
    throw new Error(
      `Private key must be ${PRIVATE_KEY_LENGTH} bytes, got ${recipientPrivateKey.length}`,
    )
  }
  return s.crypto_box_seal_open(
    ciphertext,
    recipientPublicKey,
    recipientPrivateKey,
  )
}
