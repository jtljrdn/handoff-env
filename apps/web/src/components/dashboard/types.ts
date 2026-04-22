import type { OrgRole } from '@handoff-env/types'

export interface DashboardProject {
  id: string
  name: string
  slug: string
  environmentCount: number
  variableCount: number
  createdAt: string
  lastActivityAt: string | null
  lastActivityLabel: string
  lastActivityBy: {
    userId: string
    name: string | null
    email: string | null
  } | null
}

export interface DashboardRecent {
  projectId: string
  projectName: string
  projectSlug: string
  environmentId: string
  environmentName: string
  variableCount: number
  lastActivityAt: string
  lastActivityLabel: string
  isFresh: boolean
}

export interface DashboardActivityEntry {
  id: string
  action: string
  actor: {
    userId: string
    name: string | null
    email: string | null
  }
  projectId: string | null
  projectName: string | null
  projectSlug: string | null
  environmentName: string | null
  targetKey: string | null
  createdAt: string
  createdAtLabel: string
}

export interface DashboardData {
  org: {
    id: string
    name: string
    logo: string
  }
  plan: 'free' | 'team'
  currentUserRole: OrgRole
  atProjectLimit: boolean
  atMemberLimit: boolean
  limits: { maxProjects: number | null; maxMembers: number | null }
  projects: DashboardProject[]
  recents: DashboardRecent[]
  activity: DashboardActivityEntry[]
}

export function envDot(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('prod')) return 'var(--chart-2)'
  if (lower.includes('stag')) return 'var(--chart-3)'
  if (lower.includes('dev')) return 'var(--h-text-3)'
  return 'var(--chart-1)'
}

export function actorLabel(actor: {
  name: string | null
  email: string | null
}): string {
  if (actor.name && actor.name.trim().length > 0) return actor.name
  if (actor.email) return actor.email.split('@')[0] ?? actor.email
  return 'someone'
}

export function actorInitials(actor: {
  name: string | null
  email: string | null
}): string {
  const label = actorLabel(actor)
  const parts = label.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return label.slice(0, 2).toUpperCase()
}
