import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/types/database'

export const createClient = () => {
  return createClientComponentClient<Database>()
}

export const supabase = createClientComponentClient<Database>()

export type { Database }
