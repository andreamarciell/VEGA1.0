// Secure Supabase client - only uses anon key
import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '@/lib/env'

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'toppery-web-app'
    }
  }
})

// Interceptor per gestire gli errori di connessione
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    // Cleanup quando l'utente si disconnette
    localStorage.removeItem('lockout_username')
    localStorage.removeItem('lockout_expiry')
    localStorage.removeItem('lockout_attempts')
  }
})

export default supabase