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
import {
  elevateOrg,
  revokeManualElevation,
  OrgNotFoundError,
} from '../src/lib/billing/manual-elevation'

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
  if (revoke) {
    const result = await revokeManualElevation({ target, pool })
    console.log(
      `Target: ${result.orgName} (${result.orgSlug}) [${result.orgId}]`,
    )
    console.log(`Revoked ${result.revoked} manually-granted subscription row(s).`)
    process.exit(0)
  }

  const result = await elevateOrg({ target, months, pool })
  console.log(`Target: ${result.orgName} (${result.orgSlug}) [${result.orgId}]`)
  if (result.action === 'extended') {
    console.log(
      `Extended existing manual subscription until ${result.periodEnd.toISOString()}.`,
    )
  } else {
    console.log(
      `Granted Team access until ${result.periodEnd.toISOString()}.`,
    )
  }
} catch (err) {
  if (err instanceof OrgNotFoundError) {
    console.error(err.message)
    process.exit(1)
  }
  throw err
} finally {
  await pool.end()
}
