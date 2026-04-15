import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Building2, Clock, AlertCircle } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { getInvitationDetailsFn } from '#/lib/server-fns/onboarding'
import { getSessionFn } from '#/lib/server-fns/auth'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/invite/$invitationId')({
  loader: async ({ params }) => {
    const [invitation, session] = await Promise.all([
      getInvitationDetailsFn({ data: { invitationId: params.invitationId } }),
      getSessionFn(),
    ])
    return { invitation, session }
  },
  component: InvitePage,
})

function InvitePage() {
  const router = useRouter()
  const { invitationId } = Route.useParams()
  const { invitation, session } = Route.useLoaderData()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  if (!invitation) {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
        <Card className="rise-in w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Invitation not found</CardTitle>
            <CardDescription>
              This invitation may have expired or been revoked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.navigate({ to: '/' })}
              className="w-full"
            >
              Go to home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  const isExpired = new Date(invitation.expiresAt) < new Date()
  const isAlreadyAccepted = invitation.status !== 'pending'

  if (isExpired || isAlreadyAccepted) {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
        <Card className="rise-in w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Clock className="size-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">
              {isExpired ? 'Invitation expired' : 'Invitation already used'}
            </CardTitle>
            <CardDescription>
              {isExpired
                ? 'This invitation has expired. Ask the organization admin to send a new one.'
                : `This invitation has already been ${invitation.status}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => router.navigate({ to: '/' })}
              className="w-full"
            >
              Go to home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  async function handleAccept() {
    setError('')
    setAccepting(true)
    const { error: acceptError } = await authClient.organization.acceptInvitation({
      invitationId,
    })
    if (acceptError) {
      setError(acceptError.message ?? 'Failed to accept invitation')
      setAccepting(false)
      return
    }
    router.navigate({ to: '/dashboard' })
  }

  function handleSignIn() {
    router.navigate({
      to: '/sign-in',
      search: { redirect: `/invite/${invitationId}` },
    })
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-20">
      <Card className="rise-in w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
            <Building2 className="size-6 text-[var(--h-accent)]" />
          </div>
          <CardTitle className="text-xl">You're invited</CardTitle>
          <CardDescription>
            You've been invited to join <span className="font-medium text-foreground">{invitation.orgName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{invitation.orgName}</p>
              <p className="text-xs text-muted-foreground">
                Invited as{' '}
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {invitation.role}
                </Badge>
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {session ? (
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full"
            >
              {accepting ? 'Joining...' : 'Accept invitation'}
            </Button>
          ) : (
            <Button onClick={handleSignIn} className="w-full">
              Sign in to join
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
