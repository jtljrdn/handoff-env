import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '#/lib/server-fns/auth'
import { useState } from 'react'
import { useMountEffect } from '#/hooks/useMountEffect'
import {
  Shader,
  FlowingGradient,
  Grid,
  FilmGrain,
  ChromaticAberration,
} from 'shaders/react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LandingPage,
})

function LandingPage() {
  return (
    <main>
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <CTASection />
      <SlackNotification />
    </main>
  )
}

function HeroShader() {
  const [state, setState] = useState<{
    ready: boolean
    reducedMotion: boolean
  }>({ ready: false, reducedMotion: false })

  useMountEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setState({ ready: true, reducedMotion: mq.matches })
    const handler = (e: MediaQueryListEvent) =>
      setState((prev) => ({ ...prev, reducedMotion: e.matches }))
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  })

  if (!state.ready) return null

  const gradient = (
    <FlowingGradient
      colorA="#0a0806"
      colorB="#c88f32"
      colorC="#a06040"
      colorD="#2d8a57"
      speed={state.reducedMotion ? 0 : 0.3}
      colorSpace="oklch"
    />
  )

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <Shader className="h-full w-full opacity-25 dark:opacity-40">
        <ChromaticAberration>
          {gradient}
          <Grid
            color="oklch(0.50 0.02 70)"
            cells={20}
            thickness={0.3}
            opacity={0.25}
          />
          <FilmGrain strength={0.15} />
        </ChromaticAberration>
      </Shader>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--h-bg)] to-transparent" />
    </div>
  )
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <HeroShader />
      <div className="page-wrap relative z-10 px-4 pb-20 pt-16 lg:pb-28 lg:pt-24">
        <div className="lg:grid lg:grid-cols-[1fr_minmax(0,460px)] lg:items-center lg:gap-16">
          <div>
            <Badge
              variant="secondary"
              className="rise-in mb-5 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide"
            >
              For teams of 2-10 developers
            </Badge>
            <h1
              className="rise-in font-display text-[clamp(2.5rem,5.5vw+0.5rem,4.25rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--h-text)]"
              style={{ animationDelay: '60ms' }}
            >
              Your{' '}
              <code className="rounded-md bg-[var(--h-accent-subtle)] px-2 py-0.5 text-[0.88em]">
                .env
              </code>{' '}
              file,
              <br className="hidden sm:block" />
              but shared.
            </h1>
            <p
              className="rise-in mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--h-text-2)]"
              style={{ animationDelay: '120ms' }}
            >
              Stop Slacking API keys around. Handoff syncs your team's
              environment variables: push, pull, done.
            </p>
            <div
              className="rise-in mt-8 flex flex-wrap items-center gap-4"
              style={{ animationDelay: '180ms' }}
            >
              <Button size="lg" asChild>
                <a href="/sign-in">Get started</a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="#how-it-works" className="group gap-1.5">
                  See how it works
                  <span
                    className="inline-block transition-transform group-hover:translate-y-0.5"
                    aria-hidden="true"
                  >
                    &darr;
                  </span>
                </a>
              </Button>
            </div>
          </div>
          <div
            className="rise-in mt-12 lg:mt-0"
            style={{ animationDelay: '240ms' }}
          >
            <EnvFileDisplay />
          </div>
        </div>
      </div>
    </section>
  )
}

