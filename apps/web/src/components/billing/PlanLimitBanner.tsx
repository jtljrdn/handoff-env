import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import type { OrgRole } from '@handoff-env/types'

const STORAGE_PREFIX = 'handoff.plan-banner-dismissed:'

function dismissalKey(orgId: string) {
  return `${STORAGE_PREFIX}${orgId}`
}

function stateSignature(atProjectLimit: boolean, atMemberLimit: boolean) {
  return [atProjectLimit ? 'p' : '', atMemberLimit ? 'm' : ''].join('|')
}

export function PlanLimitBanner({
  orgId,
  role,
  atProjectLimit,
  atMemberLimit,
}: {
  orgId: string
  role: OrgRole
  atProjectLimit: boolean
  atMemberLimit: boolean
}) {
  const currentSignature = stateSignature(atProjectLimit, atMemberLimit)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(dismissalKey(orgId))
      setDismissed(stored === currentSignature)
    } catch {
      // localStorage unavailable — behave as un-dismissed
      setDismissed(false)
    }
  }, [orgId, currentSignature])

  if (dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(dismissalKey(orgId), currentSignature)
    } catch {
      /* no-op */
    }
    setDismissed(true)
  }

  const isOwner = role === 'owner'
  const limits: string[] = []
  if (atProjectLimit) limits.push('projects')
  if (atMemberLimit) limits.push('members')

  const isAtLimit = limits.length > 0
  const limitText = limits.join(' and ')

  const { title, detail } = (() => {
    if (!isAtLimit) {
      return {
        title: "You're on the Free plan.",
        detail:
          'Upgrade to Team for unlimited projects, environments, and CLI/API access.',
      }
    }
    if (isOwner) {
      return {
        title: `You've reached the Free plan ${limitText} limit.`,
        detail: `Upgrade to Team to add more ${limitText} and unlock CLI, versioning, and 180-day audit history.`,
      }
    }
    return {
      title: `Your organization has reached the Free plan ${limitText} limit.`,
      detail:
        'Ask your organization owner to upgrade to Team for unlimited access.',
    }
  })()

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--h-accent)]/40 bg-[var(--h-accent-subtle)] px-4 py-3 text-sm">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--h-accent)]" />
      <div className="flex-1">
        <p className="font-medium text-[var(--h-text)]">{title}</p>
        <p className="mt-0.5 text-[var(--h-text-2)]">{detail}</p>
      </div>
      {isOwner && (
        <Link
          to="/billing"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--h-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Upgrade
          <ArrowRight className="size-3.5" />
        </Link>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--h-text-3)] transition-colors hover:bg-[var(--h-accent)]/10 hover:text-[var(--h-text-2)]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
