import { z } from 'zod'

export const orgNameSchema = z.string().min(1).max(100)

export const orgRoles = ['owner', 'admin', 'member'] as const
export type OrgRole = (typeof orgRoles)[number]
export const orgRoleSchema = z.enum(orgRoles)
