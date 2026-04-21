import pc from 'picocolors'

export const ui = {
  info(message: string): void {
    process.stdout.write(`${pc.cyan('i')} ${message}\n`)
  },
  success(message: string): void {
    process.stdout.write(`${pc.green('✓')} ${message}\n`)
  },
  warn(message: string): void {
    process.stderr.write(`${pc.yellow('!')} ${message}\n`)
  },
  error(message: string): void {
    process.stderr.write(`${pc.red('✗')} ${message}\n`)
  },
  plain(message: string): void {
    process.stdout.write(message + '\n')
  },
  dim(message: string): string {
    return pc.dim(message)
  },
}

export function renderEnvText(vars: Record<string, string>): string {
  const keys = Object.keys(vars).sort()
  return keys
    .map((k) => `${k}=${escapeEnvValue(vars[k] ?? '')}`)
    .join('\n') + (keys.length ? '\n' : '')
}

function escapeEnvValue(value: string): string {
  if (value === '') return ''
  if (/[\s"'#=$`\\]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

export function formatDiff(diff: {
  added: string[]
  removed: string[]
  changed: string[]
}): string {
  const lines: string[] = []
  for (const k of diff.added) lines.push(pc.green(`  + ${k}`))
  for (const k of diff.changed) lines.push(pc.yellow(`  ~ ${k}`))
  for (const k of diff.removed) lines.push(pc.red(`  - ${k}`))
  if (lines.length === 0) return pc.dim('  (no changes)')
  return lines.join('\n')
}
