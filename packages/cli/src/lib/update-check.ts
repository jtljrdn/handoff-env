import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import pc from 'picocolors'
import pkg from '../../package.json' with { type: 'json' }
import { globalConfigDir } from './config'
import { compareSemver } from './semver'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 5000

interface CheckCache {
  latest: string
  checkedAt: number
}

let knownLatest: string | null = null

function cachePath(): string {
  return join(globalConfigDir(), 'update-check.json')
}

function shouldSkip(): boolean {
  if (process.env.HANDOFF_NO_UPDATE_CHECK) return true
  if (process.env.CI) return true
  if (process.env.HANDOFF_BUILD_MODE !== 'production') return true
  return false
}

function readCache(): CheckCache | null {
  try {
    const parsed = JSON.parse(
      readFileSync(cachePath(), 'utf8'),
    ) as Partial<CheckCache>
    if (typeof parsed.latest !== 'string') return null
    if (typeof parsed.checkedAt !== 'number') return null
    return { latest: parsed.latest, checkedAt: parsed.checkedAt }
  } catch {
    return null
  }
}

function writeCache(cache: CheckCache): void {
  try {
    const path = cachePath()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(cache))
  } catch {
    // best effort; missing cache just means we re-check next run
  }
}

export function scheduleBackgroundCheck(): void {
  if (shouldSkip()) return

  const cache = readCache()
  if (cache) knownLatest = cache.latest
  if (cache && Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) return

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  if (typeof timer.unref === 'function') timer.unref()

  fetch(`https://registry.npmjs.org/${pkg.name}/latest`, {
    headers: { accept: 'application/json' },
    signal: ac.signal,
  })
    .then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { version?: unknown }
      if (typeof data.version !== 'string') return
      knownLatest = data.version
      writeCache({ latest: data.version, checkedAt: Date.now() })
    })
    .catch(() => {})
    .finally(() => clearTimeout(timer))
}

export function installUpdateNotice(currentVersion: string): void {
  if (shouldSkip()) return
  if (!process.stderr.isTTY) return

  process.on('exit', (code) => {
    if (code !== 0) return
    if (!knownLatest) return
    if (compareSemver(knownLatest, currentVersion) <= 0) return
    process.stderr.write(
      `\n${pc.cyan('Update available:')} v${currentVersion} ${pc.dim('->')} v${knownLatest}. Run ${pc.bold('handoff update')} to install.\n`,
    )
  })
}
