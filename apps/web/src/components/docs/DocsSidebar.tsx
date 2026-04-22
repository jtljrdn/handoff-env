import { Link, useRouterState } from '@tanstack/react-router'
import { docsNav } from '#/content/docs-nav'

export function DocsSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav
      aria-label="Documentation"
      className="flex flex-col gap-7 py-8 pr-6 text-sm"
    >
      {docsNav.map((group) => (
        <div key={group.title}>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--h-text-3)]">
            {group.title}
          </p>
          <ul className="flex flex-col">
            {group.items.map((item) => {
              const href = `/docs/${item.slug}`
              const isActive = pathname === href
              return (
                <li key={item.slug}>
                  <Link
                    to={href}
                    className={`-ml-3 block rounded-md px-3 py-1.5 transition-colors ${
                      isActive
                        ? 'bg-[var(--h-accent-subtle)] text-[var(--h-text)] font-medium'
                        : 'text-[var(--h-text-2)] hover:text-[var(--h-text)] hover:bg-[var(--h-surface)]'
                    }`}
                  >
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
