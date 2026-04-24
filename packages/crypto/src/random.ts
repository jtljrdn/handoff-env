import { requireReady } from './sodium.ts'

export function randomBytes(n: number): Uint8Array {
  return requireReady().randombytes_buf(n)
}
