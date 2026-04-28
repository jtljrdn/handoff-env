import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Shader, FlowingGradient, FilmGrain } from 'shaders/react'
import { useMountEffect } from '#/hooks/useMountEffect'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'

interface TrialActivatedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trialEnd?: string | null
  daysLeft?: number | null
}

export function TrialActivatedDialog({
  open,
  onOpenChange,
  trialEnd,
  daysLeft,
}: TrialActivatedDialogProps) {
  const days = daysLeft ?? 14
  const formattedEnd = trialEnd
    ? new Date(trialEnd).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <ShaderBackdrop />
        <div className="relative grid gap-5 px-6 py-7 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--h-accent-subtle)] shadow-[0_0_0_4px_var(--h-bg)]">
            <Sparkles className="pulse-accent size-7 text-[var(--h-accent)]" />
          </div>
          <DialogHeader className="items-center">
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">
              Trial activated
            </DialogTitle>
            <DialogDescription>
              You're on Team for the next {days} day{days === 1 ? '' : 's'}.
              {formattedEnd && (
                <>
                  {' '}
                  Trial ends <span className="font-medium">{formattedEnd}</span>.
                </>
              )}{' '}
              No credit card required.
            </DialogDescription>
          </DialogHeader>
          <ul className="mx-auto grid max-w-[18rem] gap-1.5 text-left text-sm text-[var(--h-text-2)]">
            <li>· Unlimited projects and environments</li>
            <li>· CLI + API access for CI/CD</li>
            <li>· 180-day audit history</li>
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => onOpenChange(false)}>
              Explore Team features
              <ArrowRight className="size-3.5" />
            </Button>
            <Button variant="outline" asChild>
              <Link to="/billing" onClick={() => onOpenChange(false)}>
                Add billing
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShaderBackdrop() {
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useMountEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    requestAnimationFrame(() => setReady(true))
    return () => mq.removeEventListener('change', handler)
  })

  return (
    <div
      className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out"
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden="true"
    >
      <Shader className="h-full w-full opacity-40 dark:opacity-60">
        <FlowingGradient
          colorA="#0a0806"
          colorB="#c88f32"
          colorC="#a06040"
          colorD="#2d8a57"
          speed={reducedMotion ? 0 : 0.4}
          colorSpace="oklch"
        />
        <FilmGrain strength={0.1} />
      </Shader>
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background/95" />
    </div>
  )
}
