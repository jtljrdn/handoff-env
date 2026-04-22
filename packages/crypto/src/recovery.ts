import { requireReady } from './sodium.ts'
import { fromBase32, toBase32 } from './encoding.ts'

const RECOVERY_BYTES_LENGTH = 32
const WRAP_KEY_LENGTH = 32
const DISPLAY_GROUP_SIZE = 4

export interface RecoveryCode {
  display: string
  wrapKey: Uint8Array
}

function formatGroups(s: string): string {
  const out: string[] = []
  for (let i = 0; i < s.length; i += DISPLAY_GROUP_SIZE) {
    out.push(s.slice(i, i + DISPLAY_GROUP_SIZE))
  }
  return out.join('-')
}

function deriveWrapKey(rawBytes: Uint8Array): Uint8Array {
  return requireReady().crypto_generichash(WRAP_KEY_LENGTH, rawBytes, null)
}

export function generateRecoveryCode(): RecoveryCode {
  const s = requireReady()
  const raw = s.randombytes_buf(RECOVERY_BYTES_LENGTH)
  return {
    display: formatGroups(toBase32(raw)),
    wrapKey: deriveWrapKey(raw),
  }
}

export function deriveRecoveryWrapKey(display: string): Uint8Array {
  const raw = fromBase32(display)
  if (raw.length !== RECOVERY_BYTES_LENGTH) {
    throw new Error(
      `Recovery code must decode to ${RECOVERY_BYTES_LENGTH} bytes, got ${raw.length}`,
    )
  }
  return deriveWrapKey(raw)
}
