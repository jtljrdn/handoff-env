import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, History } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  actorInitials,
  actorLabel,
} from '#/components/dashboard/types'
import {
  listEnvironmentAuditFn,
  listVariableAuditFn,
} from '#/lib/server-fns/audit'
import type { AuditPageRow } from '#/lib/services/audit'
import { actionLabel } from './action-labels'

type DecoratedRow = AuditPageRow & { createdAtLabel: string }

export type ActivityPopoverScope =
  | { kind: 'environment'; environmentId: string; environmentName: string; projectId: string }
  | { kind: 'variable'; projectId: string; targetKey: string }

interface ActivityPopoverProps {
  scope: ActivityPopoverScope
  trigger?: React.ReactNode
  align?: 'start' | 'center' | 'end'
}

export function ActivityPopover({
  scope,
  trigger,
  align = 'end',
}: ActivityPopoverProps) {
  const [open, setOpen] = useState(false)

  const query = useQuery({
    queryKey: ['audit-popover', scope],
    enabled: open,
    staleTime: 15_000,
    queryFn: async (): Promise<DecoratedRow[]> => {
      if (scope.kind === 'environment') {
        return (await listEnvironmentAuditFn({
          data: { environmentId: scope.environmentId, limit: 10 },
        })) as DecoratedRow[]
      }
      return (await listVariableAuditFn({
        data: {
          projectId: scope.projectId,
          targetKey: scope.targetKey,
          limit: 10,
        },
      })) as DecoratedRow[]
    },
  })

  const heading =
    scope.kind === 'environment'
      ? `${scope.environmentName} activity`
      : `${scope.targetKey} activity`

  const linkSearch =
    scope.kind === 'environment'
      ? { environmentId: scope.environmentId }
      : { targetKeySearch: scope.targetKey }

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="View activity"
      title="Recent activity"
    >
      <History className="size-3" />
    </Button>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger ?? defaultTrigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h4 className="font-display text-sm font-medium tracking-tight">
            {heading}
          </h4>
          <span className="font-mono text-[10px] text-muted-foreground">
            last 10
          </span>
        </div>

        {query.isLoading && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {!query.isLoading && (query.data?.length ?? 0) === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No activity yet.
          </div>
        )}

        {!query.isLoading && (query.data?.length ?? 0) > 0 && (
          <ol className="max-h-72 divide-y overflow-y-auto">
            {query.data!.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2.5 px-3 py-2 text-sm"
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] font-mono text-[9px] font-medium text-[var(--h-accent)]"
                  title={actorLabel({
                    name: row.actorName,
                    email: row.actorEmail,
                  })}
                >
                  {actorInitials({
                    name: row.actorName,
                    email: row.actorEmail,
                  })}
                </span>
                <p className="min-w-0 flex-1 truncate">
                  <span>
                    {actorLabel({
                      name: row.actorName,
                      email: row.actorEmail,
                    })}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    {actionLabel(row.action)}
                  </span>{' '}
                  {row.targetKey && (
                    <span className="font-mono text-xs">{row.targetKey}</span>
                  )}
                </p>
                <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                  {row.createdAtLabel}
                </span>
              </li>
            ))}
          </ol>
        )}

        <Link
          to="/projects/$projectId/activity"
          params={{ projectId: scope.projectId }}
          search={linkSearch}
          onClick={() => setOpen(false)}
          className="flex items-center justify-between border-t px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        >
          View all activity
          <ArrowRight className="size-3" />
        </Link>
      </PopoverContent>
    </Popover>
  )
}
