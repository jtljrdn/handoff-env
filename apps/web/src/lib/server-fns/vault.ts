import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { auth } from '#/lib/auth'
import { pool } from '#/db/pool'
import { logger, errCtx } from '#/lib/logger'

const vaultLog = logger.child({ scope: 'vault' })

export type VaultStatus =
  | { initialized: false }
  | {
      initialized: true
      publicKey: string
      encryptedPrivateKey: string
      encPrivNonce: string
      kdfSalt: string
      kdfOpsLimit: number
      kdfMemLimit: number
    }

function bufToBase64(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64')
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (typeof value === 'string') return value
  throw new Error(`Cannot encode ${typeof value} as base64`)
}

export const getVaultStatusFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<VaultStatus> => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) return { initialized: false }

    const result = await pool.query(
      `SELECT public_key, encrypted_private_key, enc_priv_nonce,
              kdf_salt, kdf_ops_limit, kdf_mem_limit
         FROM user_vault
        WHERE user_id = $1
        LIMIT 1`,
      [session.user.id],
    )

    const row = result.rows[0]
    if (!row) return { initialized: false }

    return {
      initialized: true,
      publicKey: bufToBase64(row.public_key),
      encryptedPrivateKey: bufToBase64(row.encrypted_private_key),
      encPrivNonce: bufToBase64(row.enc_priv_nonce),
      kdfSalt: bufToBase64(row.kdf_salt),
      kdfOpsLimit: Number(row.kdf_ops_limit),
      kdfMemLimit: Number(row.kdf_mem_limit),
    }
  },
)

const initVaultSchema = z.object({
  publicKey: z.string(),
  encryptedPrivateKey: z.string(),
  encPrivNonce: z.string(),
  kdfSalt: z.string(),
  kdfOpsLimit: z.number().int().positive(),
  kdfMemLimit: z.number().int().positive(),
  recoveryWrappedPrivateKey: z.string(),
  recoveryPrivNonce: z.string(),
})

export const initVaultFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => initVaultSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const existing = await pool.query(
      'SELECT user_id FROM user_vault WHERE user_id = $1 LIMIT 1',
      [session.user.id],
    )
    if (existing.rows[0]) {
      throw new Error('Vault already initialized')
    }

    try {
      await pool.query(
        `INSERT INTO user_vault (
           user_id, public_key, encrypted_private_key, enc_priv_nonce,
           kdf_salt, kdf_ops_limit, kdf_mem_limit,
           recovery_wrapped_private_key, recovery_priv_nonce
         ) VALUES (
           $1, decode($2,'base64'), decode($3,'base64'), decode($4,'base64'),
           decode($5,'base64'), $6, $7,
           decode($8,'base64'), decode($9,'base64')
         )`,
        [
          session.user.id,
          data.publicKey,
          data.encryptedPrivateKey,
          data.encPrivNonce,
          data.kdfSalt,
          data.kdfOpsLimit,
          data.kdfMemLimit,
          data.recoveryWrappedPrivateKey,
          data.recoveryPrivNonce,
        ],
      )
      vaultLog.info('vault.initialized', { userId: session.user.id })
      return { ok: true as const }
    } catch (err) {
      vaultLog.error(
        'vault.init_failed',
        errCtx(err, { userId: session.user.id }),
      )
      throw err
    }
  })

export const getRecoveryMaterialsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const result = await pool.query(
      `SELECT recovery_wrapped_private_key, recovery_priv_nonce, public_key
         FROM user_vault
        WHERE user_id = $1
        LIMIT 1`,
      [session.user.id],
    )

    const row = result.rows[0]
    if (!row) {
      throw new Error('No vault to recover')
    }

    return {
      recoveryWrappedPrivateKey: bufToBase64(row.recovery_wrapped_private_key),
      recoveryPrivNonce: bufToBase64(row.recovery_priv_nonce),
      publicKey: bufToBase64(row.public_key),
    }
  },
)

const resetPassphraseSchema = z.object({
  encryptedPrivateKey: z.string(),
  encPrivNonce: z.string(),
  kdfSalt: z.string(),
  kdfOpsLimit: z.number().int().positive(),
  kdfMemLimit: z.number().int().positive(),
})

export const resetPassphraseFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => resetPassphraseSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      throw new Error('Unauthorized')
    }

    const result = await pool.query(
      `UPDATE user_vault
          SET encrypted_private_key = decode($2, 'base64'),
              enc_priv_nonce        = decode($3, 'base64'),
              kdf_salt              = decode($4, 'base64'),
              kdf_ops_limit         = $5,
              kdf_mem_limit         = $6,
              passphrase_updated_at = now()
        WHERE user_id = $1`,
      [
        session.user.id,
        data.encryptedPrivateKey,
        data.encPrivNonce,
        data.kdfSalt,
        data.kdfOpsLimit,
        data.kdfMemLimit,
      ],
    )

    if (result.rowCount === 0) {
      throw new Error('No vault to reset')
    }

    vaultLog.info('vault.passphrase_reset', { userId: session.user.id })
    return { ok: true as const }
  })
