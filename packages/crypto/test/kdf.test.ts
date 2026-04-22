import { beforeAll, describe, expect, test } from 'bun:test'
import {
  deriveKekFromPassphrase,
  generateKdfSalt,
  getDefaultKdfParams,
  ready,
} from '../src/index.ts'

beforeAll(async () => {
  await ready()
})

const FAST_PARAMS = {
  opsLimit: 2,
  memLimit: 64 * 1024 * 1024,
}

describe('Argon2id KDF', () => {
  test('produces 32-byte keys', () => {
    const salt = generateKdfSalt()
    const key = deriveKekFromPassphrase('correct horse battery', salt, FAST_PARAMS)
    expect(key.length).toBe(32)
  })

  test('is deterministic for the same passphrase, salt, and params', () => {
    const salt = generateKdfSalt()
    const a = deriveKekFromPassphrase('passphrase', salt, FAST_PARAMS)
    const b = deriveKekFromPassphrase('passphrase', salt, FAST_PARAMS)
    expect(a).toEqual(b)
  })

  test('produces different keys for different salts', () => {
    const a = deriveKekFromPassphrase('p', generateKdfSalt(), FAST_PARAMS)
    const b = deriveKekFromPassphrase('p', generateKdfSalt(), FAST_PARAMS)
    expect(a).not.toEqual(b)
  })

  test('produces different keys for different passphrases', () => {
    const salt = generateKdfSalt()
    const a = deriveKekFromPassphrase('one', salt, FAST_PARAMS)
    const b = deriveKekFromPassphrase('two', salt, FAST_PARAMS)
    expect(a).not.toEqual(b)
  })

  test('produces different keys when ops or mem limits change', () => {
    const salt = generateKdfSalt()
    const a = deriveKekFromPassphrase('p', salt, FAST_PARAMS)
    const b = deriveKekFromPassphrase('p', salt, {
      ...FAST_PARAMS,
      opsLimit: FAST_PARAMS.opsLimit + 1,
    })
    expect(a).not.toEqual(b)
  })

  test('rejects salts of the wrong length', () => {
    expect(() =>
      deriveKekFromPassphrase('p', new Uint8Array(8), FAST_PARAMS),
    ).toThrow(/16 bytes/)
  })

  test('rejects empty passphrase', () => {
    expect(() =>
      deriveKekFromPassphrase('', generateKdfSalt(), FAST_PARAMS),
    ).toThrow(/empty/)
  })

  test('default params are exposed', () => {
    const p = getDefaultKdfParams()
    expect(p.opsLimit).toBeGreaterThan(0)
    expect(p.memLimit).toBeGreaterThan(0)
  })
})
