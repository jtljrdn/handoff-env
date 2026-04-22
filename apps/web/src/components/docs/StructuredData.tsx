import { findGroupForSlug } from '#/content/docs-nav'
import { SITE_URL } from '#/lib/site'

export function DocsStructuredData({
  slug,
  title,
  description,
}: {
  slug: string
  title: string
  description: string
}) {
  const url = `${SITE_URL}/docs/${slug}`
  const group = findGroupForSlug(slug)

  const article = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'Handoff' },
    publisher: { '@type': 'Organization', name: 'Handoff' },
  }

  const breadcrumbItems = [
    { name: 'Home', item: SITE_URL },
    { name: 'Docs', item: `${SITE_URL}/docs` },
  ]
  if (group) breadcrumbItems.push({ name: group.title, item: url })
  breadcrumbItems.push({ name: title, item: url })

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((entry, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: entry.name,
      item: entry.item,
    })),
  }

  // JSON.stringify of a structured-data object; no user HTML, XSS-safe
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </>
  )
}
