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

// Session expiration check (3 hours)
const SESSION_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

// Get current session with expiration check
export const getCurrentSession = async (): Promise<AuthSession | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;
  
  // Store login time in localStorage for session tracking
  const loginTimeKey = `login_time_${session.user.id}`;
  let loginTime = localStorage.getItem(loginTimeKey);
  
  if (!loginTime) {
    // First time checking this session, store current time
    loginTime = Date.now().toString();
    localStorage.setItem(loginTimeKey, loginTime);
  }
  
  // Check if session has expired (3 hours)
  const sessionStart = parseInt(loginTime);
  const now = Date.now();
  
  if (now - sessionStart > SESSION_DURATION) {
    // Session has expired, clean up and log out
    localStorage.removeItem(loginTimeKey);
    await supabase.auth.signOut();
    return null;
  }

  // Fetch username from profiles table for the session
  const { data: profileData } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', session.user.id)
    .single();

  // Add username to session user object
  const sessionWithUsername = {
    ...session,
    user: {
      ...session.user,
      username: profileData?.username
    } as AuthUser
  } as AuthSession;
  
  return sessionWithUsername;
};

// Login with username/password - simplified for direct email login
export const loginWithCredentials = async (credentials: LoginCredentials): Promise<{
  user: AuthUser | null;
  session: AuthSession | null;
  error: string | null;
}> => {
  try {
    // Map username to generated email used at registration
    const email = `${credentials.username}@secure.local`;

    // Attempt sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: credentials.password
    });

    if (error || !data.user) {
      return { user: null, session: null, error: error?.message || 'Invalid username or password' };
    }

    // Fetch username from profile table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile after login:', profileError);
    }

    const userWithUsername = {
      ...data.user,
      username: profileData?.username || credentials.username
    } as AuthUser;

    // Store login time for session tracking
    const loginTimeKey = `login_time_${data.user.id}`;
    localStorage.setItem(loginTimeKey, Date.now().toString());

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

    // Fetch username from profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', data.user.id)
      .single();

    console.log('Profile fetch result:', { profileData, profileError });

    // Add username to user object
    const userWithUsername = {
      ...data.user,
      username: profileData?.username || credentials.username
    } as AuthUser;

    console.log('Login successful for user:', userWithUsername.email, 'username:', userWithUsername.username);

    // Store login time for session tracking
    const loginTimeKey = `login_time_${data.user.id}`;
    localStorage.setItem(loginTimeKey, Date.now().toString());

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
    // Get current session to clean up login time
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const loginTimeKey = `login_time_${session.user.id}`;
      localStorage.removeItem(loginTimeKey);
    }
    
    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  } catch (error) {
    console.error('Logout error:', error);
    return { error: 'An unexpected error occurred during logout' };
  }
};

// ++ NUOVA FUNZIONE PER AGGIORNARE LA PASSWORD ++
export const updateUserPassword = async (password: string): Promise<{ error: string | null }> => {
  const { error } = await supabase.auth.updateUser({ password });
  
  if (error) {
    console.error('Error updating password:', error.message);
    return { error: error.message };
  }
  
  return { error: null };
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
