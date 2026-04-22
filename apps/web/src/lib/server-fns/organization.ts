import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import Stripe from 'stripe'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { pool } from '#/db/pool'
import { supabase } from '#/db'
import { auth } from '#/lib/auth'
import {
  requireOrgSession,
  requirePermission,
  badRequest,
  forbidden,
  notFound,
} from '#/lib/middleware/auth'
import { getOrgPlan, getOrgUsage } from '#/lib/billing/entitlements'
import { FREE_LIMITS, TEAM_INCLUDED_SEATS, TEAM_LIMITS } from '#/lib/billing/plans'
import { syncStripeCustomerContact } from '#/lib/billing/stripe-customer'
import {
  orgNameSchema,
  orgRoleSchema,
  type OrgRole,
} from '@handoff-env/types'

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)

const LOGO_BUCKET = 'org-logos'
const MAX_LOGO_BYTES = 1_048_576
const ALLOWED_LOGO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

type MemberRow = {
  id: string
  userId: string
  role: OrgRole
  createdAt: string
  name: string | null
  email: string
  image: string | null
}

type InvitationRow = {
  id: string
  email: string
  role: OrgRole
  status: string
  expiresAt: string
  inviterEmail: string | null
}

async function getMemberRole(userId: string, orgId: string): Promise<OrgRole> {
  const res = await pool.query(
    'SELECT role FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
    [userId, orgId],
  )
  if (res.rows.length === 0) forbidden('Not a member of this organization')
  return res.rows[0].role as OrgRole
}

async function countOwners(orgId: string): Promise<number> {
  const res = await pool.query(
    `SELECT count(*)::int AS n FROM member WHERE "organizationId" = $1 AND role = 'owner'`,
    [orgId],
  )
  return res.rows[0]?.n ?? 0
}

async function loadMember(
  memberId: string,
  orgId: string,
): Promise<{ id: string; userId: string; role: OrgRole } | null> {
  const res = await pool.query(
    'SELECT id, "userId", role FROM member WHERE id = $1 AND "organizationId" = $2 LIMIT 1',
    [memberId, orgId],
  )
  const row = res.rows[0]
  if (!row) return null
  return { id: row.id, userId: row.userId, role: row.role as OrgRole }
}

export const getOrgSettingsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const user = await requirePermission('organization', 'update')
    const request = getRequest()

    const fullOrg = await auth.api.getFullOrganization({
      headers: request.headers,
      query: { organizationId: user.orgId },
    })
    if (!fullOrg) notFound('Organization not found')

    const memberRows = await pool.query(
      `SELECT m.id, m."userId", m.role, m."createdAt",
              u.name, u.email, u.image
       FROM member m
       JOIN "user" u ON u.id = m."userId"
       WHERE m."organizationId" = $1
       ORDER BY
         CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
         m."createdAt" ASC`,
      [user.orgId],
    )
    const members: MemberRow[] = memberRows.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      role: row.role,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      name: row.name ?? null,
      email: row.email,
      image: row.image ?? null,
    }))

    const invitationRows = await pool.query(
      `SELECT i.id, i.email, i.role, i.status, i."expiresAt",
              u.email AS inviter_email
       FROM invitation i
       LEFT JOIN "user" u ON u.id = i."inviterId"
       WHERE i."organizationId" = $1 AND i.status = 'pending'
       ORDER BY i."expiresAt" DESC`,
      [user.orgId],
    )
    const invitations: InvitationRow[] = invitationRows.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      expiresAt:
        row.expiresAt instanceof Date
          ? row.expiresAt.toISOString()
          : String(row.expiresAt),
      inviterEmail: row.inviter_email ?? null,
    }))

    const plan = await getOrgPlan(user.orgId)
    const usage = await getOrgUsage(user.orgId)
    const currentUserRole = await getMemberRole(user.userId, user.orgId)

    return {
      org: {
        id: fullOrg.id,
        name: fullOrg.name,
        logo: fullOrg.logo ?? null,
      },
      members,
      invitations,
      plan,
      limits: plan === 'team' ? TEAM_LIMITS : FREE_LIMITS,
      includedSeats: TEAM_INCLUDED_SEATS,
      usage,
      currentUserId: user.userId,
      currentUserRole,
    }
  },
)

export const updateOrgDetailsFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { name: string }) => {
    z.object({ name: orgNameSchema }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('organization', 'update')
    const request = getRequest()

    const updated = await auth.api.updateOrganization({
      headers: request.headers,
      body: {
        organizationId: user.orgId,
        data: { name: data.name },
      },
    })
    return { org: updated }
  })

