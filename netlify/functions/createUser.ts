
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const handler: Handler = async (event, _context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { username, password } = JSON.parse(event.body || "{}");

    if (!username || !password) {
      return { statusCode: 400, body: "Missing username or password" };
    }

    // Supabase still requires a valid, unique e‑mail.
    const email = `${username}@secure.local`;

    // 1. Crea l’utente nel sistema di auth
    const { data: userResponse, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (error || !userResponse?.user) {
      console.error("Supabase createUser error:", error);
      return { statusCode: 500, body: "Supabase createUser failed" };
    }

    // 2. Inserisci il profilo applicativo (tabella 'profiles')
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: userResponse.user.id, username });

    if (profileError) {
      console.error("Supabase profile insert error:", profileError);
      return { statusCode: 500, body: "Profile creation failed" };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("Unhandled createUser error:", err);
    return { statusCode: 500, body: "Internal server error" };
  }
};
