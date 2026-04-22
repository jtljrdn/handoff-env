import * as sodiumModule from 'libsodium-wrappers-sumo'

type Sodium = typeof sodiumModule

const moduleWithDefault = sodiumModule as unknown as {
  default?: Sodium
  ready: Promise<void>
}

const live: Sodium = moduleWithDefault.default ?? sodiumModule

let readyPromise: Promise<void> | null = null
let initialized = false

export async function ready(): Promise<void> {
  if (!readyPromise) {
    readyPromise = live.ready.then(() => {
      initialized = true
    })
  }
  await readyPromise
}

export function requireReady(): Sodium {
  if (!initialized) {
    throw new Error(
      '@handoff-env/crypto: await ready() before using any primitive',
    )
  }
  return live
}
