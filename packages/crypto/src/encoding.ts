export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export function fromBase64(s: string): Uint8Array {
  const binary = atob(s)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export function fromBase64Url(s: string): Uint8Array {
  const padded = s.replaceAll('-', '+').replaceAll('_', '/')
  const remainder = padded.length % 4
  const fullyPadded =
    remainder === 0 ? padded : padded + '='.repeat(4 - remainder)
  return fromBase64(fullyPadded)
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE32_REVERSE = (() => {
  const table: Record<string, number> = {}
  for (let i = 0; i < BASE32_ALPHABET.length; i++) {
    table[BASE32_ALPHABET[i]!] = i
  }
  return table
})()

export function toBase32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f]
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return out
}

export function fromBase32(s: string): Uint8Array {
  const cleaned = s
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/=+$/, '')
  const out: number[] = []
  let bits = 0
  let value = 0
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!
    const v = BASE32_REVERSE[ch]
    if (v === undefined) {
      throw new Error(`Invalid base32 character: ${ch}`)
    }
    value = (value << 5) | v
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
    }
  }
  return new Uint8Array(out)
}
