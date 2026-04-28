import { beforeAll, describe, expect, test } from 'bun:test'
import {
  buildShareEnvelope,
  fromBase64,
  openShareEnvelope,
  ready,
  toBase64,
} from '../src/index.ts'

beforeAll(async () => {
  await ready()
})

const STRONG_PASSWORD = 'a-strong-password-for-tests'

describe('share envelope', () => {
  test('round-trips with the correct password and link secret', async () => {
    const built = await buildShareEnvelope('postgres://user:pw@host/db', STRONG_PASSWORD)
    const out = await openShareEnvelope(
      built.envelope,
      STRONG_PASSWORD,
      built.linkSecret,
    )
    expect(out).toBe('postgres://user:pw@host/db')
  })

  test('round-trips multiline / special-character secrets', async () => {
    const value = 'line1\nline2 with =, " and #\n'
    const built = await buildShareEnvelope(value, STRONG_PASSWORD)
    const out = await openShareEnvelope(
      built.envelope,
      STRONG_PASSWORD,
      built.linkSecret,
    )
    expect(out).toBe(value)
  })

  test('fails with the wrong password', async () => {
    const built = await buildShareEnvelope('secret', STRONG_PASSWORD)
    await expect(
      openShareEnvelope(built.envelope, 'wrong-password!!', built.linkSecret),
    ).rejects.toThrow()
  })

  test('fails with the wrong link secret', async () => {
    const a = await buildShareEnvelope('secret', STRONG_PASSWORD)
    const b = await buildShareEnvelope('decoy', STRONG_PASSWORD)
    await expect(
      openShareEnvelope(a.envelope, STRONG_PASSWORD, b.linkSecret),
    ).rejects.toThrow()
  })

  test('fails when the ciphertext is tampered with', async () => {
    const built = await buildShareEnvelope('secret value', STRONG_PASSWORD)
    const tampered = fromBase64(built.envelope.ciphertext)
    tampered[0] = tampered[0]! ^ 0x01
    const envelope = {
      ...built.envelope,
      ciphertext: toBase64(tampered),
    }
    await expect(
      openShareEnvelope(envelope, STRONG_PASSWORD, built.linkSecret),
    ).rejects.toThrow()
  })

  test('rejects passwords shorter than 12 characters', async () => {
    await expect(buildShareEnvelope('secret', 'too-short')).rejects.toThrow(
      /12/,
    )
  })

  test('produces unique envelopes for the same input', async () => {
    const a = await buildShareEnvelope('same secret', STRONG_PASSWORD)
    const b = await buildShareEnvelope('same secret', STRONG_PASSWORD)
    expect(a.linkSecret).not.toBe(b.linkSecret)
    expect(a.envelope.ciphertext).not.toBe(b.envelope.ciphertext)
    expect(a.envelope.pwSalt).not.toBe(b.envelope.pwSalt)
  })
})
