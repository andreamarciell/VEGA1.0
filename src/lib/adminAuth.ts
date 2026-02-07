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

// SERVER-SIDE: Check admin session via secure endpoint
export const checkAdminSession = async (): Promise<AdminUser | null> => {
  try {
    const response = await fetch('/api/v1/admin/session', {
      method: 'GET',
      credentials: 'include', // Send HttpOnly cookies
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      console.log('Admin session check failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.authenticated) {
      console.log('No valid admin session found');
      return null;
    }
    
    // Return admin user data in expected format
    return {
      id: data.admin.id,
      nickname: data.admin.nickname,
      created_at: '', // Not needed for session check
      updated_at: '', // Not needed for session check
      last_login: ''  // Not needed for session check
    };
  } catch (error) {
    console.error('Error checking admin session:', error);
    return null;
  }
};

// Admin logout
export const adminLogout = async (): Promise<void> => {
  try {
    logger.info('Admin logout initiated');
    
    // Call server-side logout endpoint
    const response = await fetch('/api/v1/admin/logout', {
      method: 'POST',
      credentials: 'include', // Send HttpOnly cookies
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      logger.error('Admin logout failed:', response.status);
    } else {
      logger.info('Admin logout completed successfully');
    }
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
    const response = await fetch('/api/v1/admin/users', {
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
    const response = await fetch('/api/v1/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Send admin session cookie
      body: JSON.stringify({ email, password, username })
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