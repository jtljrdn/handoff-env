import { spawn } from 'node:child_process'
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
  const [cmd, ...args] = argv as [string, ...string[]]

  // Build the base env from the parent process, but strip the CLI's own
  // credentials so they never reach the child. `injected` is applied *after*
  // this filter, so a user-defined var named HANDOFF_* in their handoff env
  // still reaches the child.
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

  return new Promise<number>((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      env: merged,
      shell: false,
    })

    const forward = (signal: NodeJS.Signals) => {
      if (!child.killed) child.kill(signal)
    }
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']
    for (const s of signals) process.on(s, forward)

    const cleanup = () => {
      for (const s of signals) process.off(s, forward)
    }

    child.on('error', (err) => {
      cleanup()
      reject(err)
    })
    child.on('exit', (code, signal) => {
      cleanup()
      if (signal) {
        // 128 + signal number is the POSIX convention.
        const num = signalToNumber(signal)
        resolve(128 + num)
        return
      }
      resolve(code ?? 1)
    })
  })
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
