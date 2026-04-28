export type DocsNavItem = {
  slug: string
  title: string
}

export type DocsNavGroup = {
  title: string
  items: DocsNavItem[]
}

export const docsNav: DocsNavGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { slug: 'introduction', title: 'Introduction' },
      { slug: 'getting-started/installation', title: 'Installation' },
      { slug: 'getting-started/first-project', title: 'Your first project' },
    ],
  },
  {
    title: 'CLI',
    items: [
      { slug: 'cli/overview', title: 'Overview' },
      { slug: 'cli/push', title: 'handoff push' },
      { slug: 'cli/pull', title: 'handoff pull' },
      { slug: 'cli/diff', title: 'handoff diff' },
      { slug: 'cli/run', title: 'handoff run' },
      { slug: 'cli/share', title: 'handoff share' },
    ],
  },
  {
    title: 'Sharing',
    items: [
      { slug: 'sharing/variables', title: 'Sharing a variable' },
    ],
  },
  {
    title: 'CI/CD',
    items: [
      { slug: 'ci-cd/overview', title: 'Overview' },
      { slug: 'ci-cd/tokens', title: 'API tokens' },
      { slug: 'ci-cd/github-actions', title: 'GitHub Actions' },
      { slug: 'ci-cd/vps', title: 'VPS with systemd' },
      { slug: 'ci-cd/docker', title: 'Docker' },
      { slug: 'ci-cd/kubernetes', title: 'Kubernetes' },
      { slug: 'ci-cd/serverless', title: 'Serverless' },
    ],
  },
  {
    title: 'Security',
    items: [{ slug: 'security/model', title: 'Security model' }],
  },
]

export const flatNav: DocsNavItem[] = docsNav.flatMap((group) => group.items)

export function findNavItem(slug: string): DocsNavItem | undefined {
  return flatNav.find((item) => item.slug === slug)
}

export function findGroupForSlug(slug: string): DocsNavGroup | undefined {
  return docsNav.find((group) =>
    group.items.some((item) => item.slug === slug),
  )
}

export function getAdjacentDocs(slug: string): {
  prev: DocsNavItem | undefined
  next: DocsNavItem | undefined
} {
  const idx = flatNav.findIndex((item) => item.slug === slug)
  if (idx === -1) return { prev: undefined, next: undefined }
  return {
    prev: idx > 0 ? flatNav[idx - 1] : undefined,
    next: idx < flatNav.length - 1 ? flatNav[idx + 1] : undefined,
  }
}
