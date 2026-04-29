import { useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { History, Lock } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  actorInitials,
  actorLabel,
} from '#/components/dashboard/types'
import { listAuditFn } from '#/lib/server-fns/audit'
import type {
  AuditCursor,
  AuditPageRow,
} from '#/lib/services/audit'
import { actionLabel } from './action-labels'
import {
  AuditFilterBar,
  emptyFilter,
  type AuditFacets,
  type AuditFilterValue,
} from './AuditFilterBar'
import { AuditDetailSheet } from './AuditDetailSheet'
import { AuditExportButton } from './AuditExportButton'

export interface AuditLogTableProps {
  scope:
    | { kind: 'org' }
    | { kind: 'project'; projectId: string }
  plan: 'free' | 'team'
  facets: AuditFacets
  initialFilter?: Partial<AuditFilterValue>
}

type DecoratedRow = AuditPageRow & { createdAtLabel: string }

export function AuditLogTable({
  scope,
  plan,
  facets,
  initialFilter,
}: AuditLogTableProps) {
  const [filter, setFilter] = useState<AuditFilterValue>(() => ({
    ...emptyFilter(),
    ...initialFilter,
  }))
  const [activeRow, setActiveRow] = useState<AuditPageRow | null>(null)

  const queryFilter = useMemo(() => {
    const projectId =
      scope.kind === 'project' ? scope.projectId : filter.projectId
    return {
      projectId: projectId ?? null,
      environmentId: filter.environmentId,
      actorUserId: filter.actorUserId,
      actions: filter.actions.length > 0 ? filter.actions : null,
      targetKeySearch: filter.targetKeySearch || null,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
    }
  }, [scope, filter])

  const query = useInfiniteQuery({
    queryKey: ['audit', scope, queryFilter],
    initialPageParam: null as AuditCursor | null,
    queryFn: async ({ pageParam }) => {
      return listAuditFn({
        data: {
          ...queryFilter,
          cursor: pageParam,
          limit: 50,
        },
      })
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const allRows: DecoratedRow[] = useMemo(() => {
    return (
      query.data?.pages.flatMap((p) => p.rows as DecoratedRow[]) ?? []
    )
  }, [query.data])

  const lastPage = query.data?.pages[query.data.pages.length - 1]
  const retentionCutoff = lastPage?.retentionCutoff ?? null
  const lockedCount = lastPage?.lockedRowCountEstimate ?? 0
  const hasLockedBeyond = lastPage?.hasLockedBeyondRetention ?? false

  const isInitialLoading = query.isLoading
  const empty = !isInitialLoading && allRows.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <AuditFilterBar
            scope={scope.kind}
            value={filter}
            onChange={setFilter}
            facets={facets}
            retentionCutoffISO={retentionCutoff}
          />
        </div>
        <AuditExportButton plan={plan} filter={queryFilter} />
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[14rem]">When</TableHead>
              <TableHead className="w-[12rem]">Who</TableHead>
              <TableHead className="w-[14rem]">Action</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                </TableRow>
              ))}

            {!isInitialLoading && empty && (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center">
                  <History className="mx-auto mb-2 size-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No activity matches the current filters.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {allRows.map((row) => (
              <AuditTableRow
                key={row.id}
                row={row}
                onOpen={() => setActiveRow(row)}
              />
            ))}

            {hasLockedBeyond && plan === 'free' && (
              <TableRow className="bg-[var(--h-accent-subtle)]/30 hover:bg-[var(--h-accent-subtle)]/40">
                <TableCell colSpan={4} className="py-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Lock className="size-4 text-[var(--h-accent)]" />
                    <div className="flex-1">
                      <p className="font-medium">
                        {lockedCount}
                        {lockedCount >= 1000 ? '+' : ''} older{' '}
                        {lockedCount === 1 ? 'entry' : 'entries'} hidden
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Free plan keeps the last 14 days of audit history. Upgrade
                        to Team for 180-day access.
                      </p>
                    </div>
                    <Button asChild size="sm" variant="default">
                      <Link to="/billing">Upgrade</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      <AuditDetailSheet
        row={activeRow}
        onOpenChange={(o) => !o && setActiveRow(null)}
      />
    </div>
  )
}

function AuditTableRow({
  row,
  onOpen,
}: {
  row: DecoratedRow
  onOpen: () => void
}) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <TableCell>
        <div className="flex flex-col">
          <span className="tabular-nums text-sm">{row.createdAtLabel}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {new Date(row.createdAt).toLocaleString()}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] font-mono text-[10px] font-medium text-[var(--h-accent)]"
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
          <span className="truncate text-sm">
            {actorLabel({ name: row.actorName, email: row.actorEmail })}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-[10px]">
          {row.action}
        </Badge>
        <span className="ml-2 text-xs text-muted-foreground">
          {actionLabel(row.action)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm">
          {row.targetKey && (
            <span className="rounded border bg-[var(--h-surface)] px-1.5 py-0.5 font-mono text-xs">
              {row.targetKey}
            </span>
          )}
          {(row.projectName || row.environmentName) && (
            <span className="truncate text-muted-foreground">
              {row.projectName}
              {row.environmentName ? ` · ${row.environmentName}` : ''}
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
