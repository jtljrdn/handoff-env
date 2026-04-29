import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { listAuditFacetsFn } from '#/lib/server-fns/audit'
import { getDashboardDataFn } from '#/lib/server-fns/dashboard'
import { AuditLogTable } from '#/components/audit/AuditLogTable'

export const Route = createFileRoute('/_authed/logs')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ['audit-facets', null],
        queryFn: () => listAuditFacetsFn({ data: { projectId: null } }),
        staleTime: 60_000,
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['dashboard-data'],
        queryFn: () => getDashboardDataFn(),
        staleTime: 30_000,
      }),
    ])
  },
  component: LogsPage,
})

function LogsPage() {
  const { data: facets } = useQuery({
    queryKey: ['audit-facets', null],
    queryFn: () => listAuditFacetsFn({ data: { projectId: null } }),
    staleTime: 60_000,
  })

  const { data: dash } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: () => getDashboardDataFn(),
    staleTime: 30_000,
  })

  if (!facets || !dash) return null

  return (
    <div className="px-6 py-8">
      <div className="rise-in">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--h-accent-subtle)]">
            <ScrollText className="size-4 text-[var(--h-accent)]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight">
              Audit log
            </h1>
            <p className="text-sm text-muted-foreground">
              Every action across your organization. Filter, search, and review
              the last {dash.plan === 'team' ? '180' : '14'} days of activity.
            </p>
          </div>
        </div>

        <AuditLogTable
          scope={{ kind: 'org' }}
          plan={dash.plan}
          facets={facets}
        />
      </div>
    </div>
  )
}
