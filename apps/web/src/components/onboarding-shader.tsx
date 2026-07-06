import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Shader, Aurora, FilmGrain } from 'shaders/react'
import { cn } from '#/lib/utils.ts'

// Theme-aware sky behind the aurora: soft periwinkle daylight in light mode,
// deep night blue in dark. Also the SSR/no-WebGL fallback.
const BASE =
  'bg-[radial-gradient(140%_120%_at_50%_-10%,oklch(0.45_0.21_264),oklch(0.72_0.12_264)_34%,oklch(0.955_0.015_264)_60%,oklch(0.94_0.018_264))] dark:bg-[radial-gradient(140%_120%_at_50%_-10%,oklch(0.32_0.12_265),oklch(0.19_0.06_266)_52%,oklch(0.13_0.025_266))]'

export function OnboardingShader({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => setMounted(true), [])

  return (
    <div className={cn('overflow-hidden', BASE, className)} aria-hidden>
      {mounted && (
        <Shader className="h-full w-full">
          {/* Slow aurora curtains in the brand blues, hanging from the top edge:
              calm ambience, a different shader family from the flowing gradients
              on marketing and the fluted glass on auth. The canvas only paints
              the curtains; the sky is the BASE gradient behind it. */}
          <Aurora
            colorA="#2242c8"
            colorB="#4f7cff"
            colorC="#8fd7ff"
            curtainCount={5}
            intensity={90}
            waviness={60}
            rayDensity={20}
            height={135}
            center={{ x: 0.5, y: 0 }}
            speed={reduced ? 0 : 0.7}
            colorSpace="oklch"
          />
          <FilmGrain strength={0.1} />
        </Shader>
      )}
      {/* Spotlight the center so the wizard sits on calm ground while the aurora
          glows at the edges. Uses --h-bg so it matches both themes. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_48%,color-mix(in_oklch,var(--h-bg)_85%,transparent)_0%,color-mix(in_oklch,var(--h-bg)_62%,transparent)_40%,color-mix(in_oklch,var(--h-bg)_10%,transparent)_72%,transparent_92%)]" />
      {/* Ground the bottom edge into the page background so the footer sits on
          calm, readable ground (same dissolve convention as GradientField). */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,color-mix(in_oklch,var(--h-bg)_75%,transparent)_100%)]" />
    </div>
  )
}
