import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const { email, password, username } = JSON.parse(event.body || "{}");

    // Field presence validation
    if (!email || !password || !username) {
      return {
        statusCode: 400,
        body: "Missing required fields",
      };
    }

    // Basic password rules (Supabase enforces ≥6 chars)
    if (password.length < 6) {
      return {
        statusCode: 400,
        body: "Password must be at least 6 characters long",
      };
    }

    // 1. Create the auth user with Supabase Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { username },
      email_confirm: true,
    });

    if (authError) {
      return {
        statusCode: 400,
        body: authError.message,
      };
    }

    // 2. Add corresponding row in public.profiles so the user shows up
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: authData?.user?.id,
        username,
      });

    if (profileError) {
      return {
        statusCode: 400,
        body: profileError.message,
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user: authData.user }),
    };
  } catch (err) {
    console.error("Unexpected error in createUser function:", err);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};
