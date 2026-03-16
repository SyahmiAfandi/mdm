import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in .env')
} else {
  console.log('DEBUG Supabase URL:', supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Helper to handle Supabase Auth session persistence
 * Similar to your current Firebase observer
 */
export const observeAuth = (onAuthStateChange) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    onAuthStateChange(session?.user || null)
  })
  return () => subscription.unsubscribe()
}

/**
 * Example mapping for your collections
 * usage: const { data, error } = await supabase.from(TABLES.RECON_CELLS).select('*')
 */
export const TABLES = {
  USER_ROLES: 'user_roles',
  PROFILES: 'profiles',
  LICENSES: 'licenses',
  ROLE_PERMISSIONS: 'role_permissions',
  RECON_CELLS: 'recon_cells',
  EMAILS: 'emails',
  LOGIN_ATTEMPTS: 'login_attempts',
}
