import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { getProjectByIdFn } from '#/lib/server-fns/projects'
import {
  getEnvironmentLimitInfoFn,
  listEnvironmentsFn,
} from '#/lib/server-fns/environments'

export const Route = createFileRoute('/_authed/projects/$projectId')({
  loader: async ({ params, context }) => {
    const [project, environments, envLimitInfo] = await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ['project', params.projectId],
        queryFn: () => getProjectByIdFn({ data: { projectId: params.projectId } }),
        staleTime: 30_000,
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['environments', params.projectId],
        queryFn: () => listEnvironmentsFn({ data: { projectId: params.projectId } }),
        staleTime: 30_000,
      }),
      context.queryClient.ensureQueryData({
        queryKey: ['environment-limit', params.projectId],
        queryFn: () =>
          getEnvironmentLimitInfoFn({ data: { projectId: params.projectId } }),
        staleTime: 30_000,
      }),
    ])

    if (!project) {
      throw redirect({ to: '/dashboard' })
    }

    return { project, environments, envLimitInfo }
  },
  component: ProjectLayout,
})

function ProjectLayout() {
  const { projectId } = Route.useParams()
  const loaderData = Route.useLoaderData()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectByIdFn({ data: { projectId } }),
    staleTime: 30_000,
    initialData: loaderData.project,
  })

  useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => listEnvironmentsFn({ data: { projectId } }),
    staleTime: 30_000,
    initialData: loaderData.environments,
  })

  return (
    <div className="px-6 py-8">
      <div className="rise-in">
        <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            to="/dashboard"
            className="transition-colors hover:text-foreground"
          >
            Projects
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-medium text-foreground">{project?.name}</span>
        </div>

        <div className="mb-6 mt-4 flex items-center gap-4 border-b">
          <NavTab
            to="/projects/$projectId"
            params={{ projectId }}
            label="Variables"
            exact
          />
          <NavTab
            to="/projects/$projectId/settings"
            params={{ projectId }}
            label="Settings"
          />
        </div>

        <Outlet />
      </div>
    </div>
  )
}

function NavTab({
  to,
  params,
  label,
  exact,
}: {
  to: string
  params: Record<string, string>
  label: string
  exact?: boolean
}) {
  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact }}
      activeProps={{
        className: 'border-[var(--h-accent)] text-foreground',
      }}
      inactiveProps={{
        className: 'border-transparent text-muted-foreground',
      }}
      className="-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors hover:text-foreground"
    >
      {label}
    </Link>
  )
}
