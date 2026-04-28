import { beforeAll, describe, expect, test } from 'bun:test'
import {
  deriveRecoveryWrapKey,
  generateRecoveryCode,
  ready,
} from '../src/index.ts'

beforeAll(async () => {
  await ready()
})

describe('recovery code', () => {
  test('display string is grouped base32 of total length 64 (52 chars + 12 hyphens)', () => {
    const { display } = generateRecoveryCode()
    expect(display.length).toBe(64)
    expect(display.split('-').every((g) => g.length === 4)).toBe(true)
    expect(display).toMatch(/^[A-Z2-7-]+$/)
  })

  test('wrapKey is 32 bytes', () => {
    expect(generateRecoveryCode().wrapKey.length).toBe(32)
  })

  test('display string parses back to the same wrap key', () => {
    const { display, wrapKey } = generateRecoveryCode()
    expect(deriveRecoveryWrapKey(display)).toEqual(wrapKey)
  })

  test('parsing is case-insensitive and accepts whitespace and missing hyphens', () => {
    const { display, wrapKey } = generateRecoveryCode()
    const lower = display.toLowerCase()
    const noHyphens = display.replaceAll('-', '')
    const spaced = display.replaceAll('-', ' ')
    expect(deriveRecoveryWrapKey(lower)).toEqual(wrapKey)
    expect(deriveRecoveryWrapKey(noHyphens)).toEqual(wrapKey)
    expect(deriveRecoveryWrapKey(spaced)).toEqual(wrapKey)
  })

  test('flipping a single character produces a different wrap key', () => {
    const { display, wrapKey } = generateRecoveryCode()
    const idx = display.indexOf(display.match(/[A-Z]/)![0])
    const ch = display[idx]!
    const replacement = ch === 'A' ? 'B' : 'A'
    const tampered = display.slice(0, idx) + replacement + display.slice(idx + 1)
    expect(deriveRecoveryWrapKey(tampered)).not.toEqual(wrapKey)
  })

  test('codes are pairwise distinct across many invocations', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const { display } = generateRecoveryCode()
      expect(seen.has(display)).toBe(false)
      seen.add(display)
    }
  })

  test('rejects codes that decode to the wrong length', () => {
    expect(() => deriveRecoveryWrapKey('AAAA-AAAA')).toThrow(/32 bytes/)
  })
})
