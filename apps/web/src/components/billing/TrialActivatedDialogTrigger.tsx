import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TRIAL_ACTIVATED_STORAGE_KEY,
  trialStatusQueryOptions,
} from '#/lib/server-fns/trial'
import { TrialActivatedDialog } from './TrialActivatedDialog'

export function TrialActivatedDialogTrigger() {
  const [pending, setPending] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(TRIAL_ACTIVATED_STORAGE_KEY) === '1') {
        setPending(true)
      }
    } catch {}
  }, [])

  const { data } = useQuery({
    ...trialStatusQueryOptions(),
    enabled: pending,
  })

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPending(false)
      try {
        sessionStorage.removeItem(TRIAL_ACTIVATED_STORAGE_KEY)
      } catch {}
    }
  }

  if (!pending || data?.status !== 'trialing') return null

  return (
    <TrialActivatedDialog
      open
      onOpenChange={handleOpenChange}
      trialEnd={data.trialEnd}
      daysLeft={data.daysLeft}
    />
  )
}
