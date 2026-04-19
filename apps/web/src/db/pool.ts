import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL ?? ''
const useSSL =
  /[?&]sslmode=(require|verify-ca|verify-full|no-verify)/.test(connectionString) ||
  /\bsupabase\.(co|com)\b/.test(connectionString) ||
  process.env.NODE_ENV === 'production'

export const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
})
