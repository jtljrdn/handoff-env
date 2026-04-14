import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--h-border)] bg-[color-mix(in_oklch,var(--h-bg)_82%,transparent)] px-4 backdrop-blur-xl">
      <nav className="page-wrap flex items-center gap-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <svg
            viewBox="0 0 20 20"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <rect
              x="0"
              y="3"
              width="11"
              height="13"
              rx="2.5"
              fill="var(--h-accent)"
              opacity="0.45"
            />
            <rect
              x="5"
              y="5"
              width="11"
              height="13"
              rx="2.5"
              fill="var(--h-accent)"
            />
          </svg>
          <span className="font-display text-lg font-extrabold tracking-tight text-[var(--h-text)]">
            handoff
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <a
              href="/sign-in"
              className="hidden sm:inline-flex"
            >
              Sign in
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href="/get-started">Get started</a>
          </Button>
        </div>
      </nav>
    </header>
  )
}
