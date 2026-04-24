import {
  decryptWithKey,
  derivePublicKey,
  encryptWithKey,
  fromBase64,
  fromBase64Url,
  openSealedBox,
  ready,
  toBase64,
} from '@handoff-env/crypto'
import type { ApiResponse } from '@handoff-env/types'

export interface HandoffClientConfig {
  baseUrl: string
  token: string
}

export interface DiffResult {
  added: string[]
  removed: string[]
  changed: string[]
}

export interface PushResult {
  created: number
  updated: number
  deleted: number
}

export interface ProjectInfo {
  orgId: string
  projectSlug: string
  projectName: string
  environments: string[]
}

export interface WhoAmI {
  userId: string
  email: string
  orgId: string
  orgSlug: string
  orgName: string
  plan: 'free' | 'team'
}

interface RemoteVariablesResponse {
  environmentId: string
  wrappedDek: string | null
  dekVersion: number | null
  variables: Array<{
    id: string
    key: string
    ciphertext: string
    nonce: string
    dekVersion: number
  }>
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function associatedDataFor(environmentId: string, key: string): Uint8Array {
  return enc.encode(`${environmentId}:${key}`)
}

function deriveTokenIdentity(token: string) {
  if (!token.startsWith('hnd_')) {
    throw new Error('Invalid token format: missing hnd_ prefix')
  }
  const privateKey = fromBase64Url(token.slice(4))
  if (privateKey.length !== 32) {
    throw new Error(
      `Invalid token key length: expected 32 bytes, got ${privateKey.length}`,
    )
  }
  // Derive the public key from the private key by computing the scalarmult of
  // the private key with the X25519 base point. libsodium exposes this via
  // crypto_box_keypair when given a seed, but here we already have the secret;
  // recompute via crypto_scalarmult_base. Wrapper not exported — use box_seal_open
  // round-trip is too costly. Instead, generate a fresh keypair locally and
  // derive ourselves: easier to just include pubkey in payload server-side.
  return { privateKey }
}

export class HandoffApiClient {
  private baseUrl: string
  private token: string

  constructor(config: HandoffClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.token = config.token
  }

  async pull(
    projectSlug: string,
    envName: string,
  ): Promise<Record<string, string>> {
    await ready()
    const remote = await this.request<RemoteVariablesResponse>('/api/cli/pull', {
      method: 'POST',
      body: JSON.stringify({ projectSlug, envName }),
    })
    return decryptVariables(this.token, remote)
  }

  async push(
    projectSlug: string,
    envName: string,
    variables: Record<string, string>,
  ): Promise<PushResult> {
    await ready()
    const remote = await this.request<RemoteVariablesResponse>('/api/cli/diff', {
      method: 'POST',
      body: JSON.stringify({ projectSlug, envName }),
    })
    if (!remote.wrappedDek || remote.dekVersion === null) {
      throw new Error(
        'This token has no wrapped key. Re-create it from the dashboard.',
      )
    }
    const dek = unwrapWithToken(this.token, remote.wrappedDek)
    try {
      const entries = await Promise.all(
        Object.entries(variables).map(async ([key, value]) => {
          const payload = encryptWithKey(
            enc.encode(value),
            dek,
            associatedDataFor(remote.environmentId, key),
          )
          return {
            key,
            ciphertext: toBase64(payload.ciphertext),
            nonce: toBase64(payload.nonce),
            dekVersion: remote.dekVersion!,
          }
        }),
      )
      return this.request<PushResult>('/api/cli/push', {
        method: 'POST',
        body: JSON.stringify({ projectSlug, envName, entries }),
      })
    } finally {
      dek.fill(0)
    }
  }

  async diff(
    projectSlug: string,
    envName: string,
    variables: Record<string, string>,
  ): Promise<DiffResult> {
    const remote = await this.pull(projectSlug, envName)
    const remoteKeys = new Set(Object.keys(remote))
    const localKeys = new Set(Object.keys(variables))
    return {
      added: [...localKeys].filter((k) => !remoteKeys.has(k)),
      removed: [...remoteKeys].filter((k) => !localKeys.has(k)),
      changed: [...localKeys].filter(
        (k) => remoteKeys.has(k) && variables[k] !== remote[k],
      ),
    }
  }

  async init(projectSlug: string): Promise<ProjectInfo> {
    return this.request<ProjectInfo>('/api/cli/init', {
      method: 'POST',
      body: JSON.stringify({ projectSlug }),
    })
  }

  async whoami(): Promise<WhoAmI> {
    return this.request<WhoAmI>('/api/cli/whoami', { method: 'GET' })
  }

  private async request<T>(
    path: string,
    options: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    })

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      const text = await response.text().catch(() => '')
      const finalUrl =
        response.url && response.url !== url
          ? ` (after redirect to ${response.url})`
          : ''
      throw new HandoffApiError(
        `Expected JSON from ${url}${finalUrl} but got "${contentType || 'no content-type'}" (status ${response.status}). ` +
          `First 200 bytes: ${text.slice(0, 200)}`,
        response.status,
        'INVALID_RESPONSE',
      )
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null
      const message =
        body && typeof body.error === 'string'
          ? body.error
          : `HTTP ${response.status}`
      const code = body && typeof body.code === 'string' ? body.code : undefined
      throw new HandoffApiError(message, response.status, code, body)
    }

    const body = (await response.json()) as ApiResponse<T>
    if ('error' in body) {
      throw new HandoffApiError(body.error, response.status, body.code, body)
    }

    return body.data
  }
}

function decryptVariables(
  token: string,
  remote: RemoteVariablesResponse,
): Record<string, string> {
  if (!remote.wrappedDek || remote.dekVersion === null) {
    if (remote.variables.length === 0) return {}
    throw new Error(
      'This token has no wrapped key. Re-create it from the dashboard.',
    )
  }
  const dek = unwrapWithToken(token, remote.wrappedDek)
  try {
    const out: Record<string, string> = {}
    for (const v of remote.variables) {
      const plaintext = decryptWithKey(
        {
          ciphertext: fromBase64(v.ciphertext),
          nonce: fromBase64(v.nonce),
        },
        dek,
        associatedDataFor(remote.environmentId, v.key),
      )
      out[v.key] = dec.decode(plaintext)
    }
    return out
  } finally {
    dek.fill(0)
  }
}

function unwrapWithToken(token: string, wrappedDekB64: string): Uint8Array {
  const { privateKey } = deriveTokenIdentity(token)
  const publicKey = derivePublicKey(privateKey)
  return openSealedBox(fromBase64(wrappedDekB64), publicKey, privateKey)
}

export class HandoffApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'HandoffApiError'
  }
}
