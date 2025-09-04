import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { logger } from './logger';

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

// Session expiration configuration
const SESSION_DURATION_HOURS = parseInt(process.env.USER_SESSION_TIMEOUT_HOURS || '3');
const SESSION_DURATION = SESSION_DURATION_HOURS * 60 * 60 * 1000; // Convert to milliseconds

// Enhanced session validation with server-side checks
export const getCurrentSession = async (): Promise<AuthSession | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    logger.debug('No session found');
    return null;
  }

  try {
    // First, validate session with server-side check
    const { data: sessionValidation, error } = await supabase.rpc('validate_user_session', {
      p_session_token: session.access_token
    });

    if (error) {
      logger.warn('Session validation error', { error: error.message, userId: session.user.id });
      // Fallback to client-side validation
    } else if (sessionValidation && sessionValidation.length > 0) {
      const validation = sessionValidation[0];
      
      if (!validation.is_valid) {
        logger.info('Session invalid according to server', { userId: session.user.id });
        await supabase.auth.signOut();
        return null;
      }
      
      logger.debug('Session validated by server', { 
        userId: session.user.id,
        sessionAge: validation.session_age_hours 
      });
    }

    // Fallback client-side session expiration check for compatibility
    const loginTimeKey = `login_time_${session.user.id}`;
    let loginTime = localStorage.getItem(loginTimeKey);
    
    if (!loginTime) {
      // First time checking this session, store current time
      loginTime = Date.now().toString();
      localStorage.setItem(loginTimeKey, loginTime);
      logger.debug('Session time initialized', { userId: session.user.id });
    }
    
    // Check if session has expired (client-side fallback)
    const sessionStart = parseInt(loginTime);
    const now = Date.now();
    
    if (now - sessionStart > SESSION_DURATION) {
      // Session has expired, clean up and log out
      localStorage.removeItem(loginTimeKey);
      logger.info('Session expired (client-side check)', { 
        userId: session.user.id,
        sessionDurationHours: (now - sessionStart) / (1000 * 60 * 60)
      });
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
  } catch (error) {
    logger.error('Error during session validation', { 
      error: error.message, 
      userId: session.user.id 
    });
    
    // In case of error, allow session but log the issue
    const { data: profileData } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', session.user.id)
      .single();

    return {
      ...session,
      user: {
        ...session.user,
        username: profileData?.username
      } as AuthUser
    } as AuthSession;
  }
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
      p_username: username
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
      
      // Don't record failed attempt here - let the Edge Function handle it
      // Only record if Edge Function is completely unavailable
      if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
        await recordFailedAttempt(credentials.username);
      }
      
      return { user: null, session: null, error: 'An authentication error occurred.' };
    }

    // La Edge Function potrebbe restituire un errore di login specifico (es. password errata)
    // nel corpo della sua risposta.
    if (data.error) {
        console.error('Login error from function:', data.error);
        
        // Don't record failed attempt here - Edge Function already did it
        // Just check if lockout info is included in the response
        if (data.lockoutInfo) {
          return { 
            user: null, 
            session: null, 
            error: data.error,
            lockoutInfo: data.lockoutInfo
          };
        }
        
        return { user: null, session: null, error: data.error || 'Invalid username or password' };
    }

    const { user, session } = data;

    if (!user || !session) {
      console.error('No user or session returned from function');
      
      // Don't record failed attempt here - Edge Function handles this
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

// Enhanced logout with server-side session termination
export const logout = async (): Promise<{ error: string | null }> => {
  try {
    // Get current session to clean up
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const loginTimeKey = `login_time_${session.user.id}`;
      localStorage.removeItem(loginTimeKey);
      
      // Terminate server-side session
      try {
        await supabase.rpc('terminate_user_session', {
          p_session_token: session.access_token,
          p_reason: 'manual_logout'
        });
        logger.info('Session terminated on server', { userId: session.user.id });
      } catch (terminateError) {
        logger.warn('Failed to terminate server session', { 
          error: terminateError.message,
          userId: session.user.id 
        });
        // Continue with logout even if server termination fails
      }
    }
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logger.error('Logout error', { error: error.message });
    } else {
      logger.info('User logged out successfully');
    }
    
    return { error: error?.message || null };
  } catch (error) {
    logger.error('Logout error - unexpected', { error: error.message });
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
