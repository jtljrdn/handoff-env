import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ArrowRight, Check, Lock, RotateCcw } from 'lucide-react'
import { useMountEffect } from '#/hooks/useMountEffect'
import { GradientField } from '#/components/marketing/GradientField'
import { SunsetPane } from '#/components/marketing/SunsetPane'
import { Button } from '#/components/ui/button'
import { TOOL_LOGOS } from '#/components/tool-logos.tsx'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <main>
      <HeroSection />
      <IntegrationStrip />
      <HowItWorksSection />
      <ZeroKnowledgeSection />
      <FeatureLedgerSection />
      <PricingSection />
      <ClosingCTASection />
      <SlackNotification />
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroSection() {
  return (
    <section className="relative -mt-[calc(4rem+2px)] overflow-hidden">
      <GradientField />

      <div className="page-wrap relative z-10 px-4 pb-24 pt-36 lg:pb-32 lg:pt-44">
        <div className="lg:grid lg:grid-cols-[1.1fr_minmax(0,440px)] lg:items-center lg:gap-16">
          <div>
            <h1
              className="rise-in font-display text-[clamp(2.75rem,5.5vw+0.75rem,5rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-[var(--h-text)] [text-wrap:balance]"
              style={{ animationDelay: '60ms' }}
            >
              Your{' '}
              <span className="font-mono text-[0.85em] font-bold text-[var(--h-accent)]">
                .env
              </span>{' '}
              file,
              <br />
              but shared.
            </h1>
            <p
              className="rise-in mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--h-text-2)]"
              style={{ animationDelay: '140ms' }}
            >
              Stop Slacking API keys around. Handoff encrypts your team's
              environment variables on your machine, then syncs them everywhere
              with a single command.
            </p>
            <div
              className="rise-in mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '220ms' }}
            >
              <Button size="lg" asChild>
                <Link to="/request-access">Request access</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="bg-[color-mix(in_oklch,var(--h-surface)_70%,transparent)] backdrop-blur-sm"
              >
                <a href="/sign-in">Sign in</a>
              </Button>
            </div>
            <p
              className="rise-in mt-5 text-sm text-[var(--h-text-3)]"
              style={{ animationDelay: '300ms' }}
            >
              Free for small teams. No credit card required.
            </p>
          </div>

          <div
            className="rise-in mt-16 lg:mt-0"
            style={{ animationDelay: '280ms' }}
          >
            <EnvVaultCard />
          </div>
        </div>
      </div>
    </section>
  )
}

