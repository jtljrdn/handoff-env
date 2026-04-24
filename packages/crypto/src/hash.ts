import { requireReady } from './sodium.ts'

export function sha256(input: Uint8Array): Uint8Array {
  return requireReady().crypto_hash_sha256(input)
}
