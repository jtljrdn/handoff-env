import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
