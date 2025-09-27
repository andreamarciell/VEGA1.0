import { supabase } from "@/integrations/supabase/client";
import bcrypt from 'bcryptjs';
import { logger } from './logger';
import { setAdminSession, getAdminSession, clearAdminSession } from './secureCookies';

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

// Generate cryptographically secure session token (server-side quality)
const generateSessionToken = (): string => {
  // Use 32 bytes (256 bits) for cryptographically secure token
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
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

// SECURITY: Initialize default admin user - DISABLED FOR CLIENT SECURITY
export const initializeDefaultAdmin = async (): Promise<void> => {
  // SECURITY: Admin user initialization disabled from client side
  // This function has been neutralized to prevent direct client access to admin_users table
  console.warn('initializeDefaultAdmin: Client-side admin initialization disabled for security');
  throw new Error('Admin initialization must be done server-side for security reasons');
};

// SECURITY: Admin login - DISABLED FOR CLIENT SECURITY
export const adminLogin = async (nickname: string, password: string): Promise<{
  admin: AdminUser | null;
  sessionToken: string | null;
  error: string | null;
}> => {
  // SECURITY: Client-side admin login disabled
  // Admin authentication must be handled server-side for security
  console.warn('adminLogin: Client-side admin login disabled for security');
  return { 
    admin: null, 
    sessionToken: null, 
    error: 'Admin login must be performed server-side for security reasons' 
  };
};

// SECURITY: Check admin session - DISABLED FOR CLIENT SECURITY
export const checkAdminSession = async (): Promise<AdminUser | null> => {
  // SECURITY: Client-side admin session checking disabled
  // Admin session validation must be handled server-side for security
  console.warn('checkAdminSession: Client-side session checking disabled for security');
  return null;
};

// Admin logout
export const adminLogout = async (): Promise<void> => {
  try {
    logger.info('Admin logout initiated');
    const sessionToken = getAdminSession();
    
    if (sessionToken) {
      logger.debug('Removing admin session from database');
      
      // Use secure RPC function to destroy session
      const { error } = await supabase.rpc('admin_destroy_session', {
        session_token: sessionToken
      });
      
      if (error) {
        logger.error('Error removing admin session from database', { error: error.message });
      } else {
        logger.info('Admin session removed from database');
      }
    }
    
    // Clear all session storage
    logger.debug('Clearing admin session from secure storage');
    clearAdminSession();
    
    logger.info('Admin logout completed successfully');
  } catch (error) {
    logger.error('Admin logout error', { error: error.message });
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

// Get all users for management - SERVER-SIDE ADMIN AUTH
export const getAllUsers = async () => {
  try {
    const response = await fetch('/.netlify/functions/adminGetUsers', {
      method: 'GET',
      credentials: 'include', // Send admin session cookie
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to fetch users');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Create new user - SERVER-SIDE ADMIN AUTH
export const createUser = async (email: string, username: string, password: string) => {
  try {
    const response = await fetch('/.netlify/functions/createUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send admin session cookie
      body: JSON.stringify({ email, password })
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

// SECURITY: Update user password - DISABLED FOR CLIENT SECURITY
export const updateUserPassword = async (userId: string, newPassword: string) => {
  // SECURITY: Client-side admin operations disabled
  // Admin operations must be handled server-side for security
  console.warn('updateUserPassword: Client-side admin operations disabled for security');
  throw new Error('Admin operations must be performed server-side for security reasons');
};