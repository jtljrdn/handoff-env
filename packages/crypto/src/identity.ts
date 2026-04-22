import { requireReady } from './sodium.ts'

export interface IdentityKeypair {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

export function generateIdentity(): IdentityKeypair {
  const kp = requireReady().crypto_box_keypair()
  return { publicKey: kp.publicKey, privateKey: kp.privateKey }
}

export function derivePublicKey(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== 32) {
    throw new Error(`Private key must be 32 bytes, got ${privateKey.length}`)
  }
  return requireReady().crypto_scalarmult_base(privateKey)
}
