import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getAdjacentDocs } from '#/content/docs-nav'

export function DocsPagination({ slug }: { slug: string }) {
  const { prev, next } = getAdjacentDocs(slug)
  if (!prev && !next) return null

  return (
    <div className="not-prose mt-16 grid gap-4 border-t border-[var(--h-border)] pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          to={`/docs/${prev.slug}`}
          className="group flex flex-col rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/40 px-5 py-4 transition-colors hover:border-[var(--h-accent)]/40 hover:bg-[var(--h-surface)]"
        >
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--h-text-3)]">
            <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
            Previous
          </span>
          <span className="mt-1.5 font-medium text-[var(--h-text)]">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          to={`/docs/${next.slug}`}
          className="group flex flex-col rounded-xl border border-[var(--h-border)] bg-[var(--h-surface)]/40 px-5 py-4 text-right transition-colors hover:border-[var(--h-accent)]/40 hover:bg-[var(--h-surface)] sm:col-start-2"
        >
          <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--h-text-3)]">
            Next
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-1.5 font-medium text-[var(--h-text)]">
            {next.title}
          </span>
        </Link>
      ) : null}
    </div>
  )
}
