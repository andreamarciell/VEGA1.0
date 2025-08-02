
import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// Supabase client with service role
const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * POST /.netlify/functions/createUser
 * Body: { username: string, password: string }
 *
 * This endpoint is called by the AdminUserManagement panel to provision
 * a new application user.  We intentionally **do not** accept an e‑mail
 * address from the UI: for consistency with the seeded demo account we
 * instead derive an internal login e‑mail of the form
 *
 *    ${username}@secure.local
 *
 * The e‑mail never leaves Supabase and does not need to be deliverable.
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

    // Internal login e‑mail used by the auth flow
    const email = `${username}@secure.local`;

    // Create the user through the Admin API so that the account is
    // immediately confirmed and ready for login.
    const { data: user, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (error) {
      console.error("Supabase createUser error:", error);
      return {
        statusCode: 400,
        body: error.message || "Supabase createUser failed",
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, user }),
    };
  } catch (err: any) {
    console.error("Unhandled createUser error:", err);
    return { statusCode: 500, body: "Internal server error" };
  }
};
