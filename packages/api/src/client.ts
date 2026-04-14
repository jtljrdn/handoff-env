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
  orgSlug: string
  orgName: string
  projectSlug: string
  projectName: string
  environments: string[]
}

export class HandoffApiClient {
  private baseUrl: string
  private token: string

  constructor(config: HandoffClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.token = config.token
  }

  async pull(
    orgSlug: string,
    projectSlug: string,
    envName: string,
  ): Promise<Record<string, string>> {
    return this.request<Record<string, string>>('/api/cli/pull', {
      method: 'POST',
      body: JSON.stringify({ orgSlug, projectSlug, envName }),
    })
  }

  async push(
    orgSlug: string,
    projectSlug: string,
    envName: string,
    variables: Record<string, string>,
  ): Promise<PushResult> {
    return this.request<PushResult>('/api/cli/push', {
      method: 'POST',
      body: JSON.stringify({ orgSlug, projectSlug, envName, variables }),
    })
  }

  async diff(
    orgSlug: string,
    projectSlug: string,
    envName: string,
    variables: Record<string, string>,
  ): Promise<DiffResult> {
    return this.request<DiffResult>('/api/cli/diff', {
      method: 'POST',
      body: JSON.stringify({ orgSlug, projectSlug, envName, variables }),
    })
  }

  async init(
    orgSlug: string,
    projectSlug: string,
  ): Promise<ProjectInfo> {
    return this.request<ProjectInfo>('/api/cli/init', {
      method: 'POST',
      body: JSON.stringify({ orgSlug, projectSlug }),
    })
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
      const body = (await response.json().catch(() => null)) as ApiResponse<T> | null
      const message =
        body && 'error' in body ? body.error : `HTTP ${response.status}`
      throw new HandoffApiError(message, response.status)
    }

    const body = (await response.json()) as ApiResponse<T>
    if ('error' in body) {
      throw new HandoffApiError(body.error, response.status)
    }

    return body.data
  }
}

export class HandoffApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'HandoffApiError'
  }
}
