
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client using service role
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * Serverless function:
 * - Expects POST with { username, password }
 * - Builds a synthetic e‑mail `username@example.com`
 * - Creates the auth user, storing the username in user_metadata
 */
export const handler: Handler = async (event, _context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { username, password } = JSON.parse(event.body || "{}");

    if (!username || !password) {
      return { statusCode: 400, body: "Missing username or password" };
    }

    // Supabase still needs a valid unique e‑mail
    const email = \`\${username}@example.com\`;

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (error || !data?.user) {
      console.error("Supabase createUser error:", error);
      return {
        statusCode: 400,
        body: error?.message || "Supabase createUser failed",
      };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err: any) {
    console.error("Unhandled createUser error:", err);
    return { statusCode: 500, body: "Internal server error" };
  }
};
