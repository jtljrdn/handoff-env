import { useState } from 'react'
import { Shader, FlowingGradient, FilmGrain } from 'shaders/react'
import { useMountEffect } from '#/hooks/useMountEffect'

/**
 * Deliberately off-brand vibrant shader pane used for the paid tier's card,
 * so it reads as its own object on an otherwise blue page. Fuchsia-leaning so
 * the accent never reads as a destructive red.
 */
export function SunsetPane({ children }: { children: React.ReactNode }) {
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
    <div className="relative overflow-hidden bg-[oklch(0.42_0.19_350)]">
      <div
        className="absolute inset-0 transition-opacity duration-1000 ease-out"
        style={{ opacity: ready ? 1 : 0 }}
        aria-hidden="true"
      >
        <Shader className="h-full w-full">
          <FlowingGradient
            colorA="#db2777"
            colorB="#f97316"
            colorC="#c026d3"
            colorD="#fb7185"
            speed={reducedMotion ? 0 : 0.45}
            colorSpace="oklch"
          />
          <FilmGrain strength={0.14} />
        </Shader>
        {/* Deepen the pane behind the copy so white text stays readable */}
        <div className="absolute inset-0 bg-[linear-gradient(160deg,oklch(0.22_0.10_350/0.55)_0%,oklch(0.22_0.10_350/0.15)_55%,transparent_100%)]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  )
}