export const uploadOrgLogoFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { dataUrl: string; mimeType: string; sizeBytes: number }) => {
      z.object({
        dataUrl: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
      }).parse(input)
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requirePermission('organization', 'update')
    const request = getRequest()

    if (!ALLOWED_LOGO_TYPES.has(data.mimeType)) {
      badRequest('Unsupported image type. Use PNG, JPG, WebP, or SVG.')
    }
    if (data.sizeBytes > MAX_LOGO_BYTES) {
      badRequest('Logo must be 1 MB or smaller.')
    }

    const match = data.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match || match[1] !== data.mimeType) {
      badRequest('Invalid image data.')
    }
    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.byteLength > MAX_LOGO_BYTES) {
      badRequest('Logo must be 1 MB or smaller.')
    }

    const ext = MIME_TO_EXT[data.mimeType] ?? 'bin'
    const objectPath = `${user.orgId}/${nanoid()}.${ext}`

    const existing = await supabase.storage.from(LOGO_BUCKET).list(user.orgId)
    if (existing.data && existing.data.length > 0) {
      const toRemove = existing.data.map(
        (entry) => `${user.orgId}/${entry.name}`,
      )
      await supabase.storage.from(LOGO_BUCKET).remove(toRemove)
    }

    const upload = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(objectPath, buffer, {
        contentType: data.mimeType,
        upsert: true,
        cacheControl: '3600',
      })
    if (upload.error) throw upload.error

    const { data: publicData } = supabase.storage
      .from(LOGO_BUCKET)
      .getPublicUrl(objectPath)
    const logoUrl = publicData.publicUrl

    await auth.api.updateOrganization({
      headers: request.headers,
      body: { organizationId: user.orgId, data: { logo: logoUrl } },
    })

    return { logoUrl }
  })

export const removeOrgLogoFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const user = await requirePermission('organization', 'update')
    const request = getRequest()

    const existing = await supabase.storage.from(LOGO_BUCKET).list(user.orgId)
    if (existing.data && existing.data.length > 0) {
      const toRemove = existing.data.map(
        (entry) => `${user.orgId}/${entry.name}`,
      )
      await supabase.storage.from(LOGO_BUCKET).remove(toRemove)
    }

    await auth.api.updateOrganization({
      headers: request.headers,
      body: { organizationId: user.orgId, data: { logo: '' } },
    })

    return { ok: true as const }
  },
)

export const updateMemberRoleFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { memberId: string; role: OrgRole }) => {
    z.object({
      memberId: z.string().min(1),
      role: orgRoleSchema,
    }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('member', 'update')
    const request = getRequest()

    const callerRole = await getMemberRole(user.userId, user.orgId)
    const target = await loadMember(data.memberId, user.orgId)
    if (!target) notFound('Member not found')

    if (target.role === 'owner' && callerRole !== 'owner') {
      forbidden('Only an owner can change an owner’s role.')
    }
    if (data.role === 'owner' && callerRole !== 'owner') {
      forbidden('Only an owner can promote a member to owner.')
    }
    if (target.userId === user.userId) {
      badRequest(
        'You cannot change your own role. Ask another owner or transfer ownership first.',
      )
    }

    await auth.api.updateMemberRole({
      headers: request.headers,
      body: {
        organizationId: user.orgId,
        memberId: data.memberId,
        role: data.role,
      },
    })
    return { ok: true as const }
  })

export const removeMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((input: { memberId: string }) => {
    z.object({ memberId: z.string().min(1) }).parse(input)
    return input
  })
  .handler(async ({ data }) => {
    const user = await requirePermission('member', 'delete')
    const request = getRequest()

    const callerRole = await getMemberRole(user.userId, user.orgId)
    const target = await loadMember(data.memberId, user.orgId)
    if (!target) notFound('Member not found')

    if (target.userId === user.userId) {
      badRequest('Use "Leave organization" to remove yourself.')
    }
    if (target.role === 'owner' && callerRole !== 'owner') {
      forbidden('Only an owner can remove another owner.')
    }
    if (target.role === 'owner') {
      const ownerCount = await countOwners(user.orgId)
      if (ownerCount <= 1) {
        badRequest(
          'Cannot remove the last owner. Transfer ownership first.',
        )
      }
    }

    await auth.api.removeMember({
      headers: request.headers,
      body: {
        organizationId: user.orgId,
        memberIdOrEmail: data.memberId,
      },
    })
    return { ok: true as const }
  })

export const leaveOrgFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const user = await requireOrgSession()
    const request = getRequest()

    const role = await getMemberRole(user.userId, user.orgId)
    if (role === 'owner') {
      const ownerCount = await countOwners(user.orgId)
      if (ownerCount <= 1) {
        badRequest(
          'You are the only owner. Transfer ownership before leaving, or delete the organization.',
        )
      }
    }

    await auth.api.leaveOrganization({
      headers: request.headers,
      body: { organizationId: user.orgId },
    })
    return { ok: true as const }
  },
)

const TRANSFER_CONFIRMATION_PHRASE = 'transfer ownership'
const DELETE_CONFIRMATION_PHRASE = 'delete organization'

