import {
  decryptWithKey,
  encryptWithKey,
  generateDek,
  type AeadPayload,
} from './symmetric.ts'
import {
  deriveKekFromPassphrase,
  generateKdfSalt,
  getDefaultKdfParams,
  type KdfParams,
} from './kdf.ts'
import { randomBytes } from './random.ts'
import { sha256 } from './hash.ts'
import { fromBase64, toBase64, toBase64Url, fromBase64Url } from './encoding.ts'
import { ready } from './sodium.ts'

const LINK_SECRET_LENGTH = 32

const enc = new TextEncoder()
const dec = new TextDecoder()

export interface ShareEnvelope {
  pwSalt: string
  kdfOpsLimit: number
  kdfMemLimit: number
  wrapCiphertext: string
  wrapNonce: string
  ciphertext: string
  nonce: string
}

export interface BuiltShareEnvelope {
  envelope: ShareEnvelope
  linkSecret: string
}

function deriveOuterKek(
  password: string,
  salt: Uint8Array,
  params: KdfParams,
  linkSecret: Uint8Array,
): Uint8Array {
  const innerKek = deriveKekFromPassphrase(password, salt, params)
  const combined = new Uint8Array(innerKek.length + linkSecret.length)
  combined.set(innerKek, 0)
  combined.set(linkSecret, innerKek.length)
  return sha256(combined)
}

export async function buildShareEnvelope(
  plaintext: string,
  password: string,
): Promise<BuiltShareEnvelope> {
  await ready()
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters')
  }
  const linkSecret = randomBytes(LINK_SECRET_LENGTH)
  const pwSalt = generateKdfSalt()
  const params = getDefaultKdfParams()
  const outerKek = deriveOuterKek(password, pwSalt, params, linkSecret)
  const shareDek = generateDek()
  const payload: AeadPayload = encryptWithKey(enc.encode(plaintext), shareDek)
  const wrap: AeadPayload = encryptWithKey(shareDek, outerKek)

  return {
    envelope: {
      pwSalt: toBase64(pwSalt),
      kdfOpsLimit: params.opsLimit,
      kdfMemLimit: params.memLimit,
      wrapCiphertext: toBase64(wrap.ciphertext),
      wrapNonce: toBase64(wrap.nonce),
      ciphertext: toBase64(payload.ciphertext),
      nonce: toBase64(payload.nonce),
    },
    linkSecret: toBase64Url(linkSecret),
  }
}

export interface ShareEnvelopeForOpening {
  pwSalt: string
  kdfOpsLimit: number
  kdfMemLimit: number
  wrapCiphertext: string
  wrapNonce: string
  ciphertext: string
  nonce: string
}

export async function openShareEnvelope(
  envelope: ShareEnvelopeForOpening,
  password: string,
  linkSecret: string,
): Promise<string> {
  await ready()
  const params: KdfParams = {
    opsLimit: envelope.kdfOpsLimit,
    memLimit: envelope.kdfMemLimit,
  }
  const outerKek = deriveOuterKek(
    password,
    fromBase64(envelope.pwSalt),
    params,
    fromBase64Url(linkSecret),
  )
  const shareDek = decryptWithKey(
    {
      ciphertext: fromBase64(envelope.wrapCiphertext),
      nonce: fromBase64(envelope.wrapNonce),
    },
    outerKek,
  )
  const plaintextBytes = decryptWithKey(
    {
      ciphertext: fromBase64(envelope.ciphertext),
      nonce: fromBase64(envelope.nonce),
    },
    shareDek,
  )
  return dec.decode(plaintextBytes)
}
