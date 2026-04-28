import * as prompts from '@clack/prompts'
import {
  buildShareEnvelope,
  randomBytes,
  ready,
  toBase64Url,
} from '@handoff-env/crypto'
import { requireProjectClient } from '../lib/api'
import { CliError } from '../lib/errors'
import { ui } from '../lib/ui'

export interface ShareOptions {
  env?: string
  ttl?: string
  maxViews?: string
  password?: string
  generate?: boolean
}

const TTL_PRESETS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '1d': 24 * 60 * 60,
  '7d': 7 * 24 * 60 * 60,
  '30d': 30 * 24 * 60 * 60,
}

function parseTtl(input: string | undefined): number {
  const oneDay = 24 * 60 * 60
  if (!input) return oneDay
  const preset = TTL_PRESETS[input.toLowerCase()]
  if (preset) return preset
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(input.trim())
  if (!match) {
    throw new CliError(
      `Invalid --ttl "${input}". Use 15m, 1h, 1d, 7d, 30d, or a number with s/m/h/d.`,
      12,
    )
  }
  const n = Number(match[1])
  const unit = (match[2] ?? 's').toLowerCase()
  const mult =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400
  const seconds = n * mult
  if (seconds < 60 || seconds > 30 * 86400) {
    throw new CliError('--ttl must be between 1 minute and 30 days.', 12)
  }
  return seconds
}

function parseMaxViews(input: string | undefined): number | null {
  if (!input || input === 'unlimited') return null
  const n = Number(input)
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    throw new CliError(
      '--max-views must be a positive integer up to 1000, or "unlimited".',
      12,
    )
  }
  return n
}

export async function shareCommand(
  key: string,
  opts: ShareOptions,
): Promise<void> {
  if (!key) throw new CliError('Variable key is required.', 12)

  const { client, project } = await requireProjectClient()
  const envName = opts.env ?? project.config.defaultEnv
  if (!envName) {
    throw new CliError(
      'No environment specified. Pass --env <name> or set defaultEnv in .handoff/config.json.',
      10,
    )
  }

  const ttlSeconds = parseTtl(opts.ttl)
  const maxViews = parseMaxViews(opts.maxViews)

  const variables = await client.pull(project.config.projectSlug, envName)
  const value = variables[key]
  if (value === undefined) {
    throw new CliError(
      `Variable "${key}" not found in environment "${envName}".`,
      13,
    )
  }

  await ready()

  let password: string
  if (opts.generate) {
    password = toBase64Url(randomBytes(16))
    ui.info(`Generated password: ${password}`)
  } else if (opts.password) {
    if (opts.password.length < 12) {
      throw new CliError('Password must be at least 12 characters.', 12)
    }
    password = opts.password
  } else {
    const answer = await prompts.password({
      message: 'Password for this share (12+ chars, leave blank to generate)',
      mask: '•',
    })
    if (prompts.isCancel(answer)) throw new CliError('Cancelled.', 0)
    const trimmed = String(answer).trim()
    if (!trimmed) {
      password = toBase64Url(randomBytes(16))
      ui.info(`Generated password: ${password}`)
    } else if (trimmed.length < 12) {
      throw new CliError('Password must be at least 12 characters.', 12)
    } else {
      password = trimmed
    }
  }

  const built = await buildShareEnvelope(value, password)

  const result = await client.createShare({
    projectSlug: project.config.projectSlug,
    envName,
    key,
    ttlSeconds,
    maxViews,
    ...built.envelope,
  })

  const url = `${result.url}#${built.linkSecret}`

  ui.success(`Share link created for ${key}`)
  ui.plain('')
  ui.plain(`URL:      ${url}`)
  ui.plain(`Password: ${password}`)
  ui.plain('')
  ui.plain(
    ui.dim(
      `Send the URL and password through different channels. Expires ${new Date(
        result.expiresAt,
      ).toLocaleString()}.`,
    ),
  )
}
