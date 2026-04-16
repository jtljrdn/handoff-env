import { useEffect, useState } from 'react'
import { AlertTriangle, Users, Loader2, TrendingUp } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { getSeatChangePreviewFn } from '#/lib/server-fns/billing'

type Preview = Awaited<ReturnType<typeof getSeatChangePreviewFn>>

function dollars(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`
}

export function SeatChangeConfirmDialog({
  open,
  seatDelta,
  currentUserRole,
  onCancel,
  onConfirm,
}: {
  open: boolean
  seatDelta: number
  currentUserRole: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setPreview(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    getSeatChangePreviewFn({ data: { seatDelta } })
      .then((p) => {
        if (!cancelled) setPreview(p)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, seatDelta])

  const isOwner = currentUserRole === 'owner'

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent className="sm:max-w-md">
        {loading || !preview ? (
          <div className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-[var(--h-text-3)]">
            <Loader2 className="size-4 animate-spin" />
            Calculating cost…
          </div>
        ) : error ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Couldn't load seat preview</AlertDialogTitle>
              <AlertDialogDescription>{error}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={onCancel}>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : isOwner ? (
          <OwnerConfirm
            preview={preview}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        ) : (
          <AskOwner preview={preview} onCancel={onCancel} />
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function OwnerConfirm({
  preview,
  onCancel,
  onConfirm,
}: {
  preview: Preview
  onCancel: () => void
  onConfirm: () => void
}) {
  const extraAfter = Math.max(0, preview.nextSeats - preview.includedSeats)
  const intervalLabel = preview.interval === 'year' ? 'per year' : 'per month'

  return (
    <>
      <AlertDialogHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <TrendingUp className="size-5 text-[var(--h-accent)]" />
        </div>
        <AlertDialogTitle>
          Add {preview.nextSeats - preview.currentSeats} seat
          {preview.nextSeats - preview.currentSeats === 1 ? '' : 's'}?
        </AlertDialogTitle>
        <AlertDialogDescription>
          This invite exceeds your {preview.includedSeats} included seats and
          will increase your subscription cost.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="rounded-lg border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-4 text-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="flex items-center gap-2 text-[var(--h-text-2)]">
            <Users className="size-3.5" />
            <span>Seats</span>
          </div>
          <div className="font-mono tabular-nums text-[var(--h-text)]">
            <span className="text-[var(--h-text-3)]">
              {preview.currentSeats}
            </span>
            <span className="mx-1.5 text-[var(--h-text-3)]">→</span>
            <span className="font-semibold">{preview.nextSeats}</span>
          </div>
        </div>

        <div className="space-y-1 border-t border-dashed border-[var(--h-border)] pt-3">
          <Row
            label={`Current ${intervalLabel}`}
            value={dollars(preview.currentCostCents)}
            muted
          />
          <Row
            label={`New ${intervalLabel}`}
            value={dollars(preview.nextCostCents)}
          />
          <Row
            label={`Added charge ${intervalLabel}`}
            value={`+ ${dollars(preview.deltaCents)}`}
            highlight
          />
        </div>

        {preview.prorationCents !== null &&
          preview.prorationCents !== undefined &&
          preview.prorationCents !== 0 && (
            <div className="mt-3 border-t border-dashed border-[var(--h-border)] pt-3 text-xs text-[var(--h-text-2)]">
              <span className="font-medium">Added to next invoice:</span>{' '}
              <span className="font-mono tabular-nums text-[var(--h-text)]">
                {dollars(preview.prorationCents)}
              </span>{' '}
              (prorated for the remainder of the current period)
            </div>
          )}
      </div>

      <p className="text-xs text-[var(--h-text-3)]">
        Your subscription now has {preview.nextSeats} seats (
        {Math.min(preview.nextSeats, preview.includedSeats)} included +{' '}
        {extraAfter} extra).
      </p>

      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>
          Confirm and send invite
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

function AskOwner({
  preview,
  onCancel,
}: {
  preview: Preview
  onCancel: () => void
}) {
  return (
    <>
      <AlertDialogHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-[var(--h-accent-subtle)]">
          <AlertTriangle className="size-5 text-[var(--h-accent)]" />
        </div>
        <AlertDialogTitle>Owner approval needed</AlertDialogTitle>
        <AlertDialogDescription>
          Your team already uses all {preview.includedSeats} included seats.
          Adding another seat would increase the subscription cost, and only the
          organization owner can authorize billing changes.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="rounded-lg border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-4 text-sm text-[var(--h-text-2)]">
        <p>
          Ask the owner to invite this member from their billing page, or to
          reach out for seat expansion.
        </p>
      </div>

      <AlertDialogFooter>
        <AlertDialogAction onClick={onCancel}>Got it</AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

function Row({
  label,
  value,
  muted,
  highlight,
}: {
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${
        highlight ? 'pt-1 font-medium' : ''
      }`}
    >
      <span
        className={
          muted ? 'text-[var(--h-text-3)]' : 'text-[var(--h-text-2)]'
        }
      >
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${
          highlight ? 'text-[var(--h-accent)]' : muted ? 'text-[var(--h-text-3)]' : 'text-[var(--h-text)]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
