import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
