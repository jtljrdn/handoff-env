import {
  generateIdentity,
  ready,
  sealToPublicKey,
  sha256,
  toBase64,
  toBase64Url,
} from '@handoff-env/crypto'
import { unwrapOrgDek } from '#/lib/vault/org'

export interface BuiltToken {
  tokenString: string
  hashedToken: string
  prefix: string
  tokenPublicKey: string
  wrappedDek: string
  dekVersion: number
}

const TOKEN_PREFIX = 'hnd_'
const enc = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0')
  }
  return out
}

export async function buildToken(orgId: string): Promise<BuiltToken> {
  await ready()
  const wrap = await unwrapOrgDek(orgId)
  if (!wrap) {
    throw new Error('Vault is locked or org key is missing.')
  }
  try {
    const tokenKp = generateIdentity()
    const tokenString = TOKEN_PREFIX + toBase64Url(tokenKp.privateKey)
    const hashedTokenBytes = sha256(enc.encode(tokenString))
    const sealed = sealToPublicKey(wrap.dek, tokenKp.publicKey)

    return {
      tokenString,
      hashedToken: toHex(hashedTokenBytes),
      prefix: tokenString.slice(0, 12),
      tokenPublicKey: toBase64(tokenKp.publicKey),
      wrappedDek: toBase64(sealed),
      dekVersion: wrap.dekVersion,
    }
  } finally {
    wrap.dek.fill(0)
  }
}
