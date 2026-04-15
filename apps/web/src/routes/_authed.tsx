import { useState, useEffect, useRef } from 'react'
import {
  createFileRoute,
  redirect,
  Outlet,
  useMatches,
} from '@tanstack/react-router'
import { cn } from '#/lib/utils'
import { getSessionFn, getOnboardingStatusFn } from '#/lib/server-fns/auth'
import { getDashboardDataFn } from '#/lib/server-fns/dashboard'
import { useMountEffect } from '#/hooks/useMountEffect'
import Sidebar from '#/components/Sidebar'
import AuthedHeader from '#/components/AuthedHeader'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) {
      throw redirect({ to: '/sign-in', search: {} })
    }

    const onboardingStatus = await getOnboardingStatusFn()

    return { session, onboardingStatus }
  },
  loader: async ({ context }) => {
    if (context.onboardingStatus.hasOrganization) {
      await context.queryClient.ensureQueryData({
        queryKey: ['sidebar-data'],
        queryFn: () => getDashboardDataFn(),
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

  if (isOnboarding) {
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
