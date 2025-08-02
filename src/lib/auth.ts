import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
}


/** Alias utile nei componenti React */
export type AuthSession = Session;

export interface LoginCredentials { username: string; password: string; }

// ---------- Auth helpers ----------

export async function loginWithCredentials(credentials: LoginCredentials) {
  const { username, password } = credentials;
  const email = `${username}@example.com`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  const session = data.session;
  const user = data.user;
  const displayName =
    (user?.user_metadata as { username?: string })?.username || username;

  return { user, session, error: null };
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

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  return data.user;
}