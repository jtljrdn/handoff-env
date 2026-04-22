import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getDashboardDataFn } from '#/lib/server-fns/dashboard'
import { InviteModal } from '#/components/org/InviteModal'
import { NewProjectModal } from '#/components/dashboard/NewProjectModal'
import { RecentsRow } from '#/components/dashboard/RecentsRow'
import { ProjectList } from '#/components/dashboard/ProjectList'
import { ActivityDropdown } from '#/components/dashboard/ActivityDropdown'
import { EmptyDashboard } from '#/components/dashboard/EmptyDashboard'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { Plus } from 'lucide-react'

const DASHBOARD_QUERY_KEY = ['sidebar-data'] as const

export const Route = createFileRoute('/_authed/dashboard')({
  beforeLoad: async ({ context }) => {
    if (!context.onboardingStatus.hasOrganization) {
      throw redirect({ to: '/onboarding' })
    }
  },
  loader: async ({ context }) => {
    return context.queryClient.ensureQueryData({
      queryKey: DASHBOARD_QUERY_KEY,
      queryFn: () => getDashboardDataFn(),
      staleTime: 0,
    })
  },
  component: DashboardPage,
})

function DashboardPage() {
  const router = useRouter()
  const initialData = Route.useLoaderData()
  const { data = initialData } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => getDashboardDataFn(),
    initialData,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const [showNewProject, setShowNewProject] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  const isEmpty = data.projects.length === 0
  const canInvite = data.currentUserRole !== 'member' && !data.atMemberLimit

  const newProjectTooltip = data.atProjectLimit
    ? data.currentUserRole === 'owner'
      ? `Project limit reached (${data.limits.maxProjects} on Free). Upgrade to add more.`
      : 'Project limit reached. Ask the owner to upgrade.'
    : undefined

  const newProjectButton = (
    <Button
      onClick={() => setShowNewProject(true)}
      disabled={data.atProjectLimit}
      size="sm"
    >
      <Plus className="size-3.5" />
      New project
    </Button>
  )

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-6 md:px-10 md:pt-8">
      <div>
        <div className="flex items-center justify-end gap-2">
          <ActivityDropdown entries={data.activity} />
          {newProjectTooltip ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    {newProjectButton}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-center">
                  {newProjectTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            newProjectButton
          )}
        </div>

        {isEmpty ? (
          <div className="mt-10">
            <EmptyDashboard
              orgName={data.org.name}
              onNewProject={() => setShowNewProject(true)}
            />
          </div>
        ) : (
          <>
            <div className="mt-8">
              <RecentsRow recents={data.recents} />
            </div>
            <div className="mt-10">
              <ProjectList
                projects={data.projects}
                onInvite={() => setShowInvite(true)}
                canInvite={canInvite}
              />
            </div>
          </>
        )}
      </div>

      <InviteModal
        orgId={data.org.id}
        currentUserRole={data.currentUserRole}
        open={showInvite}
        onOpenChange={setShowInvite}
      />

      <NewProjectModal
        open={showNewProject}
        onOpenChange={setShowNewProject}
        onCreated={() => {
          setShowNewProject(false)
          router.invalidate()
        }}
      />
    </div>
  )
}
