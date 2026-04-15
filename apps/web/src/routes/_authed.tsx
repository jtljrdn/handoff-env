import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getSessionFn, getOnboardingStatusFn } from '#/lib/server-fns/auth'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) {
      throw redirect({ to: '/sign-in', search: {} })
    }

    const onboardingStatus = await getOnboardingStatusFn()

    return { session, onboardingStatus }
  },
  component: () => <Outlet />,
})
