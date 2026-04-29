import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { actorLabel } from '#/components/dashboard/types'
import { actionLabel } from './action-labels'
import type { AuditPageRow } from '#/lib/services/audit'

interface AuditDetailSheetProps {
  row: AuditPageRow | null
  onOpenChange: (open: boolean) => void
}

export function AuditDetailSheet({ row, onOpenChange }: AuditDetailSheetProps) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">
                {row.action}
              </DialogTitle>
              <DialogDescription>
                {actorLabel({ name: row.actorName, email: row.actorEmail })}{' '}
                {actionLabel(row.action)}
                {row.targetKey ? ` ${row.targetKey}` : ''}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
              <DetailRow label="When" value={new Date(row.createdAt).toLocaleString()} />
              <DetailRow
                label="Actor"
                value={row.actorEmail ?? row.actorName ?? row.actorUserId}
              />
              <DetailRow label="Project" value={row.projectName ?? '-'} />
              <DetailRow label="Environment" value={row.environmentName ?? '-'} />
              <DetailRow label="Target" value={row.targetKey ?? '-'} mono />
            </dl>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Metadata
              </p>
              <pre className="max-h-64 overflow-auto rounded-md border bg-[var(--h-surface)] p-3 font-mono text-xs">
                {row.metadata
                  ? JSON.stringify(row.metadata, null, 2)
                  : '{}'}
              </pre>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? 'font-mono text-xs' : ''}>{value}</dd>
    </>
  )
}
