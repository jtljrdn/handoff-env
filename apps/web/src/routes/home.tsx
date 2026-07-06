import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from './index'

// Marketing page reachable while signed in (unlike `/`, which redirects to the
// dashboard). Same content as `/`, no auth redirect.
export const Route = createFileRoute('/home')({
  component: LandingPage,
})
