import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Download, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { exportAuditCsvFn } from '#/lib/server-fns/audit'
import type { AuditAction } from '#/lib/services/audit'

interface AuditExportButtonProps {
  plan: 'free' | 'team'
  filter: {
    projectId?: string | null
    environmentId?: string | null
    actorUserId?: string | null
    actions?: AuditAction[] | null
    targetKeySearch?: string | null
    dateFrom?: string | null
    dateTo?: string | null
  }
}

export function AuditExportButton({ plan, filter }: AuditExportButtonProps) {
  const [busy, setBusy] = useState(false)
  const isTeam = plan === 'team'

  async function onExport() {
    if (!isTeam) return
    setBusy(true)
    try {
      const res = await exportAuditCsvFn({ data: filter })
      downloadCsv(res.filename, res.csv)
      toast.success(
        `Exported ${res.count} ${res.count === 1 ? 'entry' : 'entries'}`,
      )
    } catch (err) {
      const msg = await readErrorMessage(err)
      toast.error('Export failed', { description: msg })
    } finally {
      setBusy(false)
    }
  }

  if (!isTeam) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="outline" size="sm">
              <Link to="/billing">
                <Lock className="size-3.5" />
                Export CSV
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            CSV export is available on the Team plan
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={onExport} disabled={busy}>
      <Download className="size-3.5" />
      {busy ? 'Exporting…' : 'Export CSV'}
    </Button>
  )
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

async function readErrorMessage(err: unknown): Promise<string> {
  if (err instanceof Response) {
    try {
      const body = await err.json()
      return typeof body?.error === 'string' ? body.error : err.statusText
    } catch {
      return err.statusText
    }
  }
  if (err instanceof Error) return err.message
  return String(err)
}
