import { createFileRoute, notFound } from '@tanstack/react-router'
import { MDXProvider } from '@mdx-js/react'
import { DocsTOC } from '#/components/docs/DocsTOC'
import { DocsPagination } from '#/components/docs/DocsPagination'
import { DocsStructuredData } from '#/components/docs/StructuredData'
import { mdxComponents } from '#/components/docs/mdx-components'
import {
  findGroupForSlug,
  getAdjacentDocs,
} from '#/content/docs-nav'
import { getDocBySlug } from '#/lib/docs'
import { SITE_URL } from '#/lib/site'

export const Route = createFileRoute('/docs/$')({
  loader: ({ params }) => {
    const slug = params._splat ?? ''
    const doc = getDocBySlug(slug)
    if (!doc) throw notFound()
    return {
      slug,
      title: doc.frontmatter.title,
      description: doc.frontmatter.description,
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const { slug, title, description } = loaderData
    const url = `${SITE_URL}/docs/${slug}`
    const { prev, next } = getAdjacentDocs(slug)
    return {
      meta: [
        { title: `${title} · Handoff Docs` },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: url },
        { property: 'og:site_name', content: 'Handoff' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ],
      links: [
        { rel: 'canonical', href: url },
        ...(prev
          ? [{ rel: 'prev', href: `${SITE_URL}/docs/${prev.slug}` }]
          : []),
        ...(next
          ? [{ rel: 'next', href: `${SITE_URL}/docs/${next.slug}` }]
          : []),
      ],
    }
  },
  component: DocPage,
})

function DocPage() {
  const { slug, title, description } = Route.useLoaderData()
  const doc = getDocBySlug(slug)
  if (!doc) return null
  const MDX = doc.default
  const group = findGroupForSlug(slug)

  return (
    <article className="grid min-w-0 gap-10 py-10 xl:grid-cols-[minmax(0,1fr)_200px] xl:gap-12">
      <DocsStructuredData
        slug={slug}
        title={title}
        description={description}
      />
      <div className="min-w-0">
        <header className="mb-8">
          {group && (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--h-accent)]">
              {group.title}
            </p>
          )}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--h-text)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--h-text-2)]">
            {description}
          </p>
        </header>
        <div className="docs-prose" id="docs-content">
          <MDXProvider components={mdxComponents}>
            <MDX />
          </MDXProvider>
        </div>
        <DocsPagination slug={slug} />
      </div>
      <div className="hidden xl:block">
        <DocsTOC contentSelector="#docs-content" slug={slug} />
      </div>
    </article>
  )
}
