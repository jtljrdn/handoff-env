import { useEffect, useState } from 'react'
import { ready } from '@handoff-env/crypto'

export function useSodiumReady(): boolean {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    ready().then(() => {
      if (!cancelled) setIsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return isReady
}
