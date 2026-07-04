import { useEffect, useState } from 'react'
import { Shader, FlowingGradient, FlutedGlass, Vignette } from 'shaders/react'
import { cn } from '#/lib/utils.ts'

// Deep-violet fallback shown during SSR/first paint and if WebGL is unavailable.
const FALLBACK =
  'bg-[radial-gradient(120%_120%_at_30%_30%,oklch(0.4_0.18_290),oklch(0.17_0.08_275)_58%,oklch(0.1_0.04_270))]'

export function FlutedShader({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className={cn(FALLBACK, className)} />

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <Shader className={cn(FALLBACK, className)}>
      <Vignette>
        {/* ponytail: speed=0 keeps the flutes static like real ribbed glass; only the
            gradient flows behind. shape/frequency/refraction are tunable. */}
        <FlutedGlass
          shape="rounded"
          angle={0}
          frequency={20}
          refraction={1.1}
          highlight={0.4}
          highlightColor="#e0e7ff"
          speed={0}
        >
          <FlowingGradient
            colorA="#0a0f2c"
            colorB="#312e9e"
            colorC="#4f46e5"
            colorD="#6b8afd"
            distortion={0.6}
            speed={reduced ? 0 : 1}
          />
        </FlutedGlass>
      </Vignette>
    </Shader>
  )
}
