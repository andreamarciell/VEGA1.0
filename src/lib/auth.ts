import { createClient, Session } from "@supabase/supabase-js";

/**
 * Client lato browser – usa la chiave anonima.
 * Le variabili d'ambiente rimangono le stesse già presenti nel progetto.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

/**
 * Login con username + password.
 * L'username viene convertito nell'e‑mail sintetica `username@example.com`
 * creata al momento della registrazione (si evita di chiedere la mail reale).
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
 * Restituisce la sessione corrente se presente, altrimenti `null`.
 * È l'equivalente della vecchia `getCurrentSession` usata in varie pagine.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getCurrentSession error:", error);
    return null;
  }
  return data.session;
}

/** Logout dell'utente corrente */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Logout error:", error);
  }
}
