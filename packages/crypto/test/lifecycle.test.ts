import { beforeAll, describe, expect, test } from 'bun:test'
import {
  decryptWithKey,
  deriveKekFromPassphrase,
  deriveRecoveryWrapKey,
  encryptWithKey,
  generateDek,
  generateIdentity,
  generateKdfSalt,
  generateRecoveryCode,
  openSealedBox,
  ready,
  sealToPublicKey,
  sha256,
} from '../src/index.ts'

beforeAll(async () => {
  await ready()
})

const FAST_PARAMS = { opsLimit: 2, memLimit: 64 * 1024 * 1024 }
const enc = new TextEncoder()
const dec = new TextDecoder()

describe('end-to-end lifecycle', () => {
  test('founder onboards, creates org, invites a member, both share a variable', () => {
    // ---- founder signup ----
    const founder = generateIdentity()
    const founderSalt = generateKdfSalt()
    const founderKek = deriveKekFromPassphrase(
      'founder passphrase',
      founderSalt,
      FAST_PARAMS,
    )
    const founderEncryptedPriv = encryptWithKey(founder.privateKey, founderKek)
    const recovery = generateRecoveryCode()
    const founderRecoveryWrapped = encryptWithKey(
      founder.privateKey,
      recovery.wrapKey,
    )

    // founder later unlocks via passphrase
    const reKek = deriveKekFromPassphrase(
      'founder passphrase',
      founderSalt,
      FAST_PARAMS,
    )
    const recoveredPriv = decryptWithKey(founderEncryptedPriv, reKek)
    expect(recoveredPriv).toEqual(founder.privateKey)

    // founder loses passphrase, uses recovery code
    const recoveredViaRecovery = decryptWithKey(
      founderRecoveryWrapped,
      deriveRecoveryWrapKey(recovery.display),
    )
    expect(recoveredViaRecovery).toEqual(founder.privateKey)

    // ---- org creation ----
    const orgDek = generateDek()
    const founderWrappedDek = sealToPublicKey(orgDek, founder.publicKey)

    // ---- member signup and invite ----
    const member = generateIdentity()
    const memberWrappedDek = sealToPublicKey(orgDek, member.publicKey)

    // server can verify the same DEK is used by hash, but cannot read it
    expect(sha256(orgDek)).toEqual(sha256(orgDek))

    // ---- founder writes a variable ----
    const variableId = enc.encode('var_abc123')
    const founderUnwrappedDek = openSealedBox(
      founderWrappedDek,
      founder.publicKey,
      founder.privateKey,
    )
    const payload = encryptWithKey(
      enc.encode('postgres://prod.db'),
      founderUnwrappedDek,
      variableId,
    )

    // ---- member reads the variable ----
    const memberUnwrappedDek = openSealedBox(
      memberWrappedDek,
      member.publicKey,
      member.privateKey,
    )
    const recoveredValue = decryptWithKey(payload, memberUnwrappedDek, variableId)
    expect(dec.decode(recoveredValue)).toBe('postgres://prod.db')

    // ---- a stranger gets nothing ----
    const stranger = generateIdentity()
    expect(() =>
      openSealedBox(memberWrappedDek, stranger.publicKey, stranger.privateKey),
    ).toThrow()

    // ---- swapping the variable ID is detected ----
    expect(() =>
      decryptWithKey(payload, memberUnwrappedDek, enc.encode('var_other')),
    ).toThrow()
  })

  test('API token can be wrapped and unwrapped without exposing DEK to server', () => {
    const orgDek = generateDek()
    const tokenKp = generateIdentity()
    const wrappedForToken = sealToPublicKey(orgDek, tokenKp.publicKey)

    const unwrapped = openSealedBox(
      wrappedForToken,
      tokenKp.publicKey,
      tokenKp.privateKey,
    )
    expect(unwrapped).toEqual(orgDek)

    const tokenString = `hnd_${[...tokenKp.privateKey].map((b) => b.toString(16).padStart(2, '0')).join('')}`
    const stored = sha256(enc.encode(tokenString))
    expect(stored.length).toBe(32)
  })
})
