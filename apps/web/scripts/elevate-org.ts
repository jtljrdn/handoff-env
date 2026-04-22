#!/usr/bin/env bun
/**
 * Manually grant an organization Team-tier access without running Stripe.
 *
 * Usage:
 *   bun run scripts/elevate-org.ts <org-id-or-slug> [--months=12] [--revoke]
 *
 * Examples:
 *   bun run scripts/elevate-org.ts acme
 *   bun run scripts/elevate-org.ts org_abc123 --months=24
 *   bun run scripts/elevate-org.ts acme --revoke
 *
 * This writes directly to the `subscription` table. If a real Stripe
 * subscription later appears for the same org (via Checkout/webhooks), its
 * rows will coexist. On revoke, ONLY rows flagged as manually granted
 * (stripeCustomerId starts with 'manual_') are deleted; real Stripe rows
 * are untouched.
 */
import { Pool } from 'pg'
import { nanoid } from 'nanoid'

const args = process.argv.slice(2)
const positional = args.filter((a) => !a.startsWith('--'))
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=')
      return [k, v ?? 'true']
    }),
)

const target = positional[0]
if (!target) {
  console.error('Usage: bun run scripts/elevate-org.ts <org-id-or-slug> [--months=N] [--revoke]')
  process.exit(1)
}

const months = flags.months ? Number(flags.months) : 12
if (!Number.isFinite(months) || months <= 0) {
  console.error('--months must be a positive number')
  process.exit(1)
}

const revoke = flags.revoke === 'true'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

try {
  const orgRes = await pool.query(
    `SELECT id, name, slug FROM organization WHERE id = $1 OR slug = $1 LIMIT 1`,
    [target],
  )
  const org = orgRes.rows[0]
  if (!org) {
    console.error(`No organization found matching "${target}"`)
    process.exit(1)
  }

  console.log(`Target: ${org.name} (${org.slug}) [${org.id}]`)

  if (revoke) {
    const del = await pool.query(
      `DELETE FROM subscription
       WHERE "referenceId" = $1 AND "stripeCustomerId" LIKE 'manual_%'
       RETURNING id`,
      [org.id],
    )
    console.log(`Revoked ${del.rowCount} manually-granted subscription row(s).`)
    process.exit(0)
  }

  const existing = await pool.query(
    `SELECT id FROM subscription
     WHERE "referenceId" = $1 AND "stripeCustomerId" LIKE 'manual_%'
     LIMIT 1`,
    [org.id],
  )

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + months)

  if (existing.rows[0]) {
    await pool.query(
      `UPDATE subscription SET
         status = 'active',
         "periodStart" = $2,
         "periodEnd" = $3,
         "cancelAtPeriodEnd" = false,
         "canceledAt" = NULL,
         "endedAt" = NULL,
         plan = 'team',
         "billingInterval" = 'manual'
       WHERE id = $1`,
      [existing.rows[0].id, now.toISOString(), periodEnd.toISOString()],
    )
    console.log(
      `Extended existing manual subscription until ${periodEnd.toISOString()}.`,
    )
  } else {
    const subId = nanoid()
    await pool.query(
      `INSERT INTO subscription
         (id, plan, "referenceId", "stripeCustomerId", status,
          "periodStart", "periodEnd", seats, "billingInterval")
       VALUES ($1, 'team', $2, $3, 'active', $4, $5, NULL, 'manual')`,
      [
        subId,
        org.id,
        `manual_${org.id}`,
        now.toISOString(),
        periodEnd.toISOString(),
      ],
    )
    console.log(
      `Granted Team access until ${periodEnd.toISOString()} (subscription ${subId}).`,
    )
  }
} finally {
  await pool.end()
}
