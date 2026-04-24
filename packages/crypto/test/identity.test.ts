import { beforeAll, describe, expect, test } from 'bun:test'
import { generateIdentity, ready } from '../src/index.ts'

beforeAll(async () => {
  await ready()
})

describe('generateIdentity', () => {
  test('produces 32-byte public and private keys', () => {
    const id = generateIdentity()
    expect(id.publicKey.length).toBe(32)
    expect(id.privateKey.length).toBe(32)
  })

  test('produces pairwise-distinct keypairs across many invocations', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const id = generateIdentity()
      const tag = `${[...id.publicKey].join(',')}|${[...id.privateKey].join(',')}`
      expect(seen.has(tag)).toBe(false)
      seen.add(tag)
    }
  })
})
