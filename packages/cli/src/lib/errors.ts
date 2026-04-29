import pc from 'picocolors'
import { HandoffApiError } from '@handoff-env/api'

interface ExitInfo {
  code: number
  message: string
}

function formatWebUrl(apiUrl: string | undefined, path: string): string {
  const base = apiUrl ? apiUrl.replace(/\/$/, '') : ''
  return `${base}${path}`
}

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message)
    this.name = 'CliError'
  }
}

export function mapApiError(
  err: HandoffApiError,
  apiUrl?: string,
): ExitInfo {
  const { status, code, message, body } = err

  if (status === 401) {
    if (code === 'TOKEN_EXPIRED') {
      return {
        code: 2,
        message: 'Your session has expired. Run `handoff login` to re-authenticate.',
      }
    }
    if (code === 'TOKEN_REWRAP_REQUIRED') {
      return {
        code: 2,
        message:
          'Your API token was invalidated by a key rotation. Create a new token in the dashboard and run `handoff login` to use it.',
      }
    }
    return {
      code: 2,
      message: 'Not signed in. Run `handoff login` to get started.',
    }
  }

  if (status === 402) {
    const resource =
      body && typeof body === 'object' && 'resource' in body &&
      typeof (body as { resource: unknown }).resource === 'string'
        ? (body as { resource: string }).resource
        : undefined
    if (code === 'PLAN_LIMIT_REACHED' && resource === 'apiToken') {
      return {
        code: 3,
        message: `Free plan includes 3 CI/CD tokens. Revoke an unused token at ${formatWebUrl(apiUrl, '/organization/api-keys')}, or upgrade at ${formatWebUrl(apiUrl, '/billing')}.`,
      }
    }
    return { code: 3, message }
  }

  if (status === 403) {
    return {
      code: 4,
      message: message || "You don't have permission to do that. Ask an org admin.",
    }
  }

  if (status === 404) {
    return { code: 5, message }
  }

  return { code: 1, message }
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err instanceof HandoffApiError) return false
  const cause = (err as { cause?: { code?: string } }).cause
  const codeStr = cause?.code
  if (
    codeStr &&
    /^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ConnectionRefused)$/.test(
      codeStr,
    )
  ) {
    return true
  }
  return /fetch failed|ECONNREFUSED|ENOTFOUND|Unable to connect|connection refused/i.test(
    err.message,
  )
}

export function handleFatal(err: unknown, apiUrl?: string): never {
  if (err instanceof CliError) {
    process.stderr.write(pc.red(err.message) + '\n')
    process.exit(err.exitCode)
  }

  if (err instanceof HandoffApiError) {
    const { code, message } = mapApiError(err, apiUrl)
    process.stderr.write(pc.red(message) + '\n')
    process.exit(code)
  }

  if (isNetworkError(err)) {
    const target = apiUrl ?? 'the Handoff API'
    process.stderr.write(
      pc.red(
        `Could not reach ${target}. Check your connection, --api-url, or $HANDOFF_API_URL.`,
      ) + '\n',
    )
    process.exit(6)
  }

  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(pc.red(message) + '\n')
  process.exit(1)
}
