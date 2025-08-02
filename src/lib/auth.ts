
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);

/**
 * Effettua il login usando username + password.
 * All’atto pratico l’username viene tradotto nell’e‑mail sintetica
 * `username@example.com` usata al momento della creazione.
 */
export async function loginWithCredentials(username: string, password: string) {
  const email = \`\${username}@example.com\`;

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
