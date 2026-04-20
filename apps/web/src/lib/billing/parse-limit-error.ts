export type PlanLimitErrorPayload = {
  error: string
  code: 'PLAN_LIMIT_REACHED' | 'PLAN_UPGRADE_REQUIRED'
  limit: number
  current: number
  resource: string
}

export type ParsedActionError = {
  message: string
  isLimitError: boolean
  payload?: PlanLimitErrorPayload
}

function isLimitErrorPayload(value: unknown): value is PlanLimitErrorPayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.error === 'string' &&
    (v.code === 'PLAN_LIMIT_REACHED' || v.code === 'PLAN_UPGRADE_REQUIRED') &&
    typeof v.resource === 'string'
  )
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function parseActionError(
  err: unknown,
  fallback = 'Something went wrong.',
): ParsedActionError {
  if (!err) return { message: fallback, isLimitError: false }

  // TanStack server-fn forwards thrown Responses as Error instances with a
  // JSON body embedded in the message. We also handle direct Response objects
  // and plain Error instances.
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : ''

  const parsed = tryParseJson(raw)
  if (isLimitErrorPayload(parsed)) {
    return { message: parsed.error, isLimitError: true, payload: parsed }
  }

  // Some transports wrap the body under a "body" or "data" field.
  if (parsed && typeof parsed === 'object') {
    const nested =
      (parsed as { body?: unknown }).body ?? (parsed as { data?: unknown }).data
    if (isLimitErrorPayload(nested)) {
      return { message: nested.error, isLimitError: true, payload: nested }
    }
  }

  if (raw) return { message: raw, isLimitError: false }
  return { message: fallback, isLimitError: false }
}
