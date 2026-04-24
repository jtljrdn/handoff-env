import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createSignupInviteFn,
  listSignupInvitesFn,
  revokeSignupInviteFn,
  type SignupInvite,
} from '#/lib/server-fns/admin'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

export const Route = createFileRoute('/_admin/admin/invites')({
  component: InvitesPage,
})

function InvitesPage() {
  const queryClient = useQueryClient()

  const { data: invites, isLoading } = useQuery({
    queryKey: ['admin', 'signup-invites'],
    queryFn: () => listSignupInvitesFn(),
  })

  const createMut = useMutation({
    mutationFn: (input: { email: string; note?: string }) =>
      createSignupInviteFn({ data: input }),
    onSuccess: () => {
      toast.success('Invite sent')
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'signup-invites'],
      })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to send invite')
    },
  })

  const revokeMut = useMutation({
    mutationFn: (inviteId: string) =>
      revokeSignupInviteFn({ data: { inviteId } }),
    onSuccess: () => {
      toast.success('Invite revoked')
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'signup-invites'],
      })
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to revoke')
    },
  })

  const form = useForm({
    defaultValues: { email: '', note: '' },
    onSubmit: async ({ value, formApi }) => {
      await createMut.mutateAsync({
        email: value.email,
        note: value.note || undefined,
      })
      formApi.reset()
    },
  })

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Invites
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a direct invite, or review what's outstanding.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite by email</CardTitle>
          <CardDescription>
            Sends an email immediately. The recipient can sign up with this
            address for the next 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <form.Field name="email">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="someone@example.com"
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="note">
              {(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor="invite-note">Note (optional)</Label>
                  <Input
                    id="invite-note"
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Met at the conf"
                  />
                </div>
              )}
            </form.Field>
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send invite'}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding & past invites</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !invites || invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--h-border)]">
              {invites.map((inv) => (
                <InviteRow
                  key={inv.id}
                  invite={inv}
                  onRevoke={() => revokeMut.mutate(inv.id)}
                  revoking={revokeMut.isPending}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InviteRow({
  invite,
  onRevoke,
  revoking,
}: {
  invite: SignupInvite
  onRevoke: () => void
  revoking: boolean
}) {
  const expired = new Date(invite.expiresAt) < new Date()
  const used = invite.usedAt !== null
  const status: 'used' | 'expired' | 'active' = used
    ? 'used'
    : expired
      ? 'expired'
      : 'active'

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="grid gap-0.5">
        <span className="font-mono text-sm">{invite.email}</span>
        <span className="text-xs text-muted-foreground">
          Invited {new Date(invite.createdAt).toLocaleDateString()}
          {invite.invitedByEmail && ` by ${invite.invitedByEmail}`}
          {' · '}
          {used
            ? `Used ${new Date(invite.usedAt!).toLocaleDateString()}`
            : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {status === 'active' && <Badge>Active</Badge>}
        {status === 'used' && <Badge variant="outline">Used</Badge>}
        {status === 'expired' && <Badge variant="secondary">Expired</Badge>}
        {status === 'active' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRevoke}
            disabled={revoking}
          >
            Revoke
          </Button>
        )}
      </div>
    </li>
  )
}
