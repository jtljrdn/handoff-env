import { chmod, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import pkg from '../../package.json' with { type: 'json' }
import { CliError } from '../lib/errors'
import { compareSemver } from '../lib/semver'
import { ui } from '../lib/ui'

const REPO = 'jtljrdn/handoff-env'
const MIN_BINARY_BYTES = 1_000_000

export interface UpdateOptions {
  pm?: string
  check?: boolean
  force?: boolean
}

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

type InstallKind =
  | { kind: 'binary'; binaryPath: string }
  | { kind: 'npm'; pm: PackageManager }
  | { kind: 'npx' }

export async function updateCommand(opts: UpdateOptions): Promise<void> {
  const current = pkg.version
  const install = detectInstall(opts.pm)

  if (install.kind === 'npx') {
    ui.info('npx always runs the latest published version. Nothing to update.')
    return
  }

  const latest =
    install.kind === 'npm' ? await fetchNpmLatest() : await fetchGithubLatest()

  const cmp = compareSemver(latest, current)
  if (cmp <= 0 && !opts.force) {
    ui.success(`Already up to date (v${current}).`)
    return
  }

  if (cmp > 0) {
    ui.info(`Updating handoff: v${current} -> v${latest}`)
  } else {
    ui.info(`Reinstalling handoff v${current} (--force).`)
  }

  if (opts.check) return

  if (install.kind === 'npm') {
    await runPmInstall(install.pm)
    ui.success(`Updated handoff via ${install.pm}.`)
    return
  }

  await downloadBinary(install.binaryPath, latest)
  ui.success(`Updated handoff to v${latest} at ${install.binaryPath}.`)
}

function detectInstall(pmOverride?: string): InstallKind {
  if (pmOverride) {
    return { kind: 'npm', pm: parsePm(pmOverride) }
  }

  const execName = path.basename(process.execPath).toLowerCase()
  if (execName === 'handoff' || execName === 'handoff.exe') {
    return { kind: 'binary', binaryPath: process.execPath }
  }

  const scriptPath = (process.argv[1] ?? '').replace(/\\/g, '/')
  const lower = scriptPath.toLowerCase()

  if (lower.includes('/_npx/') || lower.includes('/.npm/_npx/')) {
    return { kind: 'npx' }
  }

  if (lower.includes('/.pnpm/') || lower.includes('/pnpm/global/')) {
    return { kind: 'npm', pm: 'pnpm' }
  }
  if (lower.includes('/.yarn/')) {
    return { kind: 'npm', pm: 'yarn' }
  }
  if (lower.includes('/.bun/install/global/')) {
    return { kind: 'npm', pm: 'bun' }
  }
  return { kind: 'npm', pm: 'npm' }
}

function parsePm(value: string): PackageManager {
  const v = value.toLowerCase()
  if (v === 'npm' || v === 'pnpm' || v === 'yarn' || v === 'bun') return v
  throw new CliError(
    `Unknown package manager: ${value}. Use one of npm, pnpm, yarn, bun.`,
  )
}

async function fetchNpmLatest(): Promise<string> {
  const res = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    throw new CliError(
      `Could not check latest version on npm (HTTP ${res.status}).`,
    )
  }
  const data = (await res.json()) as { version?: unknown }
  if (typeof data.version !== 'string') {
    throw new CliError('npm registry response missing version.')
  }
  return data.version
}

async function fetchGithubLatest(): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    { headers: { accept: 'application/vnd.github+json' } },
  )
  if (!res.ok) {
    throw new CliError(
      `Could not check latest GitHub release (HTTP ${res.status}).`,
    )
  }
  const data = (await res.json()) as { tag_name?: unknown }
  if (typeof data.tag_name !== 'string') {
    throw new CliError('GitHub release response missing tag_name.')
  }
  return data.tag_name.replace(/^v/, '')
}

async function runPmInstall(pm: PackageManager): Promise<void> {
  const argsByPm: Record<PackageManager, string[]> = {
    npm: ['install', '-g', `${pkg.name}@latest`],
    pnpm: ['add', '-g', `${pkg.name}@latest`],
    yarn: ['global', 'add', `${pkg.name}@latest`],
    bun: ['add', '-g', `${pkg.name}@latest`],
  }
  const cmd = [pm, ...argsByPm[pm]]
  ui.plain(ui.dim(`$ ${cmd.join(' ')}`))

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(cmd, {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new CliError(
      `Could not run \`${pm}\`: ${msg}. Run \`${cmd.join(' ')}\` manually, or use --pm to pick a different package manager.`,
    )
  }

  const exit = await proc.exited
  if (exit !== 0) {
    throw new CliError(
      `${pm} exited with code ${exit}. Run \`${cmd.join(' ')}\` manually if the issue persists.`,
      exit ?? 1,
    )
  }
}

async function downloadBinary(
  targetPath: string,
  version: string,
): Promise<void> {
  if (process.platform === 'win32') {
    throw new CliError(
      'Windows cannot replace a running .exe in place. Download the new asset from ' +
        `https://github.com/${REPO}/releases/latest and replace ${targetPath} manually.`,
    )
  }

  const asset = pickAsset()
  if (!asset) {
    throw new CliError(
      `No prebuilt binary for ${process.platform}/${process.arch}. Install via \`npm install -g ${pkg.name}\` instead.`,
    )
  }

  const url = `https://github.com/${REPO}/releases/download/v${version}/${asset}`
  const dir = path.dirname(targetPath)
  const tmpFile = path.join(dir, `.handoff.update.${process.pid}.${Date.now()}`)

  ui.plain(ui.dim(`Downloading ${asset} from ${url}`))

  let res: Response
  try {
    res = await fetch(url, { redirect: 'follow' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new CliError(`Download failed: ${msg}`)
  }
  if (!res.ok || !res.body) {
    throw new CliError(`Download failed: ${url} (HTTP ${res.status}).`)
  }

  try {
    await Bun.write(Bun.file(tmpFile), res)
  } catch (err) {
    await unlink(tmpFile).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    throw new CliError(`Could not write to ${dir}: ${msg}`)
  }

  const { size } = await stat(tmpFile)
  if (size < MIN_BINARY_BYTES) {
    await unlink(tmpFile).catch(() => {})
    throw new CliError(
      `Downloaded file is only ${size} bytes; likely a 404 or redirect at ${url}.`,
    )
  }

  await chmod(tmpFile, 0o755)
  await rename(tmpFile, targetPath)
}

function pickAsset(): string | undefined {
  const { platform, arch } = process
  if (platform === 'darwin' && arch === 'arm64') return 'handoff-darwin-arm64'
  if (platform === 'darwin' && arch === 'x64') return 'handoff-darwin-x64'
  if (platform === 'linux' && arch === 'x64') return 'handoff-linux-x64'
  if (platform === 'linux' && arch === 'arm64') return 'handoff-linux-arm64'
  if (platform === 'win32' && arch === 'x64') return 'handoff-win-x64.exe'
  return undefined
}