function EnvFileDisplay() {
  const vars = [
    { key: 'DATABASE_URL', value: 'postgresql://prod.db.●●●●●' },
    { key: 'STRIPE_SECRET', value: 'sk_live_●●●●●●●●●●●●' },
    { key: 'RESEND_API_KEY', value: 're_●●●●●●●●●●●●●●●●', changed: true },
    { key: 'APP_URL', value: 'https://app.handoff.dev' },
  ]

  return (
    <div className="overflow-hidden rounded-xl bg-[var(--h-panel)] ring-1 ring-[var(--h-panel-border)] shadow-[0_30px_60px_-15px_rgba(30,20,10,0.25),0_10px_20px_-8px_rgba(30,20,10,0.12),0_0_0_1px_rgba(255,240,210,0.04)_inset]">
      <div className="flex items-center justify-between border-b border-[var(--h-panel-border)] bg-[color-mix(in_oklch,var(--h-panel-border)_15%,var(--h-panel))] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--h-success)] shadow-[0_0_6px_var(--h-success)]" />
          <span className="font-mono text-xs text-[var(--h-panel-text-2)]">
            .env.production
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            <div className="h-5 w-5 rounded-full bg-[oklch(0.62_0.10_30)] ring-2 ring-[var(--h-panel)]" />
            <div className="h-5 w-5 rounded-full bg-[oklch(0.58_0.10_200)] ring-2 ring-[var(--h-panel)]" />
            <div className="h-5 w-5 rounded-full bg-[oklch(0.64_0.10_310)] ring-2 ring-[var(--h-panel)]" />
          </div>
          <span className="text-xs text-[var(--h-panel-text-3)]">
            3 members
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="space-y-3 font-mono text-[0.8125rem] leading-relaxed">
          {vars.map((v) => (
            <div key={v.key} className="flex items-baseline gap-4">
              <span
                className={
                  'changed' in v && v.changed
                    ? 'text-[var(--h-accent)]'
                    : 'text-[var(--h-panel-text-2)]'
                }
              >
                {v.key}
              </span>
              <span className="flex-1 truncate text-right text-[var(--h-panel-text)]">
                {v.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[var(--h-panel-border)] px-5 py-2.5">
        <p className="font-mono text-xs text-[var(--h-panel-text-3)]">
          Updated 2m ago by{' '}
          <span className="text-[var(--h-panel-text-2)]">@sarah</span>
        </p>
      </div>
    </div>
  )
}

function SlackNotification() {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div
      className="slack-slide-in fixed bottom-6 right-6 z-50 w-[320px] overflow-hidden rounded-xl bg-white shadow-[0_16px_48px_rgba(0,0,0,0.18),0_6px_16px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.08] max-sm:bottom-4 max-sm:right-4 max-sm:w-[calc(100vw-2rem)] dark:bg-[oklch(0.20_0.012_70)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.55)] dark:ring-white/[0.08]"
      style={{ animationDelay: '2s' }}
    >
      <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-[oklch(0.45_0.18_310)]" />

      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-[oklch(0.55_0.01_70)] transition-colors hover:bg-black/[0.06] hover:text-[oklch(0.30_0.01_70)] dark:text-[oklch(0.50_0.008_70)] dark:hover:bg-white/[0.08] dark:hover:text-[oklch(0.78_0.008_70)]"
        aria-label="Dismiss notification"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
        </svg>
      </button>

      <div className="flex items-start gap-3 py-3.5 pl-5 pr-10">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[oklch(0.62_0.10_30)] text-sm font-bold text-white">
          J
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-[oklch(0.25_0.02_70)] dark:text-[oklch(0.88_0.008_70)]">
              Jake
            </span>
            <span className="text-[11px] text-[oklch(0.60_0.01_70)] dark:text-[oklch(0.48_0.008_70)]">
              just now
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[oklch(0.40_0.015_70)] dark:text-[oklch(0.68_0.008_70)]">
            hey can you send me the .env for staging? lost mine again lol
          </p>
        </div>
      </div>
    </div>
  )
}

function HowItWorksSection() {
  const steps = [
    {
      command: 'handoff init',
      output: 'Project connected.',
      description: 'Link your project to Handoff.',
    },
    {
      command: 'handoff push',
      output: '→ 12 variables synced',
      description: 'Upload your .env to the cloud.',
    },
    {
      command: 'handoff pull',
      output: '✓ .env.production updated',
      description: 'Your team pulls the latest.',
    },
  ]

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t border-[var(--h-border)] bg-[var(--h-surface)] px-4 py-20 lg:py-28"
    >
      <div className="page-wrap">
        <Badge
          variant="outline"
          className="mb-3 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide"
        >
          How it works
        </Badge>
        <h2 className="font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Three commands. That's it.
        </h2>

        <div className="mt-12 grid gap-8 sm:grid-cols-3 lg:mt-16">
          {steps.map((step, i) => (
            <div key={step.command}>
              <div className="overflow-hidden rounded-lg bg-[var(--h-panel)] shadow-[0_8px_24px_-4px_rgba(30,20,10,0.18),0_3px_8px_-2px_rgba(30,20,10,0.1)] ring-1 ring-[var(--h-panel-border)]">
                <div className="px-4 py-3 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span className="select-none text-[var(--h-panel-text-3)]">
                      $
                    </span>
                    <span className="text-[var(--h-panel-text)]">
                      {step.command}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[var(--h-panel-text-2)]">
                    {step.output}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-[var(--h-text-2)]">
                <span className="mr-2 font-display font-bold text-[var(--h-text-3)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const features = [
    {
      title: 'Environments',
      desc: 'dev, staging, production. Same mental model you already have.',
    },
    {
      title: 'Team sharing',
      desc: "Invite by email. View or edit. That's the whole permission model.",
    },
    {
      title: 'CLI-first',
      desc: 'Works from your terminal, where you already are.',
    },
    {
      title: 'History',
      desc: 'Who changed what, when. Simple audit trail.',
    },
  ]

  return (
    <section className="border-t border-[var(--h-border)] px-4 py-20 lg:py-28">
      <div className="page-wrap">
        <Badge
          variant="outline"
          className="mb-3 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide"
        >
          Features
        </Badge>
        <h2 className="max-w-md font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Just enough. Nothing more.
        </h2>

        <div className="mt-12 grid gap-x-16 gap-y-10 sm:grid-cols-2 lg:mt-16">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="max-w-sm rounded-lg bg-[var(--h-surface)] px-5 py-5 shadow-[0_1px_3px_rgba(30,20,10,0.06),0_1px_2px_rgba(30,20,10,0.04)] ring-1 ring-[var(--h-border)]"
            >
              <span className="mb-2 flex items-center gap-2 font-display text-xs font-bold text-[var(--h-text-3)]">
                <span className="inline-block h-1 w-4 rounded-full bg-[var(--h-accent)]" />
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-display text-lg font-bold text-[var(--h-text)]">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--h-text-2)]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="border-t border-[var(--h-border)] bg-[var(--h-accent-subtle)] px-4 py-20 lg:py-28">
      <div className="page-wrap mx-auto max-w-2xl text-center">
        <h2 className="font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Stop asking Jake for the .env file.
        </h2>
        <p className="mt-4 text-base text-[var(--h-text-2)]">
          Free for teams up to 5. Set up in under a minute.
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <a href="/get-started">Get started</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
