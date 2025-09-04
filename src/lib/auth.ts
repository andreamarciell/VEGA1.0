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

export interface LockoutInfo {
  isLocked: boolean;
  remainingSeconds: number;
  message: string;
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

// Check if account is locked before attempting login
const checkAccountLockout = async (username: string): Promise<LockoutInfo | null> => {
  try {
    const { data, error } = await supabase.rpc('check_account_lockout_status', {
      p_username: username
    });

    if (error) {
      console.error('Error checking account lockout:', error);
      return null;
    }

    if (data.is_locked) {
      return {
        isLocked: true,
        remainingSeconds: Math.max(0, data.remaining_seconds || 0),
        message: data.message || 'Account is locked'
      };
    }

    return null;
  } catch (error) {
    console.error('Exception checking account lockout:', error);
    return null;
  }
};

// Record failed login attempt
const recordFailedAttempt = async (username: string): Promise<any> => {
  try {
    const { data, error } = await supabase.rpc('record_failed_login_attempt', {
      p_username: username,
      p_ip_address: 'client-side', // In production, get from server
      p_user_agent: navigator.userAgent
    });

    if (error) {
      console.error('Error recording failed attempt:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception recording failed attempt:', error);
    return null;
  }
};

// Reset account lockout on successful login
const resetAccountLockout = async (username: string): Promise<void> => {
  try {
    await supabase.rpc('reset_account_lockout', {
      p_username: username
    });
  } catch (error) {
    console.error('Error resetting account lockout:', error);
  }
};

// ====================================================================================
// ++ FUNZIONE DI LOGIN MODIFICATA ++
// Questa funzione ora integra il sistema di blocco account
// ====================================================================================
export const loginWithCredentials = async (credentials: LoginCredentials): Promise<{
  user: AuthUser | null;
  session: AuthSession | null;
  error: string | null;
  lockoutInfo?: LockoutInfo;
}> => {
  try {
    console.log('Invoking login function for username:', credentials.username);

    // 1. Check if account is locked before proceeding
    const lockoutStatus = await checkAccountLockout(credentials.username);
    if (lockoutStatus && lockoutStatus.isLocked) {
      return {
        user: null,
        session: null,
        error: 'Account is locked',
        lockoutInfo: lockoutStatus
      };
    }

    // 2. Invoca la Edge Function 'login-with-username' passando le credenziali.
    //    Questa funzione lato server cercherà l'email associata allo username
    //    e tenterà il login in modo sicuro.
    const { data, error } = await supabase.functions.invoke('login-with-username', {
      body: credentials,
    });

    // Gestisce l'errore se la chiamata alla Edge Function fallisce (es. funzione non trovata)
    if (error) {
      console.error('Edge function invocation error:', error.message);
      
      // Record failed attempt even if edge function fails
      await recordFailedAttempt(credentials.username);
      
      return { user: null, session: null, error: 'An authentication error occurred.' };
    }

    // La Edge Function potrebbe restituire un errore di login specifico (es. password errata)
    // nel corpo della sua risposta.
    if (data.error) {
        console.error('Login error from function:', data.error);
        
        // Record failed attempt
        const lockoutResult = await recordFailedAttempt(credentials.username);
        
        // Check if this failed attempt caused a lockout
        if (lockoutResult && lockoutResult.is_locked) {
          return { 
            user: null, 
            session: null, 
            error: 'Account is now locked due to multiple failed attempts',
            lockoutInfo: {
              isLocked: true,
              remainingSeconds: lockoutResult.remaining_seconds || 0,
              message: lockoutResult.message || 'Account locked due to failed attempts'
            }
          };
        }
        
        return { user: null, session: null, error: 'Invalid username or password' };
    }

    const { user, session } = data;

    if (!user || !session) {
      console.error('No user or session returned from function');
      
      // Record failed attempt
      await recordFailedAttempt(credentials.username);
      
      return { user: null, session: null, error: 'Failed to login' };
    }
    
    // 3. Una volta ottenuta la sessione, la impostiamo manualmente nel client Supabase
    const { error: sessionError } = await supabase.auth.setSession(session);

    if (sessionError) {
        console.error('Error setting session on client:', sessionError.message);
        
        // Record failed attempt
        await recordFailedAttempt(credentials.username);
        
        return { user: null, session: null, error: 'Failed to establish session' };
    }

    // 4. Reset account lockout on successful login
    await resetAccountLockout(credentials.username);

    // 5. Arricchiamo l'oggetto utente con lo username per coerenza nell'applicazione
    const userWithUsername: AuthUser = {
      ...user,
      username: credentials.username,
    };

    const sessionWithUsername: AuthSession = {
      ...session,
      user: userWithUsername,
    };

    // Memorizza il tempo di login per il controllo della scadenza della sessione
    const loginTimeKey = `login_time_${user.id}`;
    localStorage.setItem(loginTimeKey, Date.now().toString());
    
    console.log('Login successful for user:', user.email);

    return {
      user: userWithUsername,
      session: sessionWithUsername,
      error: null,
    };

  } catch (err) {
    // Errore generico non previsto
    console.error('An unexpected error occurred during login:', err);
    
    // Record failed attempt
    await recordFailedAttempt(credentials.username);
    
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


// DEPRECATED - DO NOT USE
// This function contained hardcoded credentials and has been removed for security
export const createSeededUser = async () => {
  console.warn('createSeededUser is deprecated for security reasons. Use proper user registration.');
  return { success: false, error: 'Function deprecated for security reasons' };
};
