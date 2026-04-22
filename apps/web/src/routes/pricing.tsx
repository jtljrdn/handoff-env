import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, Minus, ArrowRight } from 'lucide-react'
import {
  Shader,
  Grid,
  SimplexNoise,
  ContourLines,
  FilmGrain,
} from 'shaders/react'
import { useMountEffect } from '#/hooks/useMountEffect'
import { TEAM_INCLUDED_SEATS } from '#/lib/billing/plans'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

type Cadence = 'monthly' | 'annual'

const COMING_SOON_FEATURES = new Set([
  'Secret versioning & rollback',
  'Webhooks on secret changes',
  '180-day audit history',
  'Environment cloning',
])

function ComingSoonBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full border border-[var(--h-border)] bg-[var(--h-surface)] px-1.5 py-0.5 align-middle font-mono text-[9px] uppercase tracking-wider text-[var(--h-text-3)]">
      Coming soon
    </span>
  )
}

function PricingPage() {
  const [cadence, setCadence] = useState<Cadence>('monthly')

  return (
    <main className="relative">
      <PricingBackgroundShader />
      <HeroSection cadence={cadence} onChange={setCadence} />
      <ComparisonSection />
      <CalculatorSection cadence={cadence} />
      <FaqSection />
      <FinalCtaSection />
    </main>
  )
}

// ---------------------------------------------------------------------------
// Background shader: grid-forward aesthetic, different vibe from landing
// ---------------------------------------------------------------------------

function PricingBackgroundShader() {
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useMountEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)

    const updateTheme = () =>
      setIsDark(document.documentElement.classList.contains('dark'))
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    requestAnimationFrame(() => setReady(true))
    return () => {
      mq.removeEventListener('change', handler)
      observer.disconnect()
    }
  })

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(1600px,100%)] overflow-hidden transition-opacity duration-1000 ease-out"
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden="true"
    >
      <Shader className="h-full w-full opacity-90 dark:opacity-80">
        <SimplexNoise
          colorA={isDark ? '#0c0a08' : '#faf7f0'}
          colorB={isDark ? '#2a1f14' : '#d9c8a8'}
          scale={1.4}
          contrast={0.25}
          speed={reducedMotion ? 0 : 0.18}
        />
        <ContourLines
          levels={8}
          lineWidth={1.2}
          softness={0.35}
          gamma={0.65}
          colorMode="custom"
          lineColor={isDark ? 'oklch(0.72 0.14 65)' : 'oklch(0.55 0.12 65)'}
          backgroundColor="transparent"
        />
        <Grid
          color={isDark ? 'oklch(0.60 0.025 70)' : 'oklch(0.50 0.025 70)'}
          cells={28}
          thickness={0.35}
          opacity={isDark ? 0.3 : 0.12}
        />
        <FilmGrain strength={isDark ? 0.09 : 0.07} />
      </Shader>

      {/* Radial vignette focusing attention toward the hero pricing cards */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, transparent 0%, var(--h-bg) 85%)',
        }}
      />

      {/* Hard fade to background at the bottom so the shader doesn't bleed into the comparison table */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64"
        style={{
          background:
            'linear-gradient(to bottom, transparent, var(--h-bg) 85%)',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero + two tiers + cadence toggle
// ---------------------------------------------------------------------------

function HeroSection({
  cadence,
  onChange,
}: {
  cadence: Cadence
  onChange: (c: Cadence) => void
}) {
  const isAnnual = cadence === 'annual'

  return (
    <section className="relative px-4 pb-16 pt-16 lg:pb-20 lg:pt-24">
      <div className="page-wrap">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-accent)]">
            Pricing
          </p>
          <h1
            className="rise-in mt-3 font-display font-extrabold leading-[0.95] tracking-tight text-[var(--h-text)]"
            style={{
              fontSize: 'clamp(2.25rem, 5vw + 0.5rem, 3.75rem)',
              animationDelay: '60ms',
            }}
          >
            Priced for sharing{' '}
            <code className="rounded-md bg-[var(--h-accent-subtle)] px-2 py-0.5 text-[0.75em]">
              .env
            </code>
            . Not for squeezing teams.
          </h1>
          <p
            className="rise-in mt-5 text-base leading-relaxed text-[var(--h-text-2)]"
            style={{ animationDelay: '120ms' }}
          >
            Two plans. The free one is actually free. The paid one grows with
            your team.
          </p>
        </div>

        <div
          className="rise-in mt-10 flex justify-center"
          style={{ animationDelay: '180ms' }}
        >
          <CadenceToggle cadence={cadence} onChange={onChange} />
        </div>

        <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-2 lg:gap-6">
          <FreeCard />
          <TeamCard isAnnual={isAnnual} />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--h-text-3)]">
          Prices in USD. Cancel any time. No credit card required for Free.
        </p>
      </div>
    </section>
  )
}

