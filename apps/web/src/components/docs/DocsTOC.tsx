import { useEffect, useState } from 'react'

type Heading = { id: string; text: string; level: number }

export function DocsTOC({
  contentSelector,
  slug,
}: {
  contentSelector: string
  slug: string
}) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    setActiveId(null)

    const scan = () => {
      const container = document.querySelector(contentSelector)
      if (!container) return null
      const nodes = Array.from(
        container.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'),
      )
      if (nodes.length === 0) return null
      const list: Heading[] = nodes.map((el) => ({
        id: el.id,
        text: el.textContent?.trim() ?? '',
        level: Number(el.tagName.slice(1)),
      }))
      setHeadings(list)
      return nodes
    }

    let nodes = scan()
    let observer: IntersectionObserver | null = null
    let mutation: MutationObserver | null = null

    const attach = (headingNodes: HTMLHeadingElement[]) => {
      observer?.disconnect()
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort(
              (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
            )
          if (visible[0]) setActiveId(visible[0].target.id)
        },
        { rootMargin: '-80px 0px -70% 0px', threshold: [0, 1] },
      )
      for (const node of headingNodes) observer.observe(node)
    }

    if (nodes) {
      attach(nodes)
    } else {
      setHeadings([])
      const container = document.querySelector(contentSelector)
      if (container) {
        mutation = new MutationObserver(() => {
          const fresh = scan()
          if (fresh) {
            attach(fresh)
            mutation?.disconnect()
          }
        })
        mutation.observe(container, { childList: true, subtree: true })
      }
    }

    return () => {
      observer?.disconnect()
      mutation?.disconnect()
    }
  }, [contentSelector, slug])

  if (headings.length === 0) return null

  return (
    <nav
      aria-label="On this page"
      className="sticky top-24 flex flex-col gap-2 text-sm"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--h-text-3)]">
        On this page
      </p>
      <ul className="flex flex-col gap-1.5 border-l border-[var(--h-border)]">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingLeft: (h.level - 2) * 12 }}>
            <a
              href={`#${h.id}`}
              className={`-ml-px block border-l border-transparent pl-3 py-0.5 text-xs leading-relaxed transition-colors ${
                activeId === h.id
                  ? 'border-[var(--h-accent)] text-[var(--h-text)]'
                  : 'text-[var(--h-text-3)] hover:text-[var(--h-text-2)]'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
