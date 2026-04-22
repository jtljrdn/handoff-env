import { useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import { useMountEffect } from '#/hooks/useMountEffect'
import { cn } from '#/lib/utils'
import { envDot, type DashboardRecent } from './types'

export function RecentsRow({ recents }: { recents: DashboardRecent[] }) {
  const navigate = useNavigate()

  // Refs so the window-level keydown handler always reads the latest values
  // without needing to be rebound on every render.
  const recentsRef = useRef(recents)
  recentsRef.current = recents
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useMountEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      const list = recentsRef.current
      const idx = Number(e.key) - 1
      if (idx >= 0 && idx < list.length) {
        e.preventDefault()
        const r = list[idx]!
        void navigateRef.current({
          to: '/projects/$projectId',
          params: { projectId: r.projectId },
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (recents.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
          Jump back in
        </h2>
        <span className="hidden text-xs text-muted-foreground md:block">
          <kbd className="rounded border px-1 font-mono text-[10px]">1</kbd>–
          <kbd className="rounded border px-1 font-mono text-[10px]">{recents.length}</kbd> to jump
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {recents.map((r, i) => (
          <RecentTile key={`${r.projectId}-${r.environmentId}`} recent={r} index={i} total={recents.length} />
        ))}
      </div>
    </section>
  )
}

function RecentTile({
  recent,
  index,
  total,
}: {
  recent: DashboardRecent
  index: number
  total: number
}) {
  const featured = index === 0 && total >= 3

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: recent.projectId }}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4 transition-all',
        'hover:border-[var(--h-accent)] hover:shadow-sm',
        featured && 'md:col-span-2 md:row-span-1',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 rounded-full',
              recent.isFresh && 'pulse-accent',
            )}
            style={{ background: envDot(recent.environmentName) }}
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {recent.environmentName}
          </span>
        </div>
        <span className="flex size-5 items-center justify-center rounded border border-border/60 font-mono text-[10px] leading-none text-muted-foreground/70">
          {index + 1}
        </span>
      </div>

      <div className="flex-1">
        <p
          className={cn(
            'font-display font-bold tracking-tight text-foreground',
            featured ? 'text-xl' : 'text-base',
          )}
        >
          {recent.projectName}
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {recent.projectSlug}
        </p>
      </div>

      <div className="flex items-end justify-between text-xs text-muted-foreground">
        <div>
          <div>
            <span className="font-mono tabular-nums text-foreground">
              {recent.variableCount}
            </span>{' '}
            variable{recent.variableCount !== 1 ? 's' : ''}
          </div>
          <div className="mt-0.5">
            Updated {recent.lastActivityLabel}
          </div>
        </div>
        <ArrowUpRight className="size-4 translate-y-1 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100" />
      </div>
    </Link>
  )
}

