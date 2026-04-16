import type { OrgRole } from '@handoff-env/types'

const rolePermissions: Record<OrgRole, Record<string, readonly string[]>> = {
  owner: {
    project: ['create', 'update', 'delete'],
    environment: ['create', 'update', 'delete'],
    variable: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    member: ['create', 'update', 'delete'],
    organization: ['update', 'delete'],
  },
  admin: {
    project: ['create', 'update', 'delete'],
    environment: ['create', 'update', 'delete'],
    variable: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    member: ['create', 'update'],
    organization: ['update'],
  },
  member: {
    project: ['create'],
    environment: ['create'],
    variable: ['create', 'update'],
  },
}

export function hasPermission(
  role: OrgRole,
  resource: string,
  action: string,
): boolean {
  const permissions = rolePermissions[role]
  if (!permissions) return false
  const allowedActions = permissions[resource]
  if (!allowedActions) return false
  return allowedActions.includes(action)
}