function EnvVaultCard() {
  const vars = [
    { key: 'DATABASE_URL', value: 'postgresql://prod.db.●●●●●' },
    { key: 'STRIPE_SECRET', value: 'sk_live_●●●●●●●●●●●●' },
    { key: 'RESEND_API_KEY', value: 're_●●●●●●●●●●●●●●●●', changed: true },
    { key: 'APP_URL', value: 'https://app.gethandoff.dev' },
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)] shadow-[0_24px_48px_-18px_oklch(0.45_0.14_264_/_0.25),0_8px_16px_-10px_oklch(0.30_0.06_264_/_0.12)]">
      <div className="flex items-center justify-between border-b border-[var(--h-border)] px-5 py-3">
        <span className="font-mono text-xs font-medium text-[var(--h-text-2)]">
          .env.production
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--h-accent-subtle)] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--h-accent)]">
          <Lock className="size-3" aria-hidden="true" />
          Encrypted on-device
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="space-y-3 font-mono text-[0.8125rem] leading-relaxed">
          {vars.map((v) => (
            <div key={v.key} className="flex items-baseline gap-4">
              <span
                className={
                  'changed' in v && v.changed
                    ? 'font-medium text-[var(--h-accent)]'
                    : 'text-[var(--h-text-2)]'
                }
              >
                {v.key}
              </span>
              <span className="flex-1 truncate text-right text-[var(--h-text-3)]">
                {v.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--h-border)] px-5 py-2.5">
        <p className="font-mono text-xs text-[var(--h-text-3)]">
          Updated 2m ago by{' '}
          <span className="text-[var(--h-text-2)]">@sarah</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            <div className="h-5 w-5 rounded-full bg-[oklch(0.62_0.16_25)] ring-2 ring-[var(--h-surface)]" />
            <div className="h-5 w-5 rounded-full bg-[oklch(0.60_0.16_210)] ring-2 ring-[var(--h-surface)]" />
            <div className="h-5 w-5 rounded-full bg-[oklch(0.62_0.16_300)] ring-2 ring-[var(--h-surface)]" />
          </div>
          <span className="text-xs text-[var(--h-text-3)]">in sync</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

function IntegrationStrip() {
  return (
    <section className="border-b border-[var(--h-border)] px-4 py-9">
      <div className="page-wrap flex flex-col items-center gap-x-10 gap-y-6 sm:flex-row sm:justify-between">
        <p className="text-sm text-[var(--h-text-3)]">
          Drops into the tooling you already run
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
          {TOOL_LOGOS.map(({ name, Logo, href }) => (
            <a
              key={name}
              href={href}
              className="group flex items-center gap-2 rounded-full text-[var(--h-text-3)] transition-colors hover:text-[var(--h-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--h-bg)]"
              title={`Set up Handoff with ${name}`}
            >
              <Logo className="size-5 text-[var(--h-text-2)] transition-colors group-hover:text-[var(--h-accent)]" />
              <span className="font-display text-sm font-semibold">{name}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* CLI playback (kept from previous iteration: it is the product's    */
/* proof). Restaged below as a you → teammate pipeline.               */
/* ------------------------------------------------------------------ */

type Tone = 'muted' | 'normal' | 'accent' | 'success'

type LineChunk = { text: string; tone?: Tone }

type PlaybackStep =
  | { kind: 'lines'; chunks: LineChunk[]; after?: number }
  | { kind: 'progress'; total: number; tickMs: number; label: string }
  | { kind: 'replace-last'; chunks: LineChunk[]; after?: number }
  | { kind: 'pause'; ms: number }

type CommandScript = {
  command: string
  steps: PlaybackStep[]
  finalLines: LineChunk[][]
  reservedLines: number
}

const INIT_SCRIPT: CommandScript = {
  command: 'handoff init',
  reservedLines: 3,
  steps: [
    { kind: 'pause', ms: 220 },
    {
      kind: 'lines',
      chunks: [{ text: '› Detecting project...', tone: 'muted' }],
      after: 520,
    },
    {
      kind: 'lines',
      chunks: [{ text: '› Writing handoff.json', tone: 'muted' }],
      after: 420,
    },
    {
      kind: 'lines',
      chunks: [
        { text: '✓ ', tone: 'success' },
        { text: 'Project connected.', tone: 'normal' },
      ],
    },
  ],
  finalLines: [
    [{ text: '› Detecting project...', tone: 'muted' }],
    [{ text: '› Writing handoff.json', tone: 'muted' }],
    [
      { text: '✓ ', tone: 'success' },
      { text: 'Project connected.', tone: 'normal' },
    ],
  ],
}

const PUSH_SCRIPT: CommandScript = {
  command: 'handoff push',
  reservedLines: 4,
  steps: [
    { kind: 'pause', ms: 200 },
    {
      kind: 'lines',
      chunks: [{ text: '› Scanning .env...', tone: 'muted' }],
      after: 450,
    },
    {
      kind: 'lines',
      chunks: [{ text: '› Encrypting 12 keys', tone: 'muted' }],
      after: 300,
    },
    { kind: 'progress', total: 12, tickMs: 75, label: 'Encrypting 12 keys' },
    { kind: 'pause', ms: 180 },
    {
      kind: 'lines',
      chunks: [
        { text: '✓ ', tone: 'success' },
        { text: '12 variables synced ', tone: 'normal' },
        { text: '(+3 new)', tone: 'accent' },
      ],
    },
  ],
  finalLines: [
    [{ text: '› Scanning .env...', tone: 'muted' }],
    [{ text: '› Encrypting 12 keys', tone: 'muted' }],
    [
      { text: '  [', tone: 'muted' },
      { text: '████████████', tone: 'accent' },
      { text: '] 12/12', tone: 'muted' },
    ],
    [
      { text: '✓ ', tone: 'success' },
      { text: '12 variables synced ', tone: 'normal' },
      { text: '(+3 new)', tone: 'accent' },
    ],
  ],
}

const PULL_SCRIPT: CommandScript = {
  command: 'handoff pull',
  reservedLines: 4,
  steps: [
    { kind: 'pause', ms: 200 },
    {
      kind: 'lines',
      chunks: [{ text: '› Fetching manifest...', tone: 'muted' }],
      after: 480,
    },
    {
      kind: 'lines',
      chunks: [{ text: '› Decrypting 12 keys...', tone: 'muted' }],
      after: 520,
    },
    {
      kind: 'lines',
      chunks: [{ text: '› Writing .env.production', tone: 'muted' }],
      after: 420,
    },
    {
      kind: 'lines',
      chunks: [
        { text: '✓ ', tone: 'success' },
        { text: '.env.production ', tone: 'normal' },
        { text: 'updated', tone: 'accent' },
      ],
    },
  ],
  finalLines: [
    [{ text: '› Fetching manifest...', tone: 'muted' }],
    [{ text: '› Decrypting 12 keys...', tone: 'muted' }],
    [{ text: '› Writing .env.production', tone: 'muted' }],
    [
      { text: '✓ ', tone: 'success' },
      { text: '.env.production ', tone: 'normal' },
      { text: 'updated', tone: 'accent' },
    ],
  ],
}

function toneClass(tone: Tone | undefined): string {
  switch (tone) {
    case 'muted':
      return 'text-[var(--h-panel-text-3)]'
    case 'accent':
      return 'text-[var(--h-accent)]'
    case 'success':
      return 'text-[var(--h-success)]'
    default:
      return 'text-[var(--h-panel-text)]'
  }
}

function progressBar(cur: number, total: number): LineChunk[] {
  const width = 12
  const filled = Math.round((cur / total) * width)
  return [
    { text: '  [', tone: 'muted' },
    { text: '█'.repeat(filled), tone: 'accent' },
    { text: '░'.repeat(width - filled), tone: 'muted' },
    { text: `] ${cur}/${total}`, tone: 'muted' },
  ]
}

type Phase = 'idle' | 'typing' | 'running' | 'done'

function CommandPlayback({
  script,
  startDelayMs,
}: {
  script: CommandScript
  startDelayMs: number
}) {
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [lines, setLines] = useState<LineChunk[][]>([])
  const [flashKey, setFlashKey] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const genRef = useRef(0)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current.clear()
  }

  const sleep = (ms: number, gen: number) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => {
        timersRef.current.delete(t)
        if (gen !== genRef.current) reject(new Error('aborted'))
        else resolve()
      }, ms)
      timersRef.current.add(t)
    })

  const run = async (initialDelay: number) => {
    genRef.current += 1
    const gen = genRef.current
    clearTimers()
    setTyped('')
    setLines([])
    setPhase('idle')

    try {
      if (initialDelay > 0) await sleep(initialDelay, gen)
      setPhase('typing')
      for (let i = 1; i <= script.command.length; i++) {
        await sleep(45 + Math.random() * 55, gen)
        setTyped(script.command.slice(0, i))
      }
      await sleep(280, gen)
      setPhase('running')

      for (const step of script.steps) {
        if (step.kind === 'pause') {
          await sleep(step.ms, gen)
        } else if (step.kind === 'lines') {
          setLines((prev) => [...prev, step.chunks])
          if (step.after) await sleep(step.after, gen)
        } else if (step.kind === 'replace-last') {
          setLines((prev) => [...prev.slice(0, -1), step.chunks])
          if (step.after) await sleep(step.after, gen)
        } else {
          setLines((prev) => [...prev, progressBar(0, step.total)])
          for (let i = 1; i <= step.total; i++) {
            await sleep(step.tickMs, gen)
            setLines((prev) => [
              ...prev.slice(0, -1),
              progressBar(i, step.total),
            ])
          }
        }
      }
      setPhase('done')
      setFlashKey((k) => k + 1)
    } catch {
      /* aborted by replay or unmount */
    }
  }

  useMountEffect(() => {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (reduced) {
      setTyped(script.command)
      setLines(script.finalLines)
      setPhase('done')
      return
    }

    const el = cardRef.current
    if (!el) return

    let started = false
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !started) {
            started = true
            void run(startDelayMs)
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      genRef.current += 1
      clearTimers()
    }
  })

  const stateClass =
    phase === 'done'
      ? 'cli-card-done'
      : phase === 'typing' || phase === 'running'
        ? 'cli-card-active'
        : ''

  const showCaret = phase === 'typing' || phase === 'running'

  return (
    <div
      ref={cardRef}
      className={`cli-card relative overflow-hidden rounded-lg bg-[var(--h-panel)] shadow-[0_8px_24px_-4px_rgba(10,14,30,0.18),0_3px_8px_-2px_rgba(10,14,30,0.1)] ring-1 ring-[var(--h-panel-border)] transition-[box-shadow,transform] duration-500 ease-out ${stateClass}`}
    >
      {flashKey > 0 && (
        <span
          key={flashKey}
          className="pointer-events-none absolute inset-0 rounded-lg cli-success-flash"
          aria-hidden="true"
        />
      )}
      {(phase === 'typing' || phase === 'running') && (
        <span className="cli-scanline" aria-hidden="true" />
      )}

      <div className="flex items-center justify-between border-b border-[var(--h-panel-border)]/60 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[oklch(0.62_0.16_30)]" />
          <span className="h-2 w-2 rounded-full bg-[oklch(0.75_0.14_85)]" />
          <span
            className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              phase === 'done'
                ? 'bg-[var(--h-success)] shadow-[0_0_6px_var(--h-success)]'
                : 'bg-[oklch(0.55_0.12_155)]/50'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={() => void run(0)}
          className="cli-replay-btn inline-flex h-6 items-center gap-1 rounded px-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--h-panel-text-3)] transition-colors hover:text-[var(--h-panel-text)] focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--h-accent)]"
          aria-label={`Replay ${script.command}`}
        >
          <RotateCcw className="size-3" />
          replay
        </button>
      </div>

      <div className="relative px-4 py-3 font-mono text-sm">
        <div className="flex items-center gap-2">
          <span className="select-none text-[var(--h-panel-text-3)]">$</span>
          <span className="text-[var(--h-panel-text)]">{typed}</span>
          {showCaret && (
            <span
              className="caret-blink inline-block h-[1em] w-[0.55ch] -translate-y-[1px] bg-[var(--h-panel-text)]"
              aria-hidden="true"
            />
          )}
        </div>

        <div
          className="mt-1.5 space-y-0.5 text-[0.8125rem] leading-relaxed"
          style={{ minHeight: `${script.reservedLines * 1.45}em` }}
          aria-live="polite"
        >
          {lines.map((chunks, i) => (
            <div key={i} className="cli-line-in whitespace-pre">
              {chunks.map((c, j) => (
                <span key={j} className={toneClass(c.tone)}>
                  {c.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HowItWorksSection() {
  const steps: Array<{
    script: CommandScript
    machine: string
    theirs?: boolean
    description: string
  }> = [
    {
      script: INIT_SCRIPT,
      machine: 'you@laptop',
      description: 'Link your project to Handoff.',
    },
    {
      script: PUSH_SCRIPT,
      machine: 'you@laptop',
      description: 'Encrypt locally, then upload.',
    },
    {
      script: PULL_SCRIPT,
      machine: 'sam@teammate',
      theirs: true,
      description: 'Your team pulls the latest.',
    },
  ]

  return (
    <section id="how-it-works" className="scroll-mt-20 px-4 py-20 lg:py-28">
      <div className="page-wrap">
        <h2 className="font-display text-[clamp(1.875rem,3vw+0.5rem,2.75rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
          Three commands. That's it.
        </h2>
        <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-[var(--h-text-2)]">
          Two run on your machine. The third runs on your teammate's, and that's
          the whole point.
        </p>

        <div className="mt-12 grid items-start gap-x-6 gap-y-10 lg:mt-16 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {steps.map((item, i) => (
            <div key={item.script.command} className="contents">
              {i > 0 && (
                <div
                  className="hidden self-center pt-2 lg:block"
                  aria-hidden="true"
                >
                  <ArrowRight className="size-5 text-[var(--h-border-strong)]" />
                </div>
              )}
              <div>
                <p className="mb-3 flex items-center gap-2 font-mono text-xs text-[var(--h-text-3)]">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      item.theirs
                        ? 'bg-[oklch(0.62_0.16_300)]'
                        : 'bg-[var(--h-accent)]'
                    }`}
                    aria-hidden="true"
                  />
                  {item.machine}
                </p>
                <CommandPlayback script={item.script} startDelayMs={i * 650} />
                <p className="mt-4 text-sm text-[var(--h-text-2)]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Zero-knowledge boundary                                             */
/* ------------------------------------------------------------------ */

const BOUNDARY_PLAINTEXT = [
  { key: 'DATABASE_URL', value: 'postgresql://prod.db…' },
  { key: 'STRIPE_SECRET', value: 'sk_live_51Hg8…' },
  { key: 'RESEND_API_KEY', value: 're_8fPq2Vw…' },
]

const BOUNDARY_CIPHERTEXT = [
  'xsBNBGhq9E4BCAC7vZ2n…kQ==',
  'wcDMA9x0Yt1KpJvNAQv+…Xw==',
  'wV4Dq2LmR8sT3fUSAQdA…9g==',
]

function ZeroKnowledgeSection() {
  return (
    <section className="border-y border-[var(--h-border)] bg-[var(--h-surface)] px-4 py-20 lg:py-28">
      <div className="page-wrap">
        <div className="max-w-2xl">
          <h2 className="font-display text-[clamp(1.875rem,3vw+0.5rem,2.75rem)] font-bold leading-[1.1] tracking-tight text-[var(--h-text)] [text-wrap:balance]">
            We couldn't read your secrets if we tried.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--h-text-2)]">
            Every value is sealed on your machine before it touches the network:
            XChaCha20-Poly1305 authenticated encryption, X25519 sealed boxes,
            keys derived with Argon2id. What reaches our servers is ciphertext
            with your name on it.
          </p>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-xl border border-[var(--h-border)] lg:mt-16">
          <div className="grid lg:grid-cols-2">
            <div className="bg-[var(--h-bg)] p-6 lg:p-8">
              <p className="flex items-center gap-2 font-mono text-xs text-[var(--h-text-3)]">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--h-success)]"
                  aria-hidden="true"
                />
                your machine
              </p>
              <div className="mt-5 space-y-3 font-mono text-[0.8125rem] leading-relaxed">
                {BOUNDARY_PLAINTEXT.map((row) => (
                  <div key={row.key} className="flex items-baseline gap-3">
                    <span className="text-[var(--h-text)]">{row.key}</span>
                    <span className="select-none text-[var(--h-text-3)]">
                      =
                    </span>
                    <span className="truncate text-[var(--h-text-2)]">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-relaxed text-[var(--h-text-2)]">
                Plaintext exists here, and only here.
              </p>
            </div>

            <div className="border-t border-[var(--h-border)] bg-[var(--h-panel)] p-6 lg:border-l lg:border-t-0 lg:p-8">
              <p className="flex items-center gap-2 font-mono text-xs text-[var(--h-panel-text-2)]">
                <Lock
                  className="size-3 text-[var(--h-panel-text-2)]"
                  aria-hidden="true"
                />
                our servers
              </p>
              <div
                className="mt-5 space-y-3 font-mono text-[0.8125rem] leading-relaxed"
                aria-hidden="true"
              >
                {BOUNDARY_CIPHERTEXT.map((blob) => (
                  <div
                    key={blob}
                    className="truncate text-[var(--h-panel-text-3)]"
                  >
                    {blob}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-relaxed text-[var(--h-panel-text)]">
                Three sealed blobs. Even the variable names are encrypted.
              </p>
            </div>
          </div>

          <span className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-[var(--h-border-strong)] bg-[var(--h-surface)] px-3.5 py-1.5 font-mono text-[11px] font-medium text-[var(--h-text-2)] shadow-sm lg:inline-block">
            sealed · XChaCha20-Poly1305
          </span>
        </div>

        <p className="mt-6 max-w-[68ch] text-sm leading-relaxed text-[var(--h-text-3)]">
          Zero-knowledge means exactly that: losing your passphrase means losing
          the vault. We can't reset it, and that's the point.{' '}
          <Link
            to="/security"
            className="font-medium text-[var(--h-text-2)] underline decoration-[var(--h-border-strong)] underline-offset-4 transition-colors hover:text-[var(--h-text)] hover:decoration-[var(--h-text-3)]"
          >
            Read the security model
          </Link>
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Feature ledger                                                      */
/* ------------------------------------------------------------------ */

function FeatureLedgerSection() {
  const rows = [
    {
      name: 'Environments',
      desc: 'dev, staging, production. The same mental model you already have.',
      hint: 'handoff pull --env staging',
    },
    {
      name: 'Team sharing',
      desc: 'Invite by email. View or edit. That is the entire permission model.',
      hint: 'handoff invite sam@acme.dev',
    },
    {
      name: 'Runtime injection',
      desc: 'Secrets go straight into the process. Nothing new written to disk.',
      hint: 'handoff run -- bun dev',
    },
    {
      name: 'Audit history',
      desc: 'Who changed what, and when. An honest, readable audit trail.',
      hint: 'handoff log',
    },
    {
      name: 'CI/CD tokens',
      desc: 'Scoped, revocable tokens for the machines that ship your code.',
      hint: 'handoff token create ci',
    },
  ]

  return (
    <section className="px-4 py-20 lg:py-28">
      <div className="page-wrap">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-display text-[clamp(1.875rem,3vw+0.5rem,2.75rem)] font-bold leading-[1.1] tracking-tight text-[var(--h-text)]">
              Just enough. Nothing more.
            </h2>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-[var(--h-text-2)]">
              No dashboards to babysit, no config theater. Only the pieces a
              small team actually reaches for.
            </p>
          </div>
        </div>

        <dl className="mt-12 lg:mt-16">
          {rows.map((row) => (
            <div
              key={row.name}
              className="group grid gap-x-8 gap-y-1.5 border-t border-[var(--h-border)] py-5 last:border-b sm:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr_auto] lg:items-baseline"
            >
              <dt className="font-display text-base font-bold text-[var(--h-text)]">
                {row.name}
              </dt>
              <dd className="text-sm leading-relaxed text-[var(--h-text-2)]">
                {row.desc}
              </dd>
              <dd className="hidden font-mono text-xs text-[var(--h-text-3)] transition-colors group-hover:text-[var(--h-accent)] lg:block">
                $ {row.hint}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

const COMING_SOON_FEATURES = new Set([
  'Secret versioning & rollback',
  'Webhooks on secret changes',
  'Environment cloning',
])

function PricingSection() {
  const freeBullets = [
    '1 project',
    '2 environments per project',
    '5 team members',
    'Full CLI access (3 CI/CD tokens)',
    '14-day audit history',
  ]
  const teamBullets = [
    'Unlimited projects and environments',
    '10 seats included, then $4/user/mo',
    'Unlimited CI/CD tokens',
    'Secret versioning & rollback',
    '180-day audit history',
    'Webhooks on secret changes',
  ]

  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-t border-[var(--h-border)] bg-[var(--h-surface)] px-4 py-20 lg:py-28"
    >
      <div className="page-wrap">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-xl font-display text-[clamp(1.75rem,3vw+0.5rem,2.5rem)] font-bold leading-tight tracking-tight text-[var(--h-text)]">
            Two plans. Clearly priced.
          </h2>
          <Link
            to="/pricing"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--h-text-2)] transition-colors hover:text-[var(--h-text)]"
          >
            Compare every feature
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-[1fr_1.15fr] lg:gap-6">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border border-[var(--h-border)] bg-[var(--h-bg)] p-7">
            <p className="font-display text-base font-bold text-[var(--h-text)]">
              Free
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-[clamp(2.5rem,4vw,3.25rem)] font-bold tracking-tight text-[var(--h-text)]">
                $0
              </span>
              <span className="text-sm text-[var(--h-text-3)]">forever</span>
            </div>
            <p className="mt-3 text-sm text-[var(--h-text-2)]">
              For small teams getting started.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-[var(--h-text-2)]">
              {freeBullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--h-accent)]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-8">
              <Button size="lg" variant="outline" className="w-full" asChild>
                <a href="/request-access">Get started free</a>
              </Button>
            </div>
          </div>

          {/* Team: split sunset card, matching the pricing page */}
          <div className="grid overflow-hidden rounded-2xl shadow-[0_32px_64px_-32px_oklch(0.30_0.06_264/0.4)] ring-1 ring-[var(--h-border)] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <SunsetPane>
              <div className="flex h-full flex-col p-7">
                <p className="font-display text-base font-bold text-white">
                  Team
                </p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-[clamp(2.5rem,4vw,3.25rem)] font-bold tracking-tight text-white">
                    $20
                  </span>
                  <span className="text-sm text-white/75">per month</span>
                </div>
                <p className="mt-1 text-xs text-white/75">
                  or $200/year, save 17%
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/90">
                  For teams shipping production.
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-8">
                  <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    14-day free trial
                  </span>
                  <span className="text-xs text-white/70">
                    No card required
                  </span>
                </div>
              </div>
            </SunsetPane>

            <div className="flex flex-col bg-[var(--h-surface)] p-7">
              <ul className="space-y-2.5 text-sm text-[var(--h-text-2)]">
                {teamBullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-[var(--h-accent)]" />
                    <span>
                      {b}
                      {COMING_SOON_FEATURES.has(b) && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-[var(--h-border)] bg-[var(--h-surface)] px-2 py-0.5 align-middle text-[10px] font-medium text-[var(--h-text-3)]">
                          Coming soon
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <Button size="lg" className="w-full" asChild>
                  <a href="/request-access">Try Team free for 14 days</a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--h-text-3)]">
          Prices in USD. Cancel any time. 17% off annual.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Closing CTA: the aurora returns, rising from the bottom edge        */
/* ------------------------------------------------------------------ */

function ClosingCTASection() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--h-border)]">
      <GradientField flip />
      <div className="page-wrap relative z-10 px-4 py-24 text-center lg:py-32">
        <h2 className="mx-auto max-w-2xl font-display text-[clamp(2rem,3.5vw+0.5rem,3.25rem)] font-bold leading-[1.08] tracking-tight text-[var(--h-text)] [text-wrap:balance]">
          Stop asking Jake for the .env file.
        </h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-base leading-relaxed text-[var(--h-text-2)]">
          Free forever for small teams. Try Team free for 14 days, no card
          required.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/request-access">Start free trial</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="bg-[color-mix(in_oklch,var(--h-surface)_70%,transparent)] backdrop-blur-sm"
          >
            <Link to="/pricing" className="group gap-1.5">
              See pricing
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Slack toast: the problem, restated as a gag                         */
/* ------------------------------------------------------------------ */

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
