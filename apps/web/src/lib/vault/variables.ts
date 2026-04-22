import {
  decryptWithKey,
  encryptWithKey,
  fromBase64,
  ready,
  toBase64,
} from '@handoff-env/crypto'

const enc = new TextEncoder()
const dec = new TextDecoder()

export interface EncryptedVariablePayload {
  ciphertext: string
  nonce: string
  dekVersion: number
}

function associatedDataFor(environmentId: string, key: string): Uint8Array {
  return enc.encode(`${environmentId}:${key}`)
}

export async function encryptVariableValue(
  environmentId: string,
  key: string,
  plaintext: string,
  dek: Uint8Array,
  dekVersion: number,
): Promise<EncryptedVariablePayload> {
  await ready()
  const payload = encryptWithKey(
    enc.encode(plaintext),
    dek,
    associatedDataFor(environmentId, key),
  )
  return {
    ciphertext: toBase64(payload.ciphertext),
    nonce: toBase64(payload.nonce),
    dekVersion,
  }
}

export async function decryptVariableValue(
  environmentId: string,
  key: string,
  payload: EncryptedVariablePayload,
  dek: Uint8Array,
): Promise<string> {
  await ready()
  const plaintextBytes = decryptWithKey(
    {
      ciphertext: fromBase64(payload.ciphertext),
      nonce: fromBase64(payload.nonce),
    },
    dek,
    associatedDataFor(environmentId, key),
  )
  return dec.decode(plaintextBytes)
}
