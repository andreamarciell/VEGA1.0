import { supabase } from './supabaseClient';

export interface LoginResult {
  user: any | null;
  session: any | null;
  error: string | null;
}

export async function loginWithCredentials(username: string, password: string): Promise<LoginResult> {
  try {
    const email = `${username}@secure.local`;

    // Supabase v2 returns { data: { user, session }, error }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        user: null,
        session: null,
        error: error?.message || 'Invalid username or password',
      };
    }

    return {
      user: data?.user ?? null,
      session: data?.session ?? null,
      error: null,
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return { user: null, session: null, error: 'An unexpected error occurred' };
  }
}
