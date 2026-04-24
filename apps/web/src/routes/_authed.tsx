import { useState, useEffect, useRef } from 'react'
import {
  createFileRoute,
  redirect,
  Outlet,
  useMatches,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import { getAuthContextFn } from '#/lib/server-fns/auth'
import { getDashboardDataFn } from '#/lib/server-fns/dashboard'
import { getVaultStatusFn } from '#/lib/server-fns/vault'
import { useMountEffect } from '#/hooks/useMountEffect'
import { useVault, lockVault } from '#/lib/vault/store'
import { processPendingWraps } from '#/lib/vault/org'
import Sidebar from '#/components/Sidebar'
import AuthedHeader from '#/components/AuthedHeader'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const authContext = await context.queryClient.ensureQueryData({
      queryKey: ['auth-context'],
      queryFn: () => getAuthContextFn(),
      staleTime: 60_000,
    })

    if (!authContext.session) {
      throw redirect({ to: '/sign-in', search: {} })
    }

    const vaultStatus = await context.queryClient.ensureQueryData({
      queryKey: ['vault-status'],
      queryFn: () => getVaultStatusFn(),
      staleTime: 30_000,
    })

    const onVaultRoute = location.pathname.startsWith('/vault/')
    if (!vaultStatus.initialized && !onVaultRoute) {
      throw redirect({ to: '/vault/setup' })
    }

    return {
      session: authContext.session,
      onboardingStatus: authContext.onboardingStatus,
      vaultInitialized: vaultStatus.initialized,
    }
  },
  loader: async ({ context }) => {
    if (context.onboardingStatus.hasOrganization) {
      await context.queryClient.ensureQueryData({
        queryKey: ['sidebar-data'],
        queryFn: () => getDashboardDataFn(),
        staleTime: 30_000,
      })
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobileOpenRef = useRef(false)
  mobileOpenRef.current = mobileOpen

  const matches = useMatches()
  const isOnboarding = matches.some(
    (m) => m.routeId === '/_authed/onboarding',
  )
  const isVaultRoute = matches.some((m) =>
    m.routeId.startsWith('/_authed/vault/'),
  )

  const { vaultInitialized, session } = Route.useRouteContext()
  const unlocked = useVault()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (unlocked && unlocked.userId !== session.user.id) {
      lockVault()
    }
  }, [unlocked, session.user.id])

  useEffect(() => {
    if (vaultInitialized && !unlocked && !isVaultRoute) {
      navigate({
        to: '/vault/unlock',
        search: { redirect: pathname },
      })
    }
  }, [vaultInitialized, unlocked, isVaultRoute, navigate, pathname])

  useEffect(() => {
    if (!unlocked || isVaultRoute) return
    let cancelled = false
    const run = () => {
      processPendingWraps().catch(() => {
        // background task: failures are logged inside processPendingWraps
      })
    }
    const t = setTimeout(() => {
      if (!cancelled) run()
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [unlocked, isVaultRoute, pathname])

  useMountEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  })

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        toggleCollapsed()
      }
      if (e.key === 'Escape' && mobileOpenRef.current) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = () => {
      if (mq.matches) setMobileOpen(false)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (isOnboarding || isVaultRoute) {
    return <Outlet />
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-foreground/15 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:duration-0 md:hidden',
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={cn(
          'shrink-0',
          'fixed inset-y-0 left-0 z-40',
          'md:relative md:z-auto',
          'transition-[transform,width] duration-300 motion-reduce:duration-0',
          !mobileOpen && '-translate-x-full',
          'md:translate-x-0',
          collapsed ? 'w-60 md:w-14' : 'w-60',
        )}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Sidebar
          collapsed={collapsed && !mobileOpen}
          onToggle={toggleCollapsed}
        />
      </div>

      {/* Content area */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <AuthedHeader onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
