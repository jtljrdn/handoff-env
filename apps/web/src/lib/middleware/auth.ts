import { createHash } from 'node:crypto'
import { createMiddleware } from '@tanstack/react-start'
import { db } from '#/db'
import { apiTokens } from '#/db/schema'
import { auth } from '#/lib/auth'
import { eq, sql } from 'drizzle-orm'

export interface AuthenticatedUser {
  userId: string
  email: string
}

export interface CliAuthResult {
  userId: string
  orgId: string
}

export const authMiddleware = createMiddleware().server(
  async ({ next, context }) => {
    const request = (context as unknown as { request?: Request }).request
    if (!request) {
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
      throw new Response(
        JSON.stringify({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      )
    }

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

export async function requireCliAuth(
  request: Request,
): Promise<CliAuthResult> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Response(
      JSON.stringify({ error: 'Bearer token required', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const token = authHeader.slice(7)
  if (!token.startsWith('hnd_')) {
    throw new Response(
      JSON.stringify({ error: 'Invalid token format', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const hashedToken = createHash('sha256').update(token).digest('hex')
  const row = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.hashedToken, hashedToken))
    .limit(1)
    .then((rows) => rows[0])

  if (!row) {
    throw new Response(
      JSON.stringify({ error: 'Invalid token', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    throw new Response(
      JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`now()` })
    .where(eq(apiTokens.id, row.id))

  return {
    userId: row.userId,
    orgId: row.orgId,
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
