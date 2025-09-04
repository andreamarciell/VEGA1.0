import { supabase } from "@/integrations/supabase/client";
import bcrypt from 'bcryptjs';
import { logger } from './logger';

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

// Initialize default admin user if not exists - using environment variables
export const initializeDefaultAdmin = async (): Promise<void> => {
  try {
    logger.info('Checking admin user initialization');
    
    const { data: existingAdmin } = await supabase
      .from('admin_users' as any)
      .select('id, password_hash')
      .eq('nickname', 'andreadmin')
      .single();

    if (existingAdmin && (existingAdmin as any).password_hash === 'placeholder_will_be_updated_by_app') {
      // Update with password from environment
      const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || process.env.VITE_ADMIN_DEFAULT_PASSWORD;
      
      if (!adminPassword) {
        logger.warn('ADMIN_DEFAULT_PASSWORD not set. Admin user not initialized with secure password.');
        return;
      }
      
      const hashedPassword = await hashPassword(adminPassword);
      await supabase
        .from('admin_users' as any)
        .update({ password_hash: hashedPassword })
        .eq('nickname', 'andreadmin');
        
      logger.info('Admin user password updated from environment variable');
    } else if (!existingAdmin) {
      // Create new admin user only if environment variable is set
      const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || process.env.VITE_ADMIN_DEFAULT_PASSWORD;
      
      if (!adminPassword) {
        logger.warn('ADMIN_DEFAULT_PASSWORD not set. Admin user not created. Use the create-admin script instead.');
        return;
      }
      
      const hashedPassword = await hashPassword(adminPassword);
      await supabase
        .from('admin_users' as any)
        .insert({
          nickname: 'andreadmin',
          password_hash: hashedPassword
        });
        
      logger.info('Admin user created from environment variable');
    } else {
      logger.info('Admin user already exists and is properly configured');
    }
  } catch (error) {
    logger.error('Error initializing default admin', { error: error.message });
  }
};

// Admin login
export const adminLogin = async (nickname: string, password: string): Promise<{
  admin: AdminUser | null;
  sessionToken: string | null;
  error: string | null;
}> => {
  try {
    logger.auth('Admin login attempt started', { nickname });
    
    const { data: adminUser, error } = await supabase
      .from('admin_users' as any)
      .select('*')
      .eq('nickname', nickname)
      .single();

    if (error || !adminUser) {
      logger.security('Admin login failed - user not found', { nickname, error: error?.message });
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }

    logger.debug('Admin user found', { nickname, userId: adminUser.id });
    const adminUserData = adminUser as any;
    
    logger.debug('Verifying admin password');
    const isPasswordValid = await verifyPassword(password, adminUserData.password_hash);
    if (!isPasswordValid) {
      logger.security('Admin login failed - invalid password', { nickname, userId: adminUserData.id });
      return { admin: null, sessionToken: null, error: 'Invalid credentials' };
    }
    
    logger.debug('Admin password verified successfully');

    // Create session
    logger.debug('Creating admin session');
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
    
    logger.debug('Generated session details', { expiresAt });

    // Create new admin session in DB
    logger.debug('Saving admin session to database');
    const { error: insertErr } = await supabase
      .from('admin_sessions' as any)
      .insert({
        admin_user_id: adminUserData.id,
        session_token: sessionToken,
        expires_at: expiresAt
      });

    if (insertErr) {
      logger.error('Failed to create admin session', { nickname, error: insertErr.message });
      return { admin: null, sessionToken: null, error: 'Failed to create session' };
    }
    
    logger.debug('Admin session saved to database');

    // Update last login
    logger.debug('Updating admin last login time');
    const { error: updateErr } = await supabase
      .from('admin_users' as any)
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUserData.id);

    if (updateErr) {
      logger.warn('Could not update admin last_login', { nickname, error: updateErr.message });
    } else {
      logger.debug('Admin last login updated');
    }

    // Store session in localStorage for consistency
    logger.debug('Storing admin session token in localStorage');
    localStorage.setItem('admin_session_token', sessionToken);

    const adminData = {
      id: adminUserData.id,
      nickname: adminUserData.nickname,
      created_at: adminUserData.created_at,
      updated_at: adminUserData.updated_at,
      last_login: adminUserData.last_login
    };
    
    logger.auth('Admin login successful', { nickname, userId: adminUserData.id });
    return {
      admin: adminData,
      sessionToken,
      error: null
    };
  } catch (error) {
    logger.error('Admin login error', { nickname, error: error.message });
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