import { beforeAll, describe, expect, test } from 'bun:test'
import {
  generateIdentity,
  openSealedBox,
  ready,
  sealToPublicKey,
} from '../src/index.ts'

beforeAll(async () => {
  await ready()
})

const enc = new TextEncoder()
const dec = new TextDecoder()

describe('sealed box', () => {
  test('round-trips a message between distinct keypairs', () => {
    const recipient = generateIdentity()
    const ciphertext = sealToPublicKey(enc.encode('the dek'), recipient.publicKey)
    const recovered = openSealedBox(
      ciphertext,
      recipient.publicKey,
      recipient.privateKey,
    )
    expect(dec.decode(recovered)).toBe('the dek')
  })

  test('an unrelated keypair cannot open the sealed box', () => {
    const recipient = generateIdentity()
    const stranger = generateIdentity()
    const ciphertext = sealToPublicKey(enc.encode('secret'), recipient.publicKey)
    expect(() =>
      openSealedBox(ciphertext, stranger.publicKey, stranger.privateKey),
    ).toThrow()
  })

  test('throws if ciphertext is tampered with', () => {
    const recipient = generateIdentity()
    const ciphertext = sealToPublicKey(enc.encode('secret'), recipient.publicKey)
    ciphertext[0] = ciphertext[0]! ^ 0x01
    expect(() =>
      openSealedBox(ciphertext, recipient.publicKey, recipient.privateKey),
    ).toThrow()
  })

  test('rejects malformed public keys', () => {
    expect(() => sealToPublicKey(enc.encode('x'), new Uint8Array(16))).toThrow(
      /32 bytes/,
    )
  })

  test('rejects malformed private keys', () => {
    const recipient = generateIdentity()
    const ciphertext = sealToPublicKey(enc.encode('x'), recipient.publicKey)
    expect(() =>
      openSealedBox(ciphertext, recipient.publicKey, new Uint8Array(16)),
    ).toThrow(/32 bytes/)
  })
})
