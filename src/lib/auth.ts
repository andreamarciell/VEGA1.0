// src/lib/auth.ts
import { supabase } from '@/integrations/supabase/client';

export interface LoginResult {
  user: any | null;
  session: any | null;
  error: string | null;
}

export interface AuthSession {
  user: any | null;
  session: any | null;
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
 * Retrieves the current session and user.
 */
export async function getCurrentSession(): Promise<AuthSession> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Get session error:', error);
      return { user: null, session: null };
    }
    return { user: data.user, session: data.session };
  } catch (err: any) {
    console.error('Get session exception:', err);
    return { user: null, session: null };
  }
}

/**
 * Signs the user out.
 */
export async function logout(): Promise<{ error: any }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Updates the current user's password.
 */
export async function updateUserPassword(newPassword: string): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  return { data, error };
}