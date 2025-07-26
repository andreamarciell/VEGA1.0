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
    console.log('Login attempt for username:', credentials.username);
    
    // For the seeded user, map username to email
    let email = '';
    if (credentials.username === 'andrea') {
      email = 'andrea@secure.local';
    } else {
      console.log('Invalid username:', credentials.username);
      return { user: null, session: null, error: 'Invalid username or password' };
    }

    console.log('Attempting login with email:', email);

    // Attempt login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: credentials.password
    });

    console.log('Login result:', { data: !!data.user, error: error?.message });

    if (error) {
      console.error('Login error:', error);
      return { user: null, session: null, error: 'Invalid username or password' };
    }

    if (!data.user || !data.session) {
      console.error('No user or session returned');
      return { user: null, session: null, error: 'Invalid username or password' };
    }

    // Add username to user object
    const userWithUsername = {
      ...data.user,
      username: credentials.username
    } as AuthUser;

    console.log('Login successful for user:', userWithUsername.email);

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
    // First check if user already exists by trying to sign in
    const checkResult = await supabase.auth.signInWithPassword({
      email: 'andrea@secure.local',
      password: 'topperyGiasai456!'
    });

    if (!checkResult.error && checkResult.data.user) {
      // User already exists and credentials work
      await supabase.auth.signOut(); // Sign out immediately
      return { success: true, message: 'User already exists' };
    }

    // User doesn't exist, create it
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

    // If user was created but needs confirmation, we'll manually confirm them
    if (data.user && !data.user.email_confirmed_at) {
      // For demo purposes, we'll sign out after creation
      await supabase.auth.signOut();
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error in createSeededUser:', error);
    return { success: false, error: 'Failed to create user' };
  }
};