import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTrialStatusFn } from '#/lib/server-fns/trial'
import { TrialActivatedDialog } from './TrialActivatedDialog'

const STORAGE_KEY = 'trial-activated'

export function TrialActivatedDialogTrigger() {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') {
        setPending(true)
      }
    } catch {
      // ignore
    }
  }, [])

  const { data } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => getTrialStatusFn(),
    enabled: pending,
    staleTime: 5 * 60 * 1000,
  })

  const open = pending && data?.status === 'trialing'

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPending(false)
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }

  // Only render when we actually have data so the dialog mounts cleanly
  if (!open || data?.status !== 'trialing') return null

  return (
    <TrialActivatedDialog
      open={open}
      onOpenChange={handleOpenChange}
      trialEnd={data.trialEnd}
      daysLeft={data.daysLeft}
    />
  )
}
