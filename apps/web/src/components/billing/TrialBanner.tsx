import { Link } from '@tanstack/react-router'
import { Clock, ArrowRight } from 'lucide-react'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'

interface TrialBannerProps {
  trialEnd: string
  daysLeft: number
}

export function TrialBanner({ trialEnd, daysLeft }: TrialBannerProps) {
  const urgent = daysLeft <= 3
  const formattedEnd = new Date(trialEnd).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4',
        urgent
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-[var(--h-border)] bg-[var(--h-accent-subtle)]/60',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-full',
            urgent
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
              : 'bg-[var(--h-accent-subtle)] text-[var(--h-accent)]',
          )}
        >
          <Clock className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--h-text)]">
            {daysLeft} day{daysLeft === 1 ? '' : 's'} left in your Team trial
          </p>
          <p className="mt-0.5 text-xs text-[var(--h-text-2)]">
            Trial ends {formattedEnd}. Add a payment method anytime to keep Team
            features.
          </p>
        </div>
      </div>
      <Button asChild size="sm">
        <Link to="/billing/checkout">
          Add payment method
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  )
}
