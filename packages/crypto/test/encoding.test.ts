import { describe, expect, test } from 'bun:test'
import {
  fromBase32,
  fromBase64,
  fromBase64Url,
  toBase32,
  toBase64,
  toBase64Url,
} from '../src/encoding.ts'

describe('base64', () => {
  test('round-trips arbitrary bytes', () => {
    for (let n = 0; n < 64; n++) {
      const bytes = new Uint8Array(n)
      for (let i = 0; i < n; i++) bytes[i] = (i * 37 + 11) & 0xff
      const round = fromBase64(toBase64(bytes))
      expect(round).toEqual(bytes)
    }
  })

  test('produces standard padding', () => {
    expect(toBase64(new Uint8Array([102, 111, 111]))).toBe('Zm9v')
    expect(toBase64(new Uint8Array([102, 111]))).toBe('Zm8=')
    expect(toBase64(new Uint8Array([102]))).toBe('Zg==')
  })
})

describe('base64url', () => {
  test('round-trips arbitrary bytes without padding', () => {
    for (let n = 0; n < 64; n++) {
      const bytes = new Uint8Array(n)
      for (let i = 0; i < n; i++) bytes[i] = (i * 53 + 7) & 0xff
      const encoded = toBase64Url(bytes)
      expect(encoded).not.toContain('=')
      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(fromBase64Url(encoded)).toEqual(bytes)
    }
  })
})

describe('base32', () => {
  test('round-trips arbitrary bytes', () => {
    for (let n = 1; n < 64; n++) {
      const bytes = new Uint8Array(n)
      for (let i = 0; i < n; i++) bytes[i] = (i * 71 + 3) & 0xff
      const round = fromBase32(toBase32(bytes))
      expect(round.length).toBe(n)
      expect(round).toEqual(bytes)
    }
  })

  test('parsing is case-insensitive and ignores whitespace and hyphens', () => {
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) bytes[i] = i * 7
    const encoded = toBase32(bytes)
    const formatted = encoded
      .toLowerCase()
      .match(/.{1,4}/g)!
      .join('-')
    expect(fromBase32(formatted)).toEqual(bytes)
    expect(fromBase32(`  ${formatted}  `)).toEqual(bytes)
  })

  test('rejects invalid characters', () => {
    expect(() => fromBase32('AAAA1AAA')).toThrow(/Invalid base32/)
  })
})
