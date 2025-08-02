// src/lib/auth.ts
import { supabase } from '@/integrations/supabase/client';

export interface LoginResult {
  user: any | null;
  session: any | null;
  error: string | null;
}

/**
 * Logs a user in, mapping the supplied username to the internal e‑mail scheme
 * "<username>@secure.local" used by Supabase Auth.
 */
export async function loginWithCredentials(username: string, password: string): Promise<LoginResult> {
  try {
    const email = `${username}@secure.local`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    console.error('Login error:', err);
    return { user: null, session: null, error: 'Unexpected error' };
  }
}

/**
 * Wrapper used throughout the app to obtain the current session.
 * Kept for backward‑compatibility with existing code — simply delegates
 * to `supabase.auth.getSession()` so the call‑site interface remains
 * identico all’implementazione originale.
 */
export async function getCurrentSession() {
  return supabase.auth.getSession();
}