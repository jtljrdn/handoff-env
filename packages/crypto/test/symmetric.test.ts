import { beforeAll, describe, expect, test } from 'bun:test'
import {
  decryptWithKey,
  encryptWithKey,
  generateDek,
  randomBytes,
  ready,
} from '../src/index.ts'

beforeAll(async () => {
  await ready()
})

const enc = new TextEncoder()
const dec = new TextDecoder()

describe('XChaCha20-Poly1305 AEAD', () => {
  test('round-trips an arbitrary message', () => {
    const key = generateDek()
    const message = enc.encode('SUPER_SECRET=value with spaces and = and \n')
    const payload = encryptWithKey(message, key)
    const recovered = decryptWithKey(payload, key)
    expect(dec.decode(recovered)).toBe(
      'SUPER_SECRET=value with spaces and = and \n',
    )
  })

  test('round-trips with associated data', () => {
    const key = generateDek()
    const ad = enc.encode('variable_id_xyz')
    const payload = encryptWithKey(enc.encode('hello'), key, ad)
    expect(dec.decode(decryptWithKey(payload, key, ad))).toBe('hello')
  })

  test('throws when associated data does not match', () => {
    const key = generateDek()
    const payload = encryptWithKey(enc.encode('hello'), key, enc.encode('a'))
    expect(() => decryptWithKey(payload, key, enc.encode('b'))).toThrow()
  })

  test('throws when ciphertext is tampered with', () => {
    const key = generateDek()
    const payload = encryptWithKey(enc.encode('hello world'), key)
    payload.ciphertext[0] = payload.ciphertext[0]! ^ 0x01
    expect(() => decryptWithKey(payload, key)).toThrow()
  })

  test('throws when nonce is tampered with', () => {
    const key = generateDek()
    const payload = encryptWithKey(enc.encode('hello world'), key)
    payload.nonce[0] = payload.nonce[0]! ^ 0x01
    expect(() => decryptWithKey(payload, key)).toThrow()
  })

  test('throws when key is wrong', () => {
    const k1 = generateDek()
    const k2 = generateDek()
    const payload = encryptWithKey(enc.encode('hello'), k1)
    expect(() => decryptWithKey(payload, k2)).toThrow()
  })

  test('rejects keys of the wrong length', () => {
    expect(() => encryptWithKey(enc.encode('x'), randomBytes(16))).toThrow(
      /32 bytes/,
    )
  })

  test('produces unique nonces across many encryptions', () => {
    const key = generateDek()
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const { nonce } = encryptWithKey(enc.encode('x'), key)
      const tag = [...nonce].join(',')
      expect(seen.has(tag)).toBe(false)
      seen.add(tag)
    }
  })

  test('encrypts empty plaintext', () => {
    const key = generateDek()
    const payload = encryptWithKey(new Uint8Array(0), key)
    expect(decryptWithKey(payload, key).length).toBe(0)
  })
})
