export const PLAN_NAMES = ['free', 'team'] as const
export type PlanName = (typeof PLAN_NAMES)[number]

export type PlanLimits = {
  maxProjects: number
  maxEnvironmentsPerProject: number
  maxMembers: number
  maxApiTokens: number
  auditRetentionDays: number
}

export const FREE_LIMITS: PlanLimits = {
  maxProjects: 1,
  maxEnvironmentsPerProject: 2,
  maxMembers: 5,
  maxApiTokens: 3,
  auditRetentionDays: 14,
}

export const TEAM_LIMITS: PlanLimits = {
  maxProjects: Number.POSITIVE_INFINITY,
  maxEnvironmentsPerProject: Number.POSITIVE_INFINITY,
  maxMembers: Number.POSITIVE_INFINITY,
  maxApiTokens: Number.POSITIVE_INFINITY,
  auditRetentionDays: 180,
}

export const TEAM_INCLUDED_SEATS = 10

export function getLimits(plan: PlanName): PlanLimits {
  return plan === 'team' ? TEAM_LIMITS : FREE_LIMITS
}

const requireEnv = (key: string): string => {
  const v = process.env[key]
  if (!v) throw new Error(`Missing required env var: ${key}`)
  return v
}

// Lazy so that pulling constants (TEAM_LIMITS, TEAM_INCLUDED_SEATS, etc.) into
// client code does NOT trigger reads of server-only Stripe env vars.
// Call this from server-only modules (auth.ts) that actually need the plan
// definitions.
export function getStripePlans() {
  return [
    {
      name: 'team',
      priceId: requireEnv('STRIPE_TEAM_MONTHLY'),
      annualDiscountPriceId: requireEnv('STRIPE_TEAM_YEARLY'),
      limits: {
        projects: -1,
        environments: -1,
        members: -1,
        auditRetentionDays: TEAM_LIMITS.auditRetentionDays,
      },
    },
  ]
}
