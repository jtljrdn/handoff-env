import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { listAuditFacetsFn } from '#/lib/server-fns/audit'
import { getDashboardDataFn } from '#/lib/server-fns/dashboard'
import { AuditLogTable } from '#/components/audit/AuditLogTable'

const activitySearchSchema = z.object({
  environmentId: z.string().optional(),
  actorUserId: z.string().optional(),
  targetKeySearch: z.string().optional(),
})

export const Route = createFileRoute('/_authed/projects/$projectId/activity')({
  validateSearch: activitySearchSchema,
  loader: async ({ params, context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ['audit-facets', params.projectId],
        queryFn: () =>
          listAuditFacetsFn({ data: { projectId: params.projectId } }),
        staleTime: 60_000,
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['dashboard-data'],
        queryFn: () => getDashboardDataFn(),
        staleTime: 30_000,
      }),
    ])
  },
  component: ProjectActivityPage,
})

function ProjectActivityPage() {
  const { projectId } = Route.useParams()
  const search = Route.useSearch()

  const { data: facets } = useQuery({
    queryKey: ['audit-facets', projectId],
    queryFn: () => listAuditFacetsFn({ data: { projectId } }),
    staleTime: 60_000,
  })

  const { data: dash } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: () => getDashboardDataFn(),
    staleTime: 30_000,
  })

  if (!facets || !dash) return null

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-lg font-medium tracking-tight">
          Activity
        </h2>
        <p className="text-sm text-muted-foreground">
          Every action taken in this project. Filter by action, person, or
          environment.
        </p>
      </div>
      <AuditLogTable
        scope={{ kind: 'project', projectId }}
        plan={dash.plan}
        facets={facets}
        initialFilter={{
          environmentId: search.environmentId ?? null,
          actorUserId: search.actorUserId ?? null,
          targetKeySearch: search.targetKeySearch ?? '',
        }}
      />
    </div>
  )
}
