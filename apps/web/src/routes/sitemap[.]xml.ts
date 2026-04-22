import { createFileRoute } from '@tanstack/react-router'
import { flatNav } from '#/content/docs-nav'
import { SITE_URL } from '#/lib/site'

const STATIC_PATHS = ['/', '/pricing', '/about', '/docs']

function buildSitemap() {
  const now = new Date().toISOString()
  const urls = [
    ...STATIC_PATHS.map((path) => ({ loc: `${SITE_URL}${path}`, lastmod: now })),
    ...flatNav.map((item) => ({
      loc: `${SITE_URL}/docs/${item.slug}`,
      lastmod: now,
    })),
  ]

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemap(), {
          status: 200,
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        }),
    },
  },
})
