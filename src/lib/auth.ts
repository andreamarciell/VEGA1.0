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
 * This is the same rule applied to the seeded demo user and to every account
 * created via the Admin dashboard.
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