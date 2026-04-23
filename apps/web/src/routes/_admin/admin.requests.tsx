import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  approveSignupRequestFn,
  denySignupRequestFn,
  listSignupRequestsFn,
  type SignupRequestStatus,
} from '#/lib/server-fns/admin'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/_admin/admin/requests')({
  component: RequestsPage,
})

const FILTERS: Array<{ label: string; value: SignupRequestStatus | 'all' }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
  { label: 'All', value: 'all' },
]

function RequestsPage() {
  const [filter, setFilter] = useState<SignupRequestStatus | 'all'>('pending')
  const queryClient = useQueryClient()

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin', 'signup-requests', filter],
    queryFn: () => listSignupRequestsFn({ data: { status: filter } }),
  })

  const approveMut = useMutation({
    mutationFn: (requestId: string) =>
      approveSignupRequestFn({ data: { requestId } }),
    onSuccess: () => {
      toast.success('Approved and invite sent')
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to approve')
    },
  })

  const denyMut = useMutation({
    mutationFn: (requestId: string) =>
      denySignupRequestFn({ data: { requestId } }),
    onSuccess: () => {
      toast.success('Request denied')
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'signup-requests'],
      })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to deny')
    },
  })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Signup requests
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          People asking to join. Approve to send an invite email.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={
              filter === f.value
                ? 'rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-[var(--h-surface)] hover:text-foreground'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !requests || requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No requests in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {r.name ? `${r.name} · ` : ''}
                      <span className="font-mono text-sm font-normal text-muted-foreground">
                        {r.email}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Submitted {new Date(r.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </CardHeader>
              {(r.reason || r.status === 'pending') && (
                <CardContent className="grid gap-4">
                  {r.reason && (
                    <p className="rounded-md border border-[var(--h-border)] bg-[var(--h-surface)] px-3 py-2 text-sm text-foreground">
                      {r.reason}
                    </p>
                  )}
                  {r.status === 'pending' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMut.mutate(r.id)}
                        disabled={approveMut.isPending}
                      >
                        Approve & invite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => denyMut.mutate(r.id)}
                        disabled={denyMut.isPending}
                      >
                        Deny
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: SignupRequestStatus }) {
  if (status === 'pending') return <Badge variant="secondary">Pending</Badge>
  if (status === 'approved') return <Badge>Approved</Badge>
  return <Badge variant="outline">Denied</Badge>
}
