const UNITS: Array<[number, string]> = [
  [60, 's'],
  [60, 'm'],
  [24, 'h'],
  [7, 'd'],
  [4.345, 'w'],
  [12, 'mo'],
  [Number.POSITIVE_INFINITY, 'y'],
]

export function formatRelativeTime(
  iso: string | null | undefined,
  now: number = Date.now(),
): string {
  if (!iso) return '–'
  const diff = Math.max(0, now - new Date(iso).getTime())
  let value = diff / 1000
  if (value < 5) return 'just now'
  for (const [step, label] of UNITS) {
    if (value < step) return `${Math.floor(value)}${label} ago`
    value /= step
  }
  return new Date(iso).toLocaleDateString()
}

export function isFresh(
  iso: string | null | undefined,
  hours = 24,
  now: number = Date.now(),
): boolean {
  if (!iso) return false
  return now - new Date(iso).getTime() < hours * 60 * 60 * 1000
}
