import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/billing')({
  component: BillingLayout,
})

function BillingLayout() {
  return <Outlet />
}
