import { createClient, Session, User } from "@supabase/supabase-js";

export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Browser-side Supabase client.
 * Requires the following Vite env variables:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *
 * The Service Role key must **never** be exposed to the client!
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing env vars: define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the build environment."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Sign-in helper used by the /auth/login page.
 * It converts the chosen username into the email address that we store in Supabase:
 *     <username>@secure.local
 *
 * Returns a triple { user, session, error } so that the UI can safely handle
 * both success and failure cases without throwing.
 */
export async function loginWithCredentials(
  credentials: LoginCredentials
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const { username, password } = credentials;
  const email = `${username}@secure.local`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  return {
    user: data.user,
    session: data.session,
    error: null,
  };
}