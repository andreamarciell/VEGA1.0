import { createClient, Session, User } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client (anon key).
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

/** Alias esportato per comodità di typing nelle pagine */
export type AuthSession = Session;

/**
 * Login con username + password.
 * L'username viene trasformato nell'e‑mail sintetica `username@example.com`
 * generata in fase di registrazione lato admin.
 */
export async function loginWithCredentials(
  username: string,
  password: string
) {
  const email = `${username}@example.com`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  const session = data.session;
  const user = data.user;
  const displayName =
    (user?.user_metadata as { username?: string })?.username || username;

  return { session, user, displayName };
}

/**
 * Ritorna la sessione corrente (o null se non autenticato)
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getCurrentSession error:", error);
    return null;
  }
  return data.session;
}

/**
 * Logout dell'utente corrente.
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Logout error:", error);
    throw new Error(error.message);
  }
}

/**
 * Aggiorna la password dell'utente autenticato.
 * Richiede che ci sia già una sessione valida.
 */
export async function updateUserPassword(
  newPassword: string
): Promise<User | null> {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}
