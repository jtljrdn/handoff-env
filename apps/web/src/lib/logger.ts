type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function resolveMinLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

const MIN_LEVEL = resolveMinLevel()
const IS_PROD = process.env.NODE_ENV === 'production'

const SENSITIVE_KEY_RE =
  /^(password|pass|secret|token|authorization|cookie|apiKey|api_key|privateKey|private_key|clientSecret|client_secret|stripe_secret|stripe_webhook_secret|encryptedValue|encrypted_value|iv|auth_tag|authTag|value)$/i

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Depth]'
  if (value == null) return value
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = '[Redacted]'
      } else {
        out[k] = redact(v, depth + 1)
      }
    }
    return out
  }
  return String(value)
}

function serializeError(err: unknown): LogContext {
  if (err instanceof Error) {
    const out: LogContext = {
      errName: err.name,
      errMessage: err.message,
      errStack: err.stack,
    }
    const anyErr = err as unknown as Record<string, unknown>
    if (typeof anyErr.code === 'string') out.errCode = anyErr.code
    return out
  }
  if (err instanceof Response) {
    return { errStatus: err.status, errStatusText: err.statusText }
  }
  return { err: redact(err) }
}

function format(level: LogLevel, msg: string, ctx: LogContext): string {
  const payload: LogContext = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(redact(ctx) as LogContext),
  }
  if (IS_PROD) return JSON.stringify(payload)

  const { ts, ...rest } = payload
  const extras = Object.entries(rest)
    .filter(([k]) => k !== 'level' && k !== 'msg')
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ')
  return `${ts} ${level.toUpperCase().padEnd(5)} ${msg}${extras ? ' ' + extras : ''}`
}

function emit(level: LogLevel, msg: string, ctx: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return
  const line = format(level, msg, ctx)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export interface Logger {
  debug(msg: string, ctx?: LogContext): void
  info(msg: string, ctx?: LogContext): void
  warn(msg: string, ctx?: LogContext): void
  error(msg: string, ctx?: LogContext): void
  child(bindings: LogContext): Logger
}

function makeLogger(baseCtx: LogContext): Logger {
  const merge = (ctx?: LogContext): LogContext =>
    ctx ? { ...baseCtx, ...ctx } : baseCtx
  return {
    debug: (msg, ctx) => emit('debug', msg, merge(ctx)),
    info: (msg, ctx) => emit('info', msg, merge(ctx)),
    warn: (msg, ctx) => emit('warn', msg, merge(ctx)),
    error: (msg, ctx) => emit('error', msg, merge(ctx)),
    child: (bindings) => makeLogger({ ...baseCtx, ...bindings }),
  }
}

export const logger = makeLogger({ app: 'handoff-web' })

export function errCtx(err: unknown, extra?: LogContext): LogContext {
  return { ...serializeError(err), ...(extra ?? {}) }
}

export function durationMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt)
}
