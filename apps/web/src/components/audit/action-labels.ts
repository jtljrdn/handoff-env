import type { AuditAction } from '#/lib/services/audit'

export const ACTION_VERBS: Record<AuditAction, string> = {
  'project.create': 'created project',
  'project.delete': 'deleted project',
  'environment.create': 'added environment',
  'environment.delete': 'removed environment',
  'variable.create': 'added',
  'variable.update': 'updated',
  'variable.delete': 'removed',
  'variable.bulk': 'synced variables in',
  'token.create': 'created API token',
  'token.revoke': 'revoked API token',
  'variable.share.create': 'shared variable',
  'variable.share.revoke': 'revoked share for',
  'variable.share.view': 'viewed shared variable',
  'member.remove': 'removed member',
  'member.revoke_sessions': 'revoked sessions for member',
  'dek.rotation_enqueued': 'started key rotation',
  'dek.rotation_complete': 'completed key rotation',
}

export const ACTION_GROUPS: Array<{
  label: string
  actions: AuditAction[]
}> = [
  {
    label: 'Variables',
    actions: [
      'variable.create',
      'variable.update',
      'variable.delete',
      'variable.bulk',
    ],
  },
  {
    label: 'Projects & environments',
    actions: [
      'project.create',
      'project.delete',
      'environment.create',
      'environment.delete',
    ],
  },
  {
    label: 'Sharing',
    actions: [
      'variable.share.create',
      'variable.share.revoke',
      'variable.share.view',
    ],
  },
  {
    label: 'Members & tokens',
    actions: [
      'member.remove',
      'member.revoke_sessions',
      'token.create',
      'token.revoke',
    ],
  },
  {
    label: 'Encryption',
    actions: ['dek.rotation_enqueued', 'dek.rotation_complete'],
  },
]

export const ALL_AUDIT_ACTIONS: AuditAction[] = ACTION_GROUPS.flatMap(
  (g) => g.actions,
)

export function actionLabel(action: AuditAction): string {
  return ACTION_VERBS[action] ?? action
}
