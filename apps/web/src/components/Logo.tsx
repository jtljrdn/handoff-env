import { useId } from 'react'
import { cn } from '#/lib/utils.ts'

interface LogoMarkProps {
  size?: number
  className?: string
}

export function LogoMark({ size = 20, className }: LogoMarkProps) {
  const maskId = useId()
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('text-primary', className)}
    >
      {/* Knockout: the front card cuts a gap out of the back card, so the
          overlap stays crisp on any background (glass nav, dark mode). */}
      <mask id={maskId}>
        <rect x="-2" y="-2" width="24" height="24" fill="white" />
        <rect
          x="5.7"
          y="3.2"
          width="13.6"
          height="15.6"
          rx="4.3"
          fill="black"
        />
      </mask>
      <rect
        x="2"
        y="2.5"
        width="11"
        height="13"
        rx="3"
        fill="currentColor"
        opacity="0.45"
        mask={`url(#${maskId})`}
      />
      <rect x="7" y="4.5" width="11" height="13" rx="3" fill="currentColor" />
    </svg>
  )
}

interface LogoProps {
  size?: number
  showWordmark?: boolean
  className?: string
}

export function Logo({ size = 20, showWordmark = true, className }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="font-display text-lg font-extrabold tracking-tight text-[var(--h-text)]">
          handoff
        </span>
      )}
    </span>
  )
}
