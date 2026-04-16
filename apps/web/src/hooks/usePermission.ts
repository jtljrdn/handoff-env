import { authClient } from '#/lib/auth-client'
import { hasPermission } from '#/lib/permissions'
import type { OrgRole } from '@handoff-env/types'

export function usePermission(resource: string, action: string): boolean {
  const { data } = authClient.useActiveMemberRole()
  if (!data?.role) return false
  return hasPermission(data.role as OrgRole, resource, action)
}
