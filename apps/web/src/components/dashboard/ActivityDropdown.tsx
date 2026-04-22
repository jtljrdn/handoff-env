import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Activity } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  actorInitials,
  actorLabel,
  type DashboardActivityEntry,
} from './types'

const ACTION_VERBS: Record<string, string> = {
  'variable.create': 'added',
  'variable.update': 'updated',
  'variable.delete': 'removed',
  'variable.bulk': 'synced variables in',
  'project.create': 'created project',
  'project.delete': 'deleted project',
  'environment.create': 'added environment',
  'environment.delete': 'removed environment',
  'token.create': 'created API token',
  'token.revoke': 'revoked API token',
}

export function ActivityDropdown({
  entries,
}: {
  entries: DashboardActivityEntry[]
}) {
  const [open, setOpen] = useState(false)
  const hasEntries = entries.length > 0

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Activity className="size-3.5" />
          Activity
          {hasEntries && (
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              {entries.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-[min(calc(100vw-2rem),420px)] p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className="font-display text-sm font-medium tracking-tight">
            Recent activity
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">
            last 20
          </span>
        </div>
        {!hasEntries ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Activity shows up here as your team edits variables.
          </div>
        ) : (
          <ol className="max-h-[60vh] divide-y overflow-y-auto">
            {entries.map((entry) => (
              <ActivityRow
                key={entry.id}
                entry={entry}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ol>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActivityRow({
  entry,
  onNavigate,
}: {
  entry: DashboardActivityEntry
  onNavigate: () => void
}) {
  const verb = ACTION_VERBS[entry.action] ?? entry.action
  const projectLabel =
    entry.projectName && entry.environmentName
      ? `${entry.projectName} · ${entry.environmentName}`
      : (entry.projectName ?? '')

  const body = (
    <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <span
        title={actorLabel(entry.actor)}
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] font-mono text-[10px] font-medium text-[var(--h-accent)]"
      >
        {actorInitials(entry.actor)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate">
          <span className="text-foreground">{actorLabel(entry.actor)}</span>{' '}
          <span className="text-muted-foreground">{verb}</span>{' '}
          {entry.targetKey && (
            <span className="font-mono text-xs text-foreground">
              {entry.targetKey}
            </span>
          )}
          {projectLabel && (
            <>
              {entry.targetKey && (
                <span className="text-muted-foreground"> in </span>
              )}
              {!entry.targetKey && (
                <span className="text-muted-foreground"> </span>
              )}
              <span className="text-foreground/80">{projectLabel}</span>
            </>
          )}
        </p>
      </div>
      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
        {entry.createdAtLabel}
      </span>
    </div>
  )

  if (entry.projectId) {
    return (
      <li>
        <Link
          to="/projects/$projectId"
          params={{ projectId: entry.projectId }}
          onClick={onNavigate}
          className="block transition-colors hover:bg-accent/40 focus:bg-accent/40 focus:outline-none"
        >
          {body}
        </Link>
      </li>
    )
  }
  return <li>{body}</li>
}
