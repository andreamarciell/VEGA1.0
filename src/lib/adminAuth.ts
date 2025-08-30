import { supabase } from "@/integrations/supabase/client";
import bcrypt from 'bcryptjs';

export interface AdminUser {
  id: string;
  nickname: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface AdminSession {
  id: string;
  admin_user_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
}

const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours for admin sessions

// Generate secure session token with 256 bits of entropy
const generateSessionToken = (): string => {
  const array = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Hash password
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

// Initialize default admin user if not exists
export const initializeDefaultAdmin = async (): Promise<void> => {
  try {
    // Use raw SQL query since admin_users table is not in the main schema types
    const { data: existingAdmin } = await supabase
      .rpc('admin_check_user_exists', { username: 'andreadmin' });

    if (!existingAdmin) {
      // Only create admin if it doesn't exist - require manual password setting
      console.warn('No admin user found. Please create admin user manually through secure process.');
      // Do not create default admin with hardcoded password for security
      return;
    }

    // Note: Password updates should be done through secure admin interface only
    console.log('Admin user system ready. Use secure admin interface for password management.');
  } catch (error) {
    console.error('Error checking admin user:', error);
    // Silently fail - admin user can be created manually
  }
};

// Admin login with secure client-side password verification
export const adminLogin = async (nickname: string, password: string): Promise<{
  admin: AdminUser | null;
  sessionToken: string | null;
  error: string | null;
}> => {
  try {
    // First, get admin user info securely (without password)
    const { data: adminData, error: adminError } = await supabase
      .rpc('admin_get_user_for_auth', { admin_nickname: nickname });

    if (adminError || !adminData || !adminData.found) {
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }

    // Verify password on client side using bcrypt
    const isPasswordValid = await verifyPassword(password, adminData.password_hash);
    if (!isPasswordValid) {
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }

    // Create session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();

    // Store session using RPC function
    const { error: sessionError } = await supabase
      .rpc('admin_create_session', {
        admin_user_id: adminData.admin_id,
        session_token: sessionToken,
        expires_at: expiresAt
      });

    if (sessionError) {
      console.error('Failed to create admin session:', sessionError);
      return { admin: null, sessionToken: null, error: 'Failed to create session' };
    }

    // Store session in sessionStorage (more secure than localStorage)
    sessionStorage.setItem('admin_session_token', sessionToken);

    return {
      admin: {
        id: adminData.admin_id,
        nickname: adminData.nickname,
        created_at: adminData.created_at,
        updated_at: adminData.updated_at,
        last_login: adminData.last_login
      },
      sessionToken,
      error: null
    };
  } catch (error) {
    console.error('Admin login error:', error);
    return { admin: null, sessionToken: null, error: 'Login failed' };
  }
};

// Check admin session using RPC function
export const checkAdminSession = async (): Promise<AdminUser | null> => {
  try {
    const sessionToken = sessionStorage.getItem('admin_session_token');
    if (!sessionToken) return null;

    const { data: result, error } = await supabase
      .rpc('admin_check_session', { session_token: sessionToken });

    if (error || !result || !result.valid) {
      sessionStorage.removeItem('admin_session_token');
      return null;
    }

    return {
      id: result.admin_id,
      nickname: result.nickname,
      created_at: result.created_at,
      updated_at: result.updated_at,
      last_login: result.last_login
    };
  } catch (error) {
    console.error('Session check error:', error);
    sessionStorage.removeItem('admin_session_token');
    return null;
  }
};

// Admin logout using RPC function
export const adminLogout = async (): Promise<void> => {
  try {
    const sessionToken = sessionStorage.getItem('admin_session_token');
    if (sessionToken) {
      await supabase.rpc('admin_destroy_session', { session_token: sessionToken });
    }
    sessionStorage.removeItem('admin_session_token');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// Get user analytics
export const getUserAnalytics = async () => {
  try {
    const { data, error } = await supabase.rpc('get_user_analytics');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
};

// Get all users for management
export const getAllUsers = async () => {
  /*
   * Use a SECURITY DEFINER database function (`admin_get_profiles`) so we can
   * fetch all user profiles through RLS safely with the public anon key.
   * This avoids shipping the service‑role key to the client while allowing
   * the admin panel to list every registered user.
   */
  try {
    const { data, error } = await supabase.rpc('admin_get_profiles');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Create new user
export const createUser = async (email: string, username: string, password: string) => {
  try {
    const response = await fetch('/.netlify/functions/createUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to create user');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Update user nickname
export const updateUserNickname = async (userId: string, newUsername: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating username:', error);
    throw error;
  }
};

// Update user password
export const updateUserPassword = async (userId: string, newPassword: string) => {
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};