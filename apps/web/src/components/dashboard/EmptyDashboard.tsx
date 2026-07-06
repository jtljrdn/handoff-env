import { useState } from 'react'
import { Check, Copy, FolderPlus, Terminal } from 'lucide-react'
import { Shader, FlowingGradient, FilmGrain } from 'shaders/react'
import { useMountEffect } from '#/hooks/useMountEffect'
import { Button } from '#/components/ui/button'

function EmptyStateShader() {
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
      className="pointer-events-none absolute inset-x-0 top-0 h-56 transition-opacity duration-1000 ease-out"
      style={{ opacity: ready ? 1 : 0 }}
      aria-hidden="true"
    >
      <Shader className="h-full w-full opacity-[0.18] dark:opacity-30">
        <FlowingGradient
          colorA="#060a1a"
          colorB="#1447e6"
          colorC="#0ea5e9"
          colorD="#7c3aed"
          speed={reducedMotion ? 0 : 0.28}
          colorSpace="oklch"
        />
        <FilmGrain strength={0.12} />
      </Shader>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" />
    </div>
  )
}

export function EmptyDashboard({
  orgName,
  onNewProject,
}: {
  orgName: string
  onNewProject: () => void
}) {
  const [copied, setCopied] = useState(false)
  const installSnippet = 'npm i -g handoff-env'

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(installSnippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="rise-in relative overflow-hidden rounded-lg border bg-card/60 px-6 py-10 md:px-10 md:py-14">
      <EmptyStateShader />
      <div className="relative mx-auto flex max-w-xl flex-col items-start gap-6">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[var(--h-accent)] pulse-accent" />
          {orgName}
        </span>

        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Your secrets have a home now.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Create your first project and paste in an existing{' '}
            <code className="bg-[var(--h-accent-subtle)]">.env</code> file.
            handoff-env encrypts each value, groups them by environment, and
            makes them one CLI command away on any machine.
          </p>
        </div>

        <ol className="grid w-full gap-4 text-sm">
          <Step index={1} title="Create a project">
            <Button size="sm" onClick={onNewProject} className="mt-1">
              <FolderPlus className="size-3.5" />
              New project
            </Button>
          </Step>
          <Step index={2} title="Install the CLI">
            <div className="mt-1 flex items-center gap-2 rounded-md border bg-background px-3 py-2 font-mono text-xs">
              <Terminal className="size-3.5 text-muted-foreground" />
              <code className="flex-1 bg-transparent p-0 text-foreground">
                {installSnippet}
              </code>
              <button
                type="button"
                onClick={copyInstall}
                aria-label="Copy install command"
                className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {copied ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </button>
            </div>
          </Step>
          <Step index={3} title="Pull on any machine">
            <code className="mt-1 inline-block bg-[var(--h-accent-subtle)] font-mono text-xs">
              handoff init &amp;&amp; handoff pull
            </code>
          </Step>
        </ol>
      </div>
    </section>
  )
}

function Step({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs text-muted-foreground">
        {index}
      </span>
      <div className="flex-1">
        <p className="font-display text-sm font-bold tracking-tight text-foreground">
          {title}
        </p>
        {children}
      </div>
    </li>
  )
}
