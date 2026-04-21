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

// The bearer token already scopes every CLI request to a single organization,
// so none of these methods take an org identifier — it's resolved server-side
// from the token in requireCliAuth.
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
    return this.request<Record<string, string>>('/api/cli/pull', {
      method: 'POST',
      body: JSON.stringify({ projectSlug, envName }),
    })
  }

  async push(
    projectSlug: string,
    envName: string,
    variables: Record<string, string>,
  ): Promise<PushResult> {
    return this.request<PushResult>('/api/cli/push', {
      method: 'POST',
      body: JSON.stringify({ projectSlug, envName, variables }),
    })
  }

  async diff(
    projectSlug: string,
    envName: string,
    variables: Record<string, string>,
  ): Promise<DiffResult> {
    return this.request<DiffResult>('/api/cli/diff', {
      method: 'POST',
      body: JSON.stringify({ projectSlug, envName, variables }),
    })
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
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    })

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
