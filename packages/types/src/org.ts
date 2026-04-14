import { z } from 'zod'

export const orgSlugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Slug must be lowercase alphanumeric with hyphens, starting and ending with a letter or number',
  )

export const orgNameSchema = z.string().min(1).max(100)

export const orgRoles = ['owner', 'admin', 'member'] as const
export type OrgRole = (typeof orgRoles)[number]
export const orgRoleSchema = z.enum(orgRoles)
