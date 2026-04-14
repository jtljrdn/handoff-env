export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--h-border)] px-4 py-10">
      <div className="page-wrap flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <svg
            viewBox="0 0 20 20"
            width="14"
            height="14"
            aria-hidden="true"
          >
            <rect
              x="0"
              y="3"
              width="11"
              height="13"
              rx="2.5"
              fill="var(--h-text-3)"
              opacity="0.45"
            />
            <rect
              x="5"
              y="5"
              width="11"
              height="13"
              rx="2.5"
              fill="var(--h-text-3)"
            />
          </svg>
          <span className="text-sm text-[var(--h-text-3)]">
            &copy; {year} Handoff
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <a
            href="/privacy"
            className="text-[var(--h-text-3)] transition-colors hover:text-[var(--h-text)]"
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="text-[var(--h-text-3)] transition-colors hover:text-[var(--h-text)]"
          >
            Terms
          </a>
          <a
            href="https://github.com/handoff"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--h-text-3)] transition-colors hover:text-[var(--h-text)]"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
