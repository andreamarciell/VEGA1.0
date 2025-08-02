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

// Generate secure session token
const generateSessionToken = (): string => {
  return crypto.getRandomValues(new Uint32Array(4)).join('-');
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
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id, password_hash')
      .eq('nickname', 'andreadmin')
      .single();

    if (existingAdmin && existingAdmin.password_hash === 'placeholder_will_be_updated_by_app') {
      // Update with proper hashed password
      const hashedPassword = await hashPassword('administratorSi768_?');
      await supabase
        .from('admin_users')
        .update({ password_hash: hashedPassword })
        .eq('nickname', 'andreadmin');
    } else if (!existingAdmin) {
      // Create new admin user
      const hashedPassword = await hashPassword('administratorSi768_?');
      await supabase
        .from('admin_users')
        .insert({
          nickname: 'andreadmin',
          password_hash: hashedPassword
        });
    }
  } catch (error) {
    console.error('Error initializing default admin:', error);
  }
};

// Admin login
export const adminLogin = async (nickname: string, password: string): Promise<{
  admin: AdminUser | null;
  sessionToken: string | null;
  error: string | null;
}> => {
  try {
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('nickname', nickname)
      .single();

    if (error || !adminUser) {
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }

    const isPasswordValid = await verifyPassword(password, adminUser.password_hash);
    if (!isPasswordValid) {
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }

    // Create session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();

    await supabase
      .from('admin_sessions')
      .insert({
        admin_user_id: adminUser.id,
        session_token: sessionToken,
        expires_at: expiresAt
      });

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUser.id);

    // Store session in localStorage
    localStorage.setItem('admin_session_token', sessionToken);

    return {
      admin: {
        id: adminUser.id,
        nickname: adminUser.nickname,
        created_at: adminUser.created_at,
        updated_at: adminUser.updated_at,
        last_login: adminUser.last_login
      },
      sessionToken,
      error: null
    };
  } catch (error) {
    console.error('Admin login error:', error);
    return { admin: null, sessionToken: null, error: 'Login failed' };
  }
};

// Check admin session
export const checkAdminSession = async (): Promise<AdminUser | null> => {
  try {
    const sessionToken = localStorage.getItem('admin_session_token');
    if (!sessionToken) return null;

    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select(`
        *,
        admin_users (*)
      `)
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session) {
      localStorage.removeItem('admin_session_token');
      return null;
    }

    return session.admin_users as AdminUser;
  } catch (error) {
    console.error('Session check error:', error);
    localStorage.removeItem('admin_session_token');
    return null;
  }
};

// Admin logout
export const adminLogout = async (): Promise<void> => {
  try {
    const sessionToken = localStorage.getItem('admin_session_token');
    if (sessionToken) {
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('session_token', sessionToken);
    }
    localStorage.removeItem('admin_session_token');
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
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        user_id
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Create new user
export const createUser = async (email: string, password: string, username: string) => {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { username },
      email_confirm: true
    });

    if (error) throw error;
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