import { accessSync, constants } from 'node:fs'
import pc from 'picocolors'

export interface SpawnOptions {
  override: boolean
}

export async function spawnWithEnv(
  argv: string[],
  injected: Record<string, string>,
  opts: SpawnOptions,
): Promise<number> {
  if (argv.length === 0) {
    throw new Error('handoff run: no command given.')
  }

  const baseEnv: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== 'string') continue
    if (k.startsWith('HANDOFF_')) continue
    baseEnv[k] = v
  }

  const merged = opts.override ? { ...baseEnv, ...injected } : { ...injected, ...baseEnv }

  if (opts.override) {
    const overridden = Object.keys(injected).filter((k) => k in baseEnv)
    if (overridden.length > 0) {
      process.stderr.write(
        pc.dim(
          `handoff: overriding ${overridden.length} env var(s): ${overridden.join(', ')}\n`,
        ),
      )
    }
  }

  // If the current working directory isn't readable (e.g. user switched via
  // `sudo -u other` from a home dir with mode 700), Bun's posix_spawn surfaces
  // the cwd read as "EACCES posix_spawn <child>" even for absolute child paths.
  // Chdir to a safe fallback so spawn's internal cwd probe can't fail.
  let cwd = process.cwd()
  try {
    accessSync(cwd, constants.R_OK | constants.X_OK)
  } catch {
    const fallback = process.env.HOME ?? '/tmp'
    try {
      process.chdir(fallback)
      cwd = fallback
    } catch {
      // leave as-is; spawn will fail with a clearer error than "EACCES"
    }
  }

  const proc = Bun.spawn(argv, {
    env: merged,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    cwd,
  })

  const forward = (signal: NodeJS.Signals) => {
    try {
      proc.kill(signal)
    } catch {
      // process already exited
    }
  }
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']
  for (const s of signals) process.on(s, forward)

  try {
    const exitCode = await proc.exited
    if (proc.signalCode) {
      return 128 + signalToNumber(proc.signalCode as NodeJS.Signals)
    }
    return exitCode ?? 1
  } finally {
    for (const s of signals) process.off(s, forward)
  }
}

function signalToNumber(signal: NodeJS.Signals): number {
  switch (signal) {
    case 'SIGINT':
      return 2
    case 'SIGTERM':
      return 15
    case 'SIGHUP':
      return 1
    case 'SIGKILL':
      return 9
    default:
      return 1
  }
}
