import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { cn } from '#/lib/utils'
import { getTrialStatusFn } from '#/lib/server-fns/trial'

export function TrialBadge() {
  const { data } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => getTrialStatusFn(),
    staleTime: 5 * 60 * 1000,
  })

  if (!data || data.status !== 'trialing') return null

  const urgent = data.daysLeft <= 3
  return (
    <Link
      to="/billing"
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors',
        urgent
          ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300'
          : 'bg-[var(--h-accent-subtle)] text-[var(--h-text-2)] hover:bg-[var(--h-accent-subtle)]/80 hover:text-[var(--h-text)]',
      )}
      title={`Trial ends ${new Date(data.trialEnd).toLocaleDateString()}`}
    >
      <Clock className="size-3" />
      Trial · {data.daysLeft} day{data.daysLeft === 1 ? '' : 's'} left
    </Link>
  )
}
