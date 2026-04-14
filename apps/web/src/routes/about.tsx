import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-20">
      <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--h-text)]">
        About Handoff
      </h1>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--h-text-2)]">
        Handoff is the simplest way to share environment variables with your
        team. No enterprise complexity, just the tool
        developers wish they had.
      </p>
    </main>
  )
}
