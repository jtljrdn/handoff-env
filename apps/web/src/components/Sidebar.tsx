import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Layers,
  ChevronRight,
  CreditCard,
  Building2,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import { cn } from '#/lib/utils'
import { authClient } from '#/lib/auth-client'
import { getDashboardDataFn } from '#/lib/server-fns/dashboard'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { OrgLogo } from './org/OrgLogo'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  )
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeOrg = authClient.useActiveOrganization()

  const { data: sidebarData } = useQuery({
    queryKey: ['sidebar-data'],
    queryFn: () => getDashboardDataFn(),
    staleTime: 30_000,
  })

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const result = await authClient.organization.list()
      return result.data ?? []
    },
  })

  function toggleProject(e: React.MouseEvent, projectId: string) {
    e.preventDefault()
    e.stopPropagation()
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  async function switchOrg(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId })
    await queryClient.invalidateQueries()
    await router.invalidate()
  }

  const orgName = activeOrg.data?.name ?? sidebarData?.org.name ?? ''
  const orgInitial = orgName.charAt(0).toUpperCase() || '?'
  const activeOrgId = activeOrg.data?.id ?? sidebarData?.org.id

  const orgLogo = activeOrg.data?.logo ?? sidebarData?.org.logo ?? ''

  return (
    <aside className="flex h-full flex-col border-r border-sidebar-border bg-sidebar">
      {/* Org switcher */}
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2.5 rounded-md transition-colors hover:bg-sidebar-accent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                collapsed ? 'justify-center p-1.5' : 'w-full px-2 py-1.5',
              )}
            >
              <OrgLogo logo={orgLogo} name={orgName} size="sm" />
              {!collapsed && (
                <>
                  <span className="truncate text-sm font-medium text-sidebar-foreground">
                    {orgName}
                  </span>

                  <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-sidebar-foreground/40" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {organizations?.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => switchOrg(org.id)}
                className="gap-2.5"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-[var(--h-accent-subtle)] text-xs font-medium text-[var(--h-text)]">
                  {org.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{org.name}</span>
                {org.id === activeOrgId && (
                  <Check className="ml-auto size-3.5 text-[var(--h-accent)]" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <NavLink
          to="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          collapsed={collapsed}
        />

        {/* Projects section */}
        <div className="mt-5">
          {!collapsed && (
            <span className="mb-1 block px-2 text-[0.6875rem] font-medium uppercase tracking-wider text-sidebar-foreground/40">
              Projects
            </span>
          )}

          {collapsed && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-full items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              title="Projects (expand to view)"
            >
              <Layers className="size-4" />
            </button>
          )}

          {!collapsed &&
            sidebarData?.projects.map((project) => (
              <div key={project.id}>
                <div className="flex h-8 w-full items-center rounded-md text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
                  <button
                    type="button"
                    onClick={(e) => toggleProject(e, project.id)}
                    className="flex h-full shrink-0 items-center px-2"
                  >
                    <ChevronRight
                      className={cn(
                        'size-3 shrink-0 transition-transform duration-200 motion-reduce:duration-0',
                        expandedProjects.has(project.id) && 'rotate-90',
                      )}
                    />
                  </button>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="flex h-full flex-1 items-center truncate"
                    activeProps={{
                      className: 'text-sidebar-accent-foreground font-medium',
                    }}
                  >
                    {project.name}
                  </Link>
                </div>

                {/* Expandable sub-items */}
                <div
                  className="grid transition-[grid-template-rows] duration-200 motion-reduce:duration-0"
                  style={{
                    gridTemplateRows: expandedProjects.has(project.id)
                      ? '1fr'
                      : '0fr',
                    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="py-0.5 pl-[1.375rem]">
                      <SubNavLink
                        to="/projects/$projectId"
                        params={{ projectId: project.id }}
                        label="Variables"
                        exact
                      />
                      <SubNavLink
                        to="/projects/$projectId/settings"
                        params={{ projectId: project.id }}
                        label="Settings"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {!collapsed && sidebarData?.projects.length === 0 && (
            <p className="px-2 py-2 text-xs text-sidebar-foreground/35">
              No projects yet
            </p>
          )}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-sidebar-border px-2 py-3">
        {sidebarData?.currentUserRole === 'owner' && (
          <NavLink
            to="/billing"
            icon={CreditCard}
            label="Billing"
            collapsed={collapsed}
          />
        )}
        {sidebarData?.currentUserRole !== 'member' && (
          <NavLink
            to="/organization"
            icon={Building2}
            label="Organization"
            collapsed={collapsed}
            exact
          />
        )}
        {sidebarData?.currentUserRole && (
          <NavLink
            to="/organization/api-keys"
            icon={KeyRound}
            label="API Keys"
            collapsed={collapsed}
          />
        )}

        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'mt-2 flex h-8 w-full items-center rounded-md text-sm text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed ? 'justify-center' : 'gap-3 px-2',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span>Collapse</span>
              <kbd className="ml-auto rounded border border-sidebar-border bg-sidebar px-1 py-0.5 font-mono text-[0.625rem] text-sidebar-foreground/30">
                {'\u2318'}B
              </kbd>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

function NavLink({
  to,
  icon: Icon,
  label,
  collapsed,
  exact,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  collapsed: boolean
  exact?: boolean
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      activeProps={{
        className:
          'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
      }}
      inactiveProps={{
        className: 'text-sidebar-foreground/70',
      }}
      className={cn(
        'flex h-8 items-center rounded-md text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed ? 'justify-center' : 'gap-3 px-2',
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function SubNavLink({
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
        className: 'text-sidebar-accent-foreground font-medium',
      }}
      inactiveProps={{
        className: 'text-sidebar-foreground/50',
      }}
      className="flex h-7 w-full items-center rounded-md px-2 text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      {label}
    </Link>
  )
}
