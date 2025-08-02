import { createClient, Session, User } from "@supabase/supabase-js";

/**
 * Client Supabase lato browser.
 * Sono OBBLIGATORIE le variabili:
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *
 * La Service Role Key NON deve mai arrivare nel bundle pubblico perché concede
 * privilegi amministrativi e, in più, fa credere all'app di essere già
 * autenticata (saltando la schermata di login).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing env vars: define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify build environment."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Alias utile nei componenti React */
export type AuthSession = Session;

// ---------- Auth helpers ----------

export async function loginWithCredentials(
  username: string,
  password: string
) {
  const email = `${username}@example.com`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);

  const session = data.session;
  const user = data.user;
  const displayName =
    (user?.user_metadata as { username?: string })?.username || username;

  return { session, user, displayName };
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getCurrentSession error:", error);
    return null;
  }
  return data.session;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Logout error:", error);
    throw new Error(error.message);
  }
}

export async function updateUserPassword(
  newPassword: string
): Promise<User | null> {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw new Error(error.message);

  return data.user;
}
