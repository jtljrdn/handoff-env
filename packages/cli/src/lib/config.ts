import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const PROJECT_CONFIG_DIR = '.handoff'
const PROJECT_CONFIG_FILE = 'config.json'

export interface ProjectConfig {
  projectSlug: string
  defaultEnv?: string
  apiUrl?: string
}

export interface AuthConfig {
  token: string
  apiUrl: string
}

export interface LoadedProjectConfig {
  config: ProjectConfig
  path: string
  root: string
}

function globalConfigDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    if (appData) return join(appData, 'handoff')
    return join(homedir(), 'AppData', 'Roaming', 'handoff')
  }
  const xdg = process.env.XDG_CONFIG_HOME
  if (xdg) return join(xdg, 'handoff')
  return join(homedir(), '.config', 'handoff')
}

function authPath(): string {
  return join(globalConfigDir(), 'auth.json')
}

const PRODUCTION_API_URL = 'https://gethandoff.dev'
const DEVELOPMENT_API_URL = 'http://localhost:3000'

/**
 * Resolve the Handoff API base URL.
 *
 * Precedence:
 *   1. `HANDOFF_API_URL` env var — explicit override for self-hosted users.
 *   2. If this is a production build (bundled via `bun build` or compiled
 *      binary), default to the production URL.
 *   3. Otherwise (running from source via `bun run src/index.ts`), default
 *      to localhost so the dev loop works without extra config.
 *
 * `process.env.HANDOFF_BUILD_MODE` is substituted to the literal string
 * `"production"` at build time via `bun build --define`. When running from
 * source, no substitution happens and the identifier resolves to whatever
 * the shell set (usually unset), landing in the localhost branch.
 */
export function defaultApiUrl(): string {
  const override = process.env.HANDOFF_API_URL
  if (override) return override
  if (process.env.HANDOFF_BUILD_MODE === 'production') return PRODUCTION_API_URL
  return DEVELOPMENT_API_URL
}

export async function loadAuth(): Promise<AuthConfig | null> {
  const path = authPath()
  if (!existsSync(path)) return null
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AuthConfig>
    if (!parsed.token) return null
    return {
      token: parsed.token,
      apiUrl: parsed.apiUrl ?? defaultApiUrl(),
    }
  } catch {
    return null
  }
}

export async function saveAuth(auth: AuthConfig): Promise<void> {
  const path = authPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(auth, null, 2), { mode: 0o600 })
}

export async function clearAuth(): Promise<void> {
  const path = authPath()
  if (existsSync(path)) {
    await rm(path)
  }
}

export function findProjectConfigPath(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir)
  while (true) {
    const candidate = join(dir, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export async function loadProjectConfig(
  startDir?: string,
): Promise<LoadedProjectConfig | null> {
  const path = findProjectConfigPath(startDir)
  if (!path) return null
  const raw = await readFile(path, 'utf8')
  const config = JSON.parse(raw) as ProjectConfig
  if (!config.projectSlug) {
    throw new Error(`Invalid project config at ${path}: missing "projectSlug".`)
  }
  return { config, path, root: dirname(dirname(path)) }
}

export async function saveProjectConfig(
  rootDir: string,
  config: ProjectConfig,
): Promise<string> {
  const dir = join(rootDir, PROJECT_CONFIG_DIR)
  await mkdir(dir, { recursive: true })
  const path = join(dir, PROJECT_CONFIG_FILE)
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', 'utf8')
  return path
}
