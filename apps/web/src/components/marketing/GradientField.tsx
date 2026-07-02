import { useState } from 'react'
import { Shader, FlowingGradient, FilmGrain } from 'shaders/react'
import { useMountEffect } from '#/hooks/useMountEffect'

/**
 * The marketing surfaces' committed shader moment: a vibrant flowing color
 * field that dissolves into the page background. `flip` anchors the vibrancy
 * to the bottom edge instead of the top (used to bookend a page).
 */
export function GradientField({ flip = false }: { flip?: boolean }) {
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
      className="absolute inset-0 overflow-hidden transition-opacity duration-[1400ms] ease-out"
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden="true"
    >
      <div className={`h-full w-full ${flip ? 'rotate-180' : ''}`}>
        <Shader className="h-full w-full opacity-80 dark:opacity-70">
          <FlowingGradient
            colorA="#2563eb"
            colorB="#0ea5e9"
            colorC="#8b5cf6"
            colorD="#22d3ee"
            speed={reducedMotion ? 0 : 0.35}
            colorSpace="oklch"
          />
          <FilmGrain strength={0.1} />
        </Shader>
      </div>
      {/* Dissolve into the page background so text sits on calm ground */}
      <div
        className={`absolute inset-0 ${
          flip
            ? 'bg-[linear-gradient(0deg,color-mix(in_oklch,var(--h-bg)_8%,transparent)_0%,color-mix(in_oklch,var(--h-bg)_82%,transparent)_55%,var(--h-bg)_100%)]'
            : 'bg-[linear-gradient(180deg,color-mix(in_oklch,var(--h-bg)_8%,transparent)_0%,color-mix(in_oklch,var(--h-bg)_82%,transparent)_55%,var(--h-bg)_100%)]'
        }`}
      />
    </div>
  )
}