function CadenceToggle({
  cadence,
  onChange,
}: {
  cadence: Cadence
  onChange: (c: Cadence) => void
}) {
  const monthlyRef = useRef<HTMLButtonElement>(null)
  const annualRef = useRef<HTMLButtonElement>(null)
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(
    null,
  )

  useLayoutEffect(() => {
    const activeEl =
      cadence === 'monthly' ? monthlyRef.current : annualRef.current
    if (!activeEl) return
    const parent = activeEl.parentElement
    if (!parent) return
    const parentBox = parent.getBoundingClientRect()
    const childBox = activeEl.getBoundingClientRect()
    setThumb({
      left: childBox.left - parentBox.left,
      width: childBox.width,
    })
  }, [cadence])

  useEffect(() => {
    const handler = () => {
      const activeEl =
        cadence === 'monthly' ? monthlyRef.current : annualRef.current
      if (!activeEl) return
      const parent = activeEl.parentElement
      if (!parent) return
      const parentBox = parent.getBoundingClientRect()
      const childBox = activeEl.getBoundingClientRect()
      setThumb({
        left: childBox.left - parentBox.left,
        width: childBox.width,
      })
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [cadence])

  return (
    <div
      role="tablist"
      aria-label="Billing cadence"
      className="relative inline-flex rounded-full border border-[var(--h-border)] bg-[var(--h-surface)] p-1"
    >
      {thumb && (
        <span
          aria-hidden
          className="absolute rounded-full bg-[var(--h-bg)] shadow-sm"
          style={{
            top: 4,
            bottom: 4,
            left: 0,
            width: thumb.width,
            transform: `translateX(${thumb.left}px)`,
            transition:
              'transform 360ms cubic-bezier(0.16,1,0.3,1), width 360ms cubic-bezier(0.16,1,0.3,1)',
            willChange: 'transform, width',
          }}
        />
      )}
      <CadenceTab
        ref={monthlyRef}
        active={cadence === 'monthly'}
        onClick={() => onChange('monthly')}
      >
        Monthly
      </CadenceTab>
      <CadenceTab
        ref={annualRef}
        active={cadence === 'annual'}
        onClick={() => onChange('annual')}
      >
        Annual
        <Badge
          variant="secondary"
          className={`ml-2 ${cadence === 'annual' ? 'pulse-accent rounded-full' : ''}`}
          key={cadence === 'annual' ? 'annual-active' : 'annual-inactive'}
        >
          Save 17%
        </Badge>
      </CadenceTab>
    </div>
  )
}

const CadenceTab = ({
  ref,
  active,
  onClick,
  children,
}: {
  ref: React.Ref<HTMLButtonElement>
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) => {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative z-10 rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-300 ${
        active
          ? 'text-[var(--h-text)]'
          : 'text-[var(--h-text-2)] hover:text-[var(--h-text)]'
      }`}
    >
      {children}
    </button>
  )
}

function FreeCard() {
  const bullets = [
    '1 project',
    '2 environments per project',
    'Unlimited variables',
    '5 team members',
    'Dashboard access',
    '14-day audit history',
  ]
  return (
    <div className="relative flex flex-col rounded-2xl border border-[var(--h-border)] bg-[var(--h-bg)]/60 p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-accent)]">
        Free
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[clamp(2.75rem,4vw,3.5rem)] font-bold tracking-tight text-[var(--h-text)]">
          $0
        </span>
        <span className="text-sm text-[var(--h-text-3)]">forever</span>
      </div>
      <p className="mt-3 text-sm text-[var(--h-text-2)]">
        For small teams and side projects.
      </p>
      <ul className="mt-7 space-y-3 text-sm text-[var(--h-text-2)]">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--h-accent)]" />
            <span>
              {b}
              {COMING_SOON_FEATURES.has(b) && <ComingSoonBadge />}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Button size="lg" variant="outline" className="w-full" asChild>
          <a href="/sign-in">Start free</a>
        </Button>
      </div>
    </div>
  )
}

function TeamCard({ isAnnual }: { isAnnual: boolean }) {
  const price = isAnnual ? 200 : 20
  const period = isAnnual ? 'per year' : 'per month'
  const perSeatMo = isAnnual ? 3.5 : 4
  const sub = isAnnual
    ? `$16.67/mo equivalent · ${perSeatMo.toFixed(2)}/user/mo beyond 10`
    : `$${perSeatMo}/user/mo beyond 10`
  const bullets = [
    'Unlimited projects and environments',
    'Unlimited variables',
    '10 seats included, then per-seat pricing',
    'CLI + API access for CI/CD',
    'Secret versioning & rollback',
    'Webhooks on secret changes',
    '180-day audit history',
    'Environment cloning',
  ]
  return (
    <div className="relative flex flex-col rounded-2xl border border-[var(--h-accent)] bg-[var(--h-bg)] p-8 shadow-[0_0_0_1px_var(--h-accent)_inset,0_30px_60px_-40px_oklch(0.35_0.05_70_/_0.3)]">
      {isAnnual && (
        <span
          key="best-value"
          className="pulse-accent absolute right-6 top-6 rounded-full bg-[var(--h-accent)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white"
        >
          Best value
        </span>
      )}
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-accent)]">
        Team
      </p>
      <div className="mt-3 flex items-baseline gap-2 overflow-hidden">
        <span
          key={`price-${isAnnual}`}
          className="flip-in inline-block font-display text-[clamp(2.75rem,4vw,3.5rem)] font-bold tabular-nums tracking-tight text-[var(--h-text)]"
        >
          ${price}
        </span>
        <span
          key={`period-${isAnnual}`}
          className="flip-in inline-block text-sm text-[var(--h-text-3)]"
          style={{ animationDelay: '30ms' }}
        >
          {period}
        </span>
      </div>
      <p
        key={`sub-${isAnnual}`}
        className="flip-in mt-0.5 text-xs text-[var(--h-text-3)]"
        style={{ animationDelay: '60ms' }}
      >
        {sub}
      </p>
      <p className="mt-3 text-sm text-[var(--h-text-2)]">
        For teams shipping production together.
      </p>
      <ul className="mt-7 space-y-3 text-sm text-[var(--h-text-2)]">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-[var(--h-accent)]" />
            <span>
              {b}
              {COMING_SOON_FEATURES.has(b) && <ComingSoonBadge />}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Button size="lg" className="w-full" asChild>
          <a href="/sign-in">Start with Team</a>
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature comparison table
// ---------------------------------------------------------------------------

function ComparisonSection() {
  type Cell = string | boolean
  const rows: {
    category: string
    items: { label: string; free: Cell; team: Cell; hint?: string }[]
  }[] = [
    {
      category: 'Core',
      items: [
        { label: 'Projects', free: '1', team: 'Unlimited' },
        { label: 'Environments per project', free: '2', team: 'Unlimited' },
        { label: 'Variables', free: 'Unlimited', team: 'Unlimited' },
        {
          label: 'Team members',
          free: '5',
          team: '10 included + $4/mo per extra',
        },
      ],
    },
    {
      category: 'Security & Audit',
      items: [
        { label: 'Encrypted at rest (AES-256-GCM)', free: true, team: true },
        { label: 'Per-organization encryption keys', free: true, team: true },
        { label: 'Audit history', free: '14 days', team: '180 days' },
        { label: 'Secret versioning & rollback', free: false, team: true },
      ],
    },
    {
      category: 'Developer tooling',
      items: [
        { label: 'Dashboard', free: true, team: true },
        { label: 'CLI', free: false, team: true, hint: 'push, pull, diff' },
        { label: 'API access for CI/CD', free: false, team: true },
        { label: 'Webhooks on secret changes', free: false, team: true },
        { label: 'Environment cloning', free: false, team: true },
      ],
    },
    {
      category: 'Access control',
      items: [
        {
          label: 'Role-based permissions',
          free: true,
          team: true,
          hint: 'Owner, admin, member',
        },
        { label: 'Invitations by email', free: true, team: true },
      ],
    },
    // {
    //   category: 'Support',
    //   items: [
    //     { label: 'Community support', free: true, team: true },
    //     { label: 'Email support', free: false, team: true },
    //   ],
    // },
  ]

  return (
    <section className="border-t border-[var(--h-border)] bg-[var(--h-surface)] px-4 py-20 lg:py-28">
      <div className="page-wrap">
        <Badge
          variant="outline"
          className="mb-3 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide"
        >
          Compare plans
        </Badge>
        <h2 className="max-w-2xl font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Feature by feature.
        </h2>

        <div className="mt-10 overflow-x-auto rounded-2xl border border-[var(--h-border)] bg-[var(--h-bg)] lg:mt-14">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--h-border)]">
                <th className="w-1/2 px-6 py-5 text-left font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--h-text-3)]">
                  Feature
                </th>
                <th className="w-1/4 px-6 py-5 text-left font-display text-base font-semibold text-[var(--h-text)]">
                  Free
                </th>
                <th className="w-1/4 px-6 py-5 text-left font-display text-base font-semibold text-[var(--h-text)]">
                  Team
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((section) => (
                <ComparisonGroup key={section.category} {...section} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function ComparisonGroup({
  category,
  items,
}: {
  category: string
  items: {
    label: string
    free: string | boolean
    team: string | boolean
    hint?: string
  }[]
}) {
  return (
    <>
      <tr className="bg-[var(--h-surface)]/60">
        <td
          colSpan={3}
          className="px-6 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--h-text-3)]"
        >
          {category}
        </td>
      </tr>
      {items.map((row, i) => (
        <tr
          key={row.label}
          className={
            i === items.length - 1 ? '' : 'border-b border-[var(--h-border)]/60'
          }
        >
          <td className="px-6 py-4 align-top">
            <span className="text-[var(--h-text)]">
              {row.label}
              {COMING_SOON_FEATURES.has(row.label) && <ComingSoonBadge />}
            </span>
            {row.hint && (
              <p className="mt-0.5 text-xs text-[var(--h-text-3)]">
                {row.hint}
              </p>
            )}
          </td>
          <td className="px-6 py-4 align-top text-[var(--h-text-2)]">
            <Cell value={row.free} />
          </td>
          <td className="px-6 py-4 align-top text-[var(--h-text-2)]">
            <Cell value={row.team} />
          </td>
        </tr>
      ))}
    </>
  )
}

function Cell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="size-4 text-[var(--h-accent)]" />
  }
  if (value === false) {
    return <Minus className="size-4 text-[var(--h-text-3)]" />
  }
  return <span>{value}</span>
}

// ---------------------------------------------------------------------------
// Calculator: pricing for your team size
// ---------------------------------------------------------------------------

function CalculatorSection({ cadence }: { cadence: Cadence }) {
  const [seats, setSeats] = useState(TEAM_INCLUDED_SEATS + 5)
  const isAnnual = cadence === 'annual'

  const breakdown = useMemo(() => {
    const included = TEAM_INCLUDED_SEATS
    const perSeatMonthly = isAnnual ? 3.5 : 4
    const base = isAnnual ? 200 : 20
    const extra = Math.max(0, seats - included)

    if (isAnnual) {
      const extraAnnual = extra * perSeatMonthly * 12
      const total = base + extraAnnual
      return {
        baseLabel: 'Annual base',
        baseAmount: base,
        extra,
        extraAmount: extraAnnual,
        total,
        label: 'Per year',
        perMonth: total / 12,
      }
    }
    const extraMonthly = extra * perSeatMonthly
    const total = base + extraMonthly
    return {
      baseLabel: 'Monthly base',
      baseAmount: base,
      extra,
      extraAmount: extraMonthly,
      total,
      label: 'Per month',
      perMonth: total,
    }
  }, [seats, isAnnual])

  const competitors = [
    { name: 'Handoff', cost: breakdown.perMonth, highlighted: true },
    { name: 'Doppler', cost: seats * 21, highlighted: false },
    { name: 'Infisical', cost: seats * 18, highlighted: false },
  ]

  return (
    <section className="border-t border-[var(--h-border)] px-4 py-20 lg:py-28">
      <div className="page-wrap">
        <h2 className="max-w-2xl font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Fraction of the price. Same security foundation.
        </h2>

        <div className="mt-10 grid gap-6 lg:mt-14 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-[var(--h-border)] bg-[var(--h-surface)]/60 p-7">
            <label
              htmlFor="seats"
              className="flex items-baseline justify-between gap-4"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-text-3)]">
                Team size
              </span>
              <span className="font-display text-2xl font-bold tracking-tight text-[var(--h-text)]">
                {seats}{' '}
                <span className="font-sans text-sm font-normal text-[var(--h-text-3)]">
                  seat{seats === 1 ? '' : 's'}
                </span>
              </span>
            </label>

            <div className="relative mt-5">
              <input
                id="seats"
                type="range"
                min={1}
                max={50}
                value={seats}
                onChange={(e) => setSeats(parseInt(e.target.value, 10))}
                className="w-full accent-[var(--h-accent)]"
                aria-label="Number of team members"
              />
              {/* included threshold marker */}
              <div
                aria-hidden
                className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-[var(--h-accent)] opacity-60"
                style={{
                  left: `${((TEAM_INCLUDED_SEATS - 1) / (50 - 1)) * 100}%`,
                }}
              />
            </div>

            <div className="relative mt-2 h-4 font-mono text-[10px] uppercase tracking-wider text-[var(--h-text-3)]">
              <span className="absolute left-0">1</span>
              <span
                className="absolute -translate-x-1/2 text-[var(--h-accent)]"
                style={{
                  left: `${((TEAM_INCLUDED_SEATS - 1) / (50 - 1)) * 100}%`,
                }}
              >
                {TEAM_INCLUDED_SEATS} included
              </span>
              <span className="absolute right-0">50</span>
            </div>

            <div
              key={isAnnual ? 'breakdown-annual' : 'breakdown-monthly'}
              className="flip-in mt-8 space-y-2 text-sm"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[var(--h-text-2)]">
                  {breakdown.baseLabel}
                </span>
                <span className="font-mono tabular-nums text-[var(--h-text)]">
                  ${breakdown.baseAmount.toFixed(2)}
                </span>
              </div>
              {breakdown.extra > 0 ? (
                <div className="flex items-baseline justify-between">
                  <span className="text-[var(--h-text-2)]">
                    {breakdown.extra} extra seat
                    {breakdown.extra === 1 ? '' : 's'}
                    <span className="ml-1 text-[var(--h-text-3)]">
                      · ${(isAnnual ? 3.5 : 4).toFixed(2)}/mo each
                    </span>
                  </span>
                  <span className="font-mono tabular-nums text-[var(--h-text)]">
                    ${breakdown.extraAmount.toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline justify-between text-[var(--h-accent)]">
                  <span>
                    All {seats} seat{seats === 1 ? '' : 's'} included
                  </span>
                  <span className="font-mono tabular-nums">$0.00</span>
                </div>
              )}
              <div className="mt-4 flex items-baseline justify-between border-t border-dashed border-[var(--h-border)] pt-4">
                <div>
                  <p className="font-medium text-[var(--h-text)]">
                    {breakdown.label}
                  </p>
                  {isAnnual && (
                    <p className="text-xs text-[var(--h-text-3)]">
                      ≈ ${breakdown.perMonth.toFixed(2)}/mo equivalent
                    </p>
                  )}
                </div>
                <p className="font-display text-3xl font-bold tabular-nums tracking-tight text-[var(--h-text)]">
                  ${breakdown.total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--h-border)] bg-[var(--h-bg)] p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--h-text-3)]">
              Vs. the alternatives
            </p>
            <p className="mt-2 text-sm text-[var(--h-text-2)]">
              Monthly cost at {seats} user{seats === 1 ? '' : 's'}.
            </p>

            <div className="mt-6 space-y-3">
              {competitors
                .slice()
                .sort((a, b) => a.cost - b.cost)
                .map((c) => {
                  const max = Math.max(...competitors.map((x) => x.cost))
                  const pct = max > 0 ? (c.cost / max) * 100 : 0
                  return (
                    <div key={c.name}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span
                          className={`text-sm ${
                            c.highlighted
                              ? 'font-semibold text-[var(--h-text)]'
                              : 'text-[var(--h-text-2)]'
                          }`}
                        >
                          {c.name}
                          {c.highlighted && (
                            <span className="ml-2 rounded-full bg-[var(--h-accent-subtle)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--h-accent)]">
                              You
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-sm tabular-nums text-[var(--h-text)]">
                          ${c.cost.toFixed(0)}/mo
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--h-border)]/60">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: c.highlighted
                              ? 'var(--h-accent)'
                              : 'var(--h-text-3)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>

            {(() => {
              const handoff = competitors.find((c) => c.highlighted)
              const others = competitors.filter((c) => !c.highlighted)
              if (!handoff || others.length === 0) return null
              const cheapest = Math.min(...others.map((c) => c.cost))
              const delta = cheapest - handoff.cost
              if (delta <= 0) return null
              const pctSavings = Math.round((delta / cheapest) * 100)
              return (
                <div className="mt-6 rounded-lg border border-[var(--h-accent)]/30 bg-[var(--h-accent-subtle)]/60 px-4 py-3 text-sm">
                  <span className="font-medium text-[var(--h-text)]">
                    Save ${delta.toFixed(0)}/mo
                  </span>
                  <span className="text-[var(--h-text-2)]">
                    {' '}
                    ({pctSavings}% less than the next cheapest option at this
                    team size).
                  </span>
                </div>
              )
            })()}

            <p className="mt-4 text-xs text-[var(--h-text-3)]">
              Competitor prices are approximate list rates as of April 2026.
              Check their sites for the most current pricing.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

function FaqSection() {
  const faqs = [
    {
      q: 'Can I start on the free plan and upgrade later?',
      a: "Yes. No credit card required to start. When you hit a limit, you'll see a prompt to upgrade; nothing is destroyed or locked retroactively.",
    },
    {
      q: 'How does the seat-based pricing work?',
      a: 'The Team plan includes 10 seats at a flat $20/mo (or $200/yr). Each additional member is $4/mo ($3.50/mo on annual).',
    },
    {
      q: 'When am I charged for adding a seat?',
      a: 'Adding a seat adds a prorated line item to your next scheduled invoice, not an immediate card charge. Removing a seat adds a prorated credit to your next invoice.',
    },
    {
      q: 'Can I cancel any time?',
      a: 'Yes. Cancel from the billing portal; your subscription stays active through the end of the current period, then switches back to Free automatically.',
    },
    {
      q: 'What happens to my data if I downgrade?',
      a: "Nothing is deleted. Your existing projects, environments, and variables stay intact. You just can't create new ones past the Free plan limits until you upgrade again.",
    },
    {
      q: 'Do you offer annual billing?',
      a: 'Yes. Save 17% with annual: $200/year instead of $240, and extra seats drop from $4/mo to $3.50/mo equivalent.',
    },
    {
      q: 'How secure is this?',
      a: 'Every value is encrypted at rest with AES-256-GCM using a per-organization key. Your master key never leaves our server, and organization keys are rotated on request. See our security page for the full threat model.',
    },
    {
      q: 'Do you offer refunds?',
      a: "Credits are applied to your next invoice automatically on downgrades. For specific refund requests, reach out and we'll sort it out.",
    },
  ]

  return (
    <section className="border-t border-[var(--h-border)] bg-[var(--h-surface)] px-4 py-20 lg:py-28">
      <div className="page-wrap">
        <h2 className="max-w-2xl font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Likely asking.
        </h2>

        <div className="mt-10 grid gap-0 lg:mt-14 lg:grid-cols-2 lg:gap-x-12">
          {faqs.map((f, i) => (
            <details
              key={f.q}
              className="group border-b border-[var(--h-border)] py-5"
              {...(i === 0 ? { open: true } : {})}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 list-none text-left">
                <h3 className="font-display text-base font-semibold text-[var(--h-text)]">
                  {f.q}
                </h3>
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--h-border)] text-[var(--h-text-2)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-prose pr-10 text-sm leading-relaxed text-[var(--h-text-2)]">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------

function FinalCtaSection() {
  return (
    <section className="border-t border-[var(--h-border)] bg-[var(--h-accent-subtle)] px-4 py-20 lg:py-28">
      <div className="page-wrap mx-auto max-w-2xl text-center">
        <h2 className="font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Try it free. Upgrade when you outgrow it.
        </h2>
        <p className="mt-4 text-base text-[var(--h-text-2)]">
          Thirty seconds to your first{' '}
          <code className="rounded-md bg-[var(--h-bg)] px-2 py-0.5 font-mono text-[0.9em]">
            handoff push
          </code>
          .
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href="/sign-in">Get started free</a>
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link to="/" className="group gap-1.5">
              Back to home
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
