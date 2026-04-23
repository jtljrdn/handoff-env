import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getAuthContextFn } from '#/lib/server-fns/auth'

export const Route = createFileRoute('/_admin')({
  beforeLoad: async ({ context }) => {
    const authContext = await context.queryClient.ensureQueryData({
      queryKey: ['auth-context'],
      queryFn: () => getAuthContextFn(),
      staleTime: 60_000,
    })

    if (!authContext.session) {
      throw redirect({ to: '/sign-in', search: {} })
    }
    if (authContext.session.user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }

    return { session: authContext.session }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-[var(--h-border)]">
        <div className="page-wrap flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Dashboard
            </Link>
            <span className="font-display text-lg font-bold tracking-tight">
              Admin
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <AdminNavLink to="/admin/requests">Requests</AdminNavLink>
            <AdminNavLink to="/admin/invites">Invites</AdminNavLink>
          </nav>
        </div>
      </header>
      <main className="page-wrap px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function AdminNavLink({
  to,
  children,
}: {
  to: '/admin/requests' | '/admin/invites'
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-[var(--h-surface)] hover:text-foreground"
      activeProps={{ className: 'bg-[var(--h-surface)] text-foreground' }}
    >
      {children}
    </Link>
  )
}
