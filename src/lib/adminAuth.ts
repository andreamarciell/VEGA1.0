// src/lib/adminAuth.ts

import { supabase } from '@/integrations/supabase/client';
import type { LoginResult } from '@/lib/auth';

/**
 * Logs in an admin user by mapping username to internal email and using Supabase Auth.
 */
export async function adminLogin(username: string, password: string): Promise<LoginResult> {
  const email = `${username}@secure.local`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { user: null, session: null, error: error.message };
  }
  return { user: data.user, session: data.session, error: null };
}

/**
 * Checks if an admin session exists.
 */
export async function checkAdminSession(): Promise<{ user: any | null; session: any | null }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('checkAdminSession error:', error);
    return { user: null, session: null };
  }
  return { user: data.user, session: data.session };
}

/**
 * Initializes the default admin user (seed) if not present.
 */
export async function initializeDefaultAdmin(): Promise<void> {
  const res = await fetch('/.netlify/functions/initializeDefaultAdmin', { method: 'POST' });
  if (!res.ok) {
    console.warn('initializeDefaultAdmin failed:', await res.text());
  }
}

/**
 * Creates a new user via Netlify Functions.
 */
export async function createUserRemote(payload: {
  username?: string;
  name?: string;
  email?: string;
  password: string;
}) {
  const body = {
    username: payload.username?.trim(),
    name: payload.name?.trim(),
    email: payload.email?.trim(),
    password: payload.password.trim(),
  };

  const res = await fetch('/.netlify/functions/createUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Unknown error creating user');
  }

  return res.json();
}

/**
 * Fetches user analytics data via Netlify Functions.
 */
export async function getUserAnalytics(): Promise<any> {
  const res = await fetch('/.netlify/functions/getUserAnalytics');
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}