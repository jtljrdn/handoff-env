import { useState } from 'react'
import { Check, Mail, Plus } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { getSeatChangePreviewFn } from '#/lib/server-fns/billing'
import { SeatChangeConfirmDialog } from '#/components/billing/SeatChangeConfirmDialog'
import { parseActionError } from '#/lib/billing/parse-limit-error'
import type { OrgRole } from '@handoff-env/types'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'

const MAX_INVITES = 5

interface InviteModalProps {
  orgId: string
  currentUserRole: OrgRole
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited?: () => void
}

export function InviteModal({
  orgId,
  currentUserRole,
  open,
  onOpenChange,
  onInvited,
}: InviteModalProps) {
  const [invites, setInvites] = useState([
    { email: '', role: 'member' as OrgRole },
  ])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentEmails, setSentEmails] = useState<string[]>([])
  const [confirmDelta, setConfirmDelta] = useState<number | null>(null)

  function reset() {
    setInvites([{ email: '', role: 'member' }])
    setSending(false)
    setError('')
    setSentEmails([])
    setConfirmDelta(null)
  }

  function addRow() {
    if (invites.length < MAX_INVITES) {
      setInvites([...invites, { email: '', role: 'member' }])
    }
  }

  function removeRow(index: number) {
    setInvites(invites.filter((_, i) => i !== index))
  }

  function updateInvite(
    index: number,
    field: 'email' | 'role',
    value: string,
  ) {
    setInvites(
      invites.map((inv, i) =>
        i === index
          ? {
              ...inv,
              [field]: field === 'role' ? (value as OrgRole) : value,
            }
          : inv,
      ),
    )
  }

  async function handleSubmit() {
    const validInvites = invites.filter((inv) => inv.email.trim())
    if (validInvites.length === 0) return

    setError('')

    try {
      const preview = await getSeatChangePreviewFn({
        data: { seatDelta: validInvites.length },
      })
      const needsConfirm =
        preview.plan === 'team' &&
        (preview.crossesThreshold || preview.deltaCents > 0)
      if (needsConfirm) {
        setConfirmDelta(validInvites.length)
        return
      }
    } catch (err) {
      console.error('Seat preview failed:', err)
    }

    await sendInvites()
  }

  async function sendInvites() {
    const validInvites = invites.filter((inv) => inv.email.trim())
    setConfirmDelta(null)
    setSending(true)
    const sent: string[] = []

    for (const invite of validInvites) {
      const { error } = await authClient.organization.inviteMember({
        email: invite.email.trim(),
        role: invite.role,
        organizationId: orgId,
      })
      if (error) {
        const parsed = parseActionError(
          error,
          `Failed to invite ${invite.email}`,
        )
        setError(
          parsed.isLimitError
            ? parsed.message
            : `Failed to invite ${invite.email}: ${parsed.message}`,
        )
        setSending(false)
        return
      }
      sent.push(invite.email)
    }

    setSending(false)
    setSentEmails(sent)
    onInvited?.()
  }

  const hasSent = sentEmails.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        {hasSent ? (
          <div className="grid gap-4 text-center py-2">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
              <Check className="size-6 text-[var(--h-accent)]" />
            </div>
            <DialogHeader className="items-center">
              <DialogTitle>Invitations sent</DialogTitle>
              <DialogDescription>
                {sentEmails.length === 1
                  ? `Invitation sent to ${sentEmails[0]}`
                  : `${sentEmails.length} invitations sent`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1">
              {sentEmails.length > 1 &&
                sentEmails.map((email) => (
                  <p key={email} className="text-sm text-muted-foreground">
                    {email}
                  </p>
                ))}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                reset()
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite team members</DialogTitle>
              <DialogDescription>
                Add up to {MAX_INVITES} team members. They'll receive an email
                invitation.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              {invites.map((invite, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={invite.email}
                      onChange={(e) =>
                        updateInvite(i, 'email', e.target.value)
                      }
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={invite.role}
                    onValueChange={(value) =>
                      updateInvite(i, 'role', value as OrgRole)
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {invites.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeRow(i)}
                    >
                      <span className="sr-only">Remove</span>
                      &times;
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {invites.length < MAX_INVITES && (
              <Button
                variant="outline"
                size="sm"
                onClick={addRow}
                className="w-fit"
              >
                <Plus className="size-3.5" />
                Add another
              </Button>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  reset()
                  onOpenChange(false)
                }}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  sending || invites.every((inv) => !inv.email.trim())
                }
              >
                {sending ? 'Sending...' : 'Send invites'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
      <SeatChangeConfirmDialog
        open={confirmDelta !== null}
        seatDelta={confirmDelta ?? 0}
        currentUserRole={currentUserRole}
        onCancel={() => setConfirmDelta(null)}
        onConfirm={sendInvites}
      />
    </Dialog>
  )
}
