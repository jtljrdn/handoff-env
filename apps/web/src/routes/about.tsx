import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { GradientField } from '#/components/marketing/GradientField'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About · Handoff' },
      {
        name: 'description',
        content:
          'Handoff is the simplest way to share environment variables with your team. Built by one developer who got tired of pasting secrets into Slack.',
      },
    ],
  }),
  component: About,
})

function About() {
  return (
    <main>
      <section className="relative -mt-16 overflow-hidden px-4 pb-16 pt-32 lg:pb-20 lg:pt-44">
        <GradientField />
        <div className="page-wrap relative z-10">
          <h1
            className="rise-in max-w-2xl font-display font-extrabold leading-[1.02] tracking-[-0.025em] text-[var(--h-text)] [text-wrap:balance]"
            style={{
              fontSize: 'clamp(2.25rem, 5vw + 0.5rem, 3.75rem)',
              animationDelay: '60ms',
            }}
          >
            Small tool. One job.
          </h1>
          <p
            className="rise-in mt-5 max-w-[54ch] text-lg leading-relaxed text-[var(--h-text-2)]"
            style={{ animationDelay: '140ms' }}
          >
            Handoff is the simplest way to share environment variables with your
            team. No enterprise complexity, just the tool developers wish they
            had.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 lg:pb-28">
        <div className="page-wrap grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-5 text-base leading-relaxed text-[var(--h-text-2)]">
            <p>
              Every team has the same ritual: someone joins, someone rotates a
              key, someone's laptop dies, and the <code>.env</code> file makes
              another lap through Slack. It works right up until a production
              key lands in a channel history nobody can scrub.
            </p>
            <p>
              Handoff replaces that ritual with three commands. Secrets are
              encrypted on your machine before they go anywhere, synced through
              a server that can't read them, and pulled by teammates in seconds.
              The dashboard exists for inviting people and reading the audit
              trail; the CLI does everything else.
            </p>
            <p>
              It's built by{' '}
              <a
                href="https://jtlee.dev"
                className="font-medium text-[var(--h-text)] underline decoration-[var(--h-border-strong)] underline-offset-4 transition-colors hover:decoration-[var(--h-text-3)]"
              >
                Jordan Lee
              </a>
              , one developer who got tired of asking for the staging env. That
              means no sales calls and no procurement forms, but it also means
              every design decision optimizes for the small team that just wants
              this problem gone.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--h-border)] bg-[var(--h-surface)] p-6">
              <h2 className="font-display text-lg font-bold text-[var(--h-text)]">
                What we believe
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--h-text-2)]">
                <li>
                  Zero-knowledge isn't a feature tier. Every plan gets the same
                  encryption.
                </li>
                <li>
                  A secrets manager should disappear into your workflow, not
                  become another dashboard to babysit.
                </li>
                <li>
                  Honest limits beat marketing. Our security page lists what we
                  haven't built yet.
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/request-access">Request access</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/security" className="group gap-1.5">
                  Read the security model
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