export const transferOwnershipFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: {
      memberId: string
      confirmationName: string
      confirmationPhrase: string
    }) => {
      z.object({
        memberId: z.string().min(1),
        confirmationName: z.string().min(1),
        confirmationPhrase: z.string().min(1),
      }).parse(input)
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requirePermission('organization', 'delete')
    const request = getRequest()

    const orgRes = await pool.query(
      'SELECT name FROM organization WHERE id = $1 LIMIT 1',
      [user.orgId],
    )
    const orgName = orgRes.rows[0]?.name as string | undefined
    if (!orgName) notFound('Organization not found')
    if (data.confirmationName !== orgName) {
      badRequest('Confirmation name does not match the organization.')
    }
    if (
      data.confirmationPhrase.trim().toLowerCase() !==
      TRANSFER_CONFIRMATION_PHRASE
    ) {
      badRequest(`Type "${TRANSFER_CONFIRMATION_PHRASE}" to confirm.`)
    }

    const target = await loadMember(data.memberId, user.orgId)
    if (!target) notFound('Target member not found')
    if (target.userId === user.userId) {
      badRequest('You cannot transfer ownership to yourself.')
    }

    const callerMemberRes = await pool.query(
      'SELECT id FROM member WHERE "userId" = $1 AND "organizationId" = $2 LIMIT 1',
      [user.userId, user.orgId],
    )
    const callerMemberId = callerMemberRes.rows[0]?.id as string | undefined
    if (!callerMemberId) forbidden('Caller is not a member of this org.')

    await auth.api.updateMemberRole({
      headers: request.headers,
      body: {
        organizationId: user.orgId,
        memberId: data.memberId,
        role: 'owner',
      },
    })

    try {
      await auth.api.updateMemberRole({
        headers: request.headers,
        body: {
          organizationId: user.orgId,
          memberId: callerMemberId,
          role: 'admin',
        },
      })
    } catch (err) {
      // Revert the promotion so the org doesn't end up with two owners when
      // the caller wanted a clean handover.
      try {
        await auth.api.updateMemberRole({
          headers: request.headers,
          body: {
            organizationId: user.orgId,
            memberId: data.memberId,
            role: target.role,
          },
        })
      } catch (revertErr) {
        console.error(
          '[Handoff] transferOwnership revert failed:',
          revertErr,
        )
      }
      throw err
    }

    // Auth transfer committed. Push the new owner's email onto the Stripe
    // customer so receipts and dunning mail stop going to the previous owner.
    // Best-effort: syncStripeCustomerContact swallows and logs Stripe errors.
    await syncStripeCustomerContact(user.orgId)

    return { ok: true as const }
  })

export const deleteOrganizationFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (input: { confirmationName: string; confirmationPhrase: string }) => {
      z.object({
        confirmationName: z.string().min(1),
        confirmationPhrase: z.string().min(1),
      }).parse(input)
      return input
    },
  )
  .handler(async ({ data }) => {
    const user = await requirePermission('organization', 'delete')
    const request = getRequest()

    const orgRes = await pool.query(
      'SELECT name FROM organization WHERE id = $1 LIMIT 1',
      [user.orgId],
    )
    const orgName = orgRes.rows[0]?.name as string | undefined
    if (!orgName) notFound('Organization not found')
    if (data.confirmationName !== orgName) {
      badRequest('Confirmation name does not match the organization.')
    }
    if (
      data.confirmationPhrase.trim().toLowerCase() !==
      DELETE_CONFIRMATION_PHRASE
    ) {
      badRequest(`Type "${DELETE_CONFIRMATION_PHRASE}" to confirm.`)
    }

    const subRes = await pool.query(
      `SELECT "stripeSubscriptionId" FROM subscription
       WHERE "referenceId" = $1 AND "stripeSubscriptionId" IS NOT NULL`,
      [user.orgId],
    )
    for (const row of subRes.rows) {
      const subId = row.stripeSubscriptionId as string | null
      if (!subId) continue
      try {
        await stripeClient.subscriptions.cancel(subId)
      } catch (err) {
        console.error(
          `[Handoff] cancel stripe subscription ${subId} failed:`,
          err,
        )
      }
    }

    const existingLogos = await supabase.storage
      .from(LOGO_BUCKET)
      .list(user.orgId)
    if (existingLogos.data && existingLogos.data.length > 0) {
      const toRemove = existingLogos.data.map(
        (entry) => `${user.orgId}/${entry.name}`,
      )
      await supabase.storage.from(LOGO_BUCKET).remove(toRemove)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM subscription WHERE "referenceId" = $1', [
        user.orgId,
      ])
      await client.query('DELETE FROM api_tokens WHERE org_id = $1', [
        user.orgId,
      ])
      await client.query('DELETE FROM org_encryption_keys WHERE org_id = $1', [
        user.orgId,
      ])
      await client.query('DELETE FROM projects WHERE org_id = $1', [
        user.orgId,
      ])
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    await auth.api.deleteOrganization({
      headers: request.headers,
      body: { organizationId: user.orgId },
    })

    const remaining = await auth.api.listOrganizations({
      headers: request.headers,
    })
    const nextOrgId = Array.isArray(remaining) && remaining[0]?.id
    if (nextOrgId) {
      await auth.api.setActiveOrganization({
        headers: request.headers,
        body: { organizationId: nextOrgId },
      })
    }

    return { ok: true as const, nextOrgId: nextOrgId || null }
  })
