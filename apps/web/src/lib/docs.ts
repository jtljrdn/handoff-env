import type { ComponentType } from 'react'

export type DocFrontmatter = {
  title: string
  description: string
}

export type DocModule = {
  default: ComponentType<Record<string, unknown>>
  frontmatter: DocFrontmatter
}

const modules = import.meta.glob<DocModule>('../content/docs/**/*.mdx', {
  eager: true,
})

const bySlug = new Map<string, DocModule>()
for (const [path, mod] of Object.entries(modules)) {
  const slug = path
    .replace(/^\.\.\/content\/docs\//, '')
    .replace(/\.mdx$/, '')
  if (!mod.frontmatter?.title || !mod.frontmatter?.description) {
    throw new Error(
      `Doc "${slug}" is missing required frontmatter (title, description).`,
    )
  }
  bySlug.set(slug, mod)
}

export function getDocBySlug(slug: string): DocModule | undefined {
  return bySlug.get(slug)
}

export function getAllDocSlugs(): string[] {
  return Array.from(bySlug.keys())
}
