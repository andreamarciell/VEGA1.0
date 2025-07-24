import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';

export interface AuthUser extends User {
  username?: string;
}

export interface AuthSession extends Session {
  user: AuthUser;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SecurityInfo {
  isLocked: boolean;
  attemptsRemaining: number;
  lockoutExpires?: Date;
}

// Get current session
export const getCurrentSession = async (): Promise<AuthSession | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session as AuthSession | null;
};

// Login with username/password - simplified for direct email login
export const loginWithCredentials = async (credentials: LoginCredentials): Promise<{
  user: AuthUser | null;
  session: AuthSession | null;
  error: string | null;
}> => {
  try {
    // For the seeded user, map username to email
    let email = '';
    if (credentials.username === 'andrea') {
      email = 'andrea@secure.local';
    } else {
      return { user: null, session: null, error: 'Invalid username or password' };
    }

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: credentials.password
    });

    if (error) {
      return { user: null, session: null, error: 'Invalid username or password' };
    }

    // Add username to user object
    const userWithUsername = {
      ...data.user,
      username: credentials.username
    } as AuthUser;

    return {
      user: userWithUsername,
      session: { ...data.session, user: userWithUsername } as AuthSession,
      error: null
    };

  } catch (error) {
    console.error('Login error:', error);
    return { user: null, session: null, error: 'An unexpected error occurred' };
  }
};

// Logout
export const logout = async (): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  } catch (error) {
    console.error('Logout error:', error);
    return { error: 'An unexpected error occurred during logout' };
  }
};

// Create the seeded user (admin only function)
export const createSeededUser = async () => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'andrea@secure.local',
      password: 'topperyGiasai456!',
      options: {
        data: {
          username: 'andrea'
        },
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      console.error('Error creating seeded user:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in createSeededUser:', error);
    return { success: false, error: 'Failed to create user' };
  }
};