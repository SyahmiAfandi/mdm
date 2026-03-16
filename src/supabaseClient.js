import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
export const supabaseBrowserKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

export const isSupabaseSecretKey =
  supabaseBrowserKey.startsWith('sb_secret_') ||
  /service[-_]?role/i.test(supabaseBrowserKey)

if (!supabaseUrl || !supabaseBrowserKey) {
  console.warn('Supabase URL or browser key is missing in .env')
} else if (isSupabaseSecretKey) {
  console.error(
    'Frontend Supabase config is using a secret/service key. Replace it with VITE_SUPABASE_PUBLISHABLE_KEY or the public anon key.'
  )
}

export function assertSupabaseBrowserConfig() {
  if (!supabaseUrl || !supabaseBrowserKey) {
    throw new Error('Missing Supabase frontend config. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).')
  }

  if (isSupabaseSecretKey) {
    throw new Error('Frontend Supabase key is a secret/service key. Replace it with the project publishable or anon key in frontend/.env.')
  }

  return { url: supabaseUrl, key: supabaseBrowserKey }
}

export const supabase = createClient(supabaseUrl, supabaseBrowserKey)

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
