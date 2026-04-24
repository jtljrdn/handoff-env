import { createHash } from 'node:crypto'
import { createMiddleware } from '@tanstack/react-start'
import { pool } from '#/db/pool'
import { auth } from '#/lib/auth'
import { assertCliApiAccess } from '#/lib/billing/entitlements'
import { logger, errCtx } from '#/lib/logger'
import { hasPermission } from '#/lib/permissions'
import type { OrgRole } from '@handoff-env/types'

const log = logger.child({ scope: 'auth.middleware' })

export interface AuthenticatedUser {
  userId: string
  email: string
}

export interface CliAuthResult {
  userId: string
  orgId: string
  tokenId: string
  wrappedDek: string | null
  dekVersion: number | null
}

export const authMiddleware = createMiddleware().server(
  async ({ next, context }) => {
    const request = (context as unknown as { request?: Request }).request
    if (!request) {
      log.warn('session.reject', { reason: 'missing_request' })
      throw new Response(
        JSON.stringify({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      log.info('session.reject', { reason: 'no_session' })
      throw new Response(
        JSON.stringify({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

    log.debug('session.ok', { userId: session.user.id })
    return next({
      context: {
        user: {
          userId: session.user.id,
          email: session.user.email,
        } satisfies AuthenticatedUser,
      },
    })
  },
)

export interface OrgAuthenticatedUser extends AuthenticatedUser {
  orgId: string
}

export interface PlatformAdmin extends AuthenticatedUser {
  role: 'admin'
}

export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const { getRequest } = await import(
    /* @vite-ignore */ '@tanstack/react-start/server'
  )
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    log.info('admin.session.reject', { reason: 'no_session' })
    forbidden('Admin access required')
  }

  const role = (session.user as { role?: string }).role
  if (role !== 'admin') {
    log.warn('admin.session.reject', {
      reason: 'not_admin',
      userId: session.user.id,
    })
    forbidden('Admin access required')
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    role: 'admin',
  }
}

export async function requireOrgSession(): Promise<OrgAuthenticatedUser> {
  const { getRequest } = await import(
    /* @vite-ignore */ '@tanstack/react-start/server'
  )
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user) {
    log.info('org.session.reject', { reason: 'no_session' })
    throw new Error('Authentication required')
  }

  const orgId = session.session.activeOrganizationId
  if (!orgId) {
    log.info('org.session.reject', {
      reason: 'no_active_org',
      userId: session.user.id,
    })
    throw new Error('No active organization')
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    orgId,
  }
}

async function getMemberRole(userId: string, orgId: string): Promise<OrgRole> {
  const result = await pool.query(
    'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
    [userId, orgId],
  )
  if (result.rows.length === 0) {
    log.warn('member.not_found', { userId, orgId })
    forbidden('You are not a member of this organization')
  }
  return result.rows[0].role as OrgRole
}

function assertPermission(
  role: OrgRole,
  resource: string,
  action: string,
  ctx?: { userId?: string; orgId?: string },
): void {
  if (!hasPermission(role, resource, action)) {
    log.warn('permission.denied', { role, resource, action, ...ctx })
    forbidden('You do not have permission to perform this action')
  }
}

export async function requirePermission(
  resource: string,
  action: string,
): Promise<OrgAuthenticatedUser> {
  const user = await requireOrgSession()
  const role = await getMemberRole(user.userId, user.orgId)
  assertPermission(role, resource, action, {
    userId: user.userId,
    orgId: user.orgId,
  })
  return user
}

export async function requireCliPermission(
  cliAuth: CliAuthResult,
  resource: string,
  action: string,
): Promise<void> {
  const role = await getMemberRole(cliAuth.userId, cliAuth.orgId)
  assertPermission(role, resource, action, {
    userId: cliAuth.userId,
    orgId: cliAuth.orgId,
  })
}

export async function requireCliAuth(
  request: Request,
): Promise<CliAuthResult> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    log.info('cli.auth.reject', { reason: 'missing_bearer' })
    throw new Response(
      JSON.stringify({ error: 'Bearer token required', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const token = authHeader.slice(7)
  if (!token.startsWith('hnd_')) {
    log.info('cli.auth.reject', { reason: 'bad_prefix' })
    throw new Response(
      JSON.stringify({ error: 'Invalid token format', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const tokenPrefix = token.slice(0, 12)
  const hashedToken = createHash('sha256').update(token).digest('hex')

  const r = await pool.query(
    `SELECT id, user_id, org_id, expires_at,
            wrapped_dek, dek_version
       FROM api_tokens
      WHERE hashed_token = $1
      LIMIT 1`,
    [hashedToken],
  )
  const row = r.rows[0]

  if (!row) {
    log.info('cli.auth.reject', { reason: 'not_found', tokenPrefix })
    throw new Response(
      JSON.stringify({ error: 'Invalid token', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    log.info('cli.auth.reject', {
      reason: 'expired',
      tokenPrefix,
      tokenId: row.id,
      orgId: row.org_id,
    })
    throw new Response(
      JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  await assertCliApiAccess(row.org_id)

  try {
    await pool.query(
      `UPDATE api_tokens SET last_used_at = now() WHERE id = $1`,
      [row.id],
    )
  } catch (touchErr) {
    log.warn(
      'cli.auth.touch_failed',
      errCtx(touchErr, { tokenId: row.id, orgId: row.org_id }),
    )
  }

  log.debug('cli.auth.ok', {
    tokenId: row.id,
    userId: row.user_id,
    orgId: row.org_id,
  })

  return {
    userId: row.user_id,
    orgId: row.org_id,
    tokenId: row.id,
    wrappedDek: row.wrapped_dek
      ? Buffer.from(row.wrapped_dek).toString('base64')
      : null,
    dekVersion: row.dek_version === null ? null : Number(row.dek_version),
  }
}

export function assertCliTokenRewrapped(cliAuth: CliAuthResult): void {
  if (cliAuth.wrappedDek === null || cliAuth.dekVersion === null) {
    log.info('cli.auth.reject', {
      reason: 'token_rewrap_required',
      tokenId: cliAuth.tokenId,
      orgId: cliAuth.orgId,
    })
    throw new Response(
      JSON.stringify({
        error:
          'Your API token was invalidated by a key rotation. Generate a new one.',
        code: 'TOKEN_REWRAP_REQUIRED',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export function forbidden(message: string): never {
  throw new Response(JSON.stringify({ error: message, code: 'FORBIDDEN' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function notFound(message: string): never {
  throw new Response(JSON.stringify({ error: message, code: 'NOT_FOUND' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function badRequest(message: string): never {
  throw new Response(JSON.stringify({ error: message, code: 'BAD_REQUEST' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}
