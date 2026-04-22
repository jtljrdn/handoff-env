import { createFileRoute, Outlet } from '@tanstack/react-router'
import { DocsSidebar } from '#/components/docs/DocsSidebar'

export const Route = createFileRoute('/docs')({
  component: DocsLayout,
})

function DocsLayout() {
  return (
    <main className="page-wrap">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="hidden border-r border-[var(--h-border)] lg:block">
          <div className="sticky top-16">
            <DocsSidebar />
          </div>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </main>
  )
}
