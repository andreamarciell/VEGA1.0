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
      .from('admin_users' as any)
      .select('id, password_hash')
      .eq('nickname', 'andreadmin')
      .single();

    if (existingAdmin && (existingAdmin as any).password_hash === 'placeholder_will_be_updated_by_app') {
      // Update with proper hashed password
      const hashedPassword = await hashPassword('administratorSi768_?');
      await supabase
        .from('admin_users' as any)
        .update({ password_hash: hashedPassword })
        .eq('nickname', 'andreadmin');
    } else if (!existingAdmin) {
      // Create new admin user
      const hashedPassword = await hashPassword('administratorSi768_?');
      await supabase
        .from('admin_users' as any)
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
    console.log('🔍 AdminLogin: Starting authentication for nickname:', nickname);
    
    const { data: adminUser, error } = await supabase
      .from('admin_users' as any)
      .select('*')
      .eq('nickname', nickname)
      .single();

    if (error || !adminUser) {
      console.log('❌ AdminLogin: User not found or error:', error);
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }

    console.log('✅ AdminLogin: User found:', adminUser);
    const adminUserData = adminUser as any;
    
    console.log('🔐 AdminLogin: Verifying password...');
    const isPasswordValid = await verifyPassword(password, adminUserData.password_hash);
    if (!isPasswordValid) {
      console.log('❌ AdminLogin: Password verification failed');
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }
    
    console.log('✅ AdminLogin: Password verified successfully');

    // Create session
    console.log('🔑 AdminLogin: Creating session...');
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
    
    console.log('📊 AdminLogin: Session details:', { sessionToken, expiresAt });

    // Create new admin session in DB
    console.log('💾 AdminLogin: Saving session to database...');
    const { error: insertErr } = await supabase
      .from('admin_sessions' as any)
      .insert({
        admin_user_id: adminUserData.id,
        session_token: sessionToken,
        expires_at: expiresAt
      });

    if (insertErr) {
      console.error('❌ AdminLogin: Failed to create admin session:', insertErr);
      return { admin: null, sessionToken: null, error: 'Failed to create session' };
    }
    
    console.log('✅ AdminLogin: Session saved to database');

    // Update last login
    console.log('🔄 AdminLogin: Updating last login...');
    const { error: updateErr } = await supabase
      .from('admin_users' as any)
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUserData.id);

    if (updateErr) {
      console.warn('⚠️ AdminLogin: Could not update last_login:', updateErr);
    } else {
      console.log('✅ AdminLogin: Last login updated');
    }

    // Store session in localStorage for consistency
    console.log('💾 AdminLogin: Storing session token in localStorage...');
    localStorage.setItem('admin_session_token', sessionToken);
    console.log('✅ AdminLogin: Session token stored in localStorage');

    const adminData = {
      id: adminUserData.id,
      nickname: adminUserData.nickname,
      created_at: adminUserData.created_at,
      updated_at: adminUserData.updated_at,
      last_login: adminUserData.last_login
    };
    
    console.log('🎯 AdminLogin: Returning admin data:', adminData);
    return {
      admin: adminData,
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
    console.log('🔍 checkAdminSession: Starting session check...');
    const sessionToken = localStorage.getItem('admin_session_token');
    console.log('🔑 checkAdminSession: Session token from localStorage:', sessionToken ? 'FOUND' : 'NOT FOUND');
    
    if (!sessionToken) {
      console.log('❌ checkAdminSession: No session token found');
      return null;
    }

    console.log('🔍 checkAdminSession: Querying database for session...');
    const { data: session, error } = await supabase
      .from('admin_sessions' as any)
      .select(`
        *,
        admin_users (*)
      `)
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    console.log('📊 checkAdminSession: Database query result:', { session, error });

    if (error || !session) {
      console.log('❌ checkAdminSession: Session not found or error:', error);
      localStorage.removeItem('admin_session_token');
      return null;
    }

    console.log('✅ checkAdminSession: Session found, admin user:', (session as any).admin_users);
    return (session as any).admin_users as AdminUser;
  } catch (error) {
    console.error('💥 checkAdminSession: Unexpected error:', error);
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
        .from('admin_sessions' as any)
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