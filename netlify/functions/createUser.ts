// netlify/functions/createUser.ts
import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!event.body) {
    return { statusCode: 400, body: 'Missing request body' };
  }

  try {
    const data = JSON.parse(event.body);

    // Accept various possible field names coming from the React form
    let username: string = (data.username || data.name || '').trim();
    const emailFromClient: string | undefined = (data.email || '').trim();
    const password: string = (data.password || data.pass || data.plaintextPassword || '').trim();

    // If only e‑mail was supplied, derive username from it
    if (!username && emailFromClient) {
      username = emailFromClient.split('@')[0];
    }

    if (!username || !password) {
      return { statusCode: 400, body: 'Missing username or password' };
    }

    // Internal e‑mail used for Supabase Auth (the login form will re‑derive this)
    const internalEmail = `${username}@secure.local`;

    // Create user with Admin privileges (mirror of seeded demo user)
    const { data: createdUser, error } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username
      }
    });

    if (error) {
      console.error('Supabase Admin error:', error);
      return { statusCode: 400, body: error.message };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ id: createdUser.user?.id, username })
    };
  } catch (err: any) {
    console.error('createUser function exception:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};