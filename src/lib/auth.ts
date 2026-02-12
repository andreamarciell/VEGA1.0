// DEPRECATED: This file has been migrated to Clerk Auth
// All authentication should now use Clerk hooks: useAuth(), useUser(), useClerk()
// This file is kept for backward compatibility but will be removed in the future.

import { logger } from './logger';

// Re-export types for backward compatibility (but they should use Clerk types instead)
export interface AuthUser {
  id: string;
  username?: string;
  email?: string;
}

export interface AuthSession {
  user: AuthUser;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// DEPRECATED: Use Clerk's useAuth() hook instead
export const getCurrentSession = async (): Promise<AuthSession | null> => {
  logger.warn('getCurrentSession() is deprecated. Use Clerk\'s useAuth() hook instead.');
  console.error('getCurrentSession() is deprecated. Please migrate to Clerk authentication.');
  return null;
};

// DEPRECATED: Use Clerk's useClerk().signOut() instead
export const logout = async (): Promise<{ error: string | null }> => {
  logger.warn('logout() is deprecated. Use Clerk\'s useClerk().signOut() instead.');
  console.error('logout() is deprecated. Please migrate to Clerk authentication.');
  return { error: 'This function is deprecated. Use Clerk authentication.' };
};

// DEPRECATED: Use Clerk's user.updatePassword() instead
export const updateUserPassword = async (password: string): Promise<{ error: string | null }> => {
  logger.warn('updateUserPassword() is deprecated. Use Clerk\'s user.updatePassword() instead.');
  console.error('updateUserPassword() is deprecated. Please migrate to Clerk authentication.');
  return { error: 'This function is deprecated. Use Clerk authentication.' };
};

// DEPRECATED: This function is no longer supported - Clerk handles login via SignIn component
export const loginWithCredentials = async (credentials: LoginCredentials): Promise<{
  user: AuthUser | null;
  session: AuthSession | null;
  error: string | null;
  lockoutInfo?: any;
}> => {
  logger.warn('loginWithCredentials() is deprecated. Use Clerk\'s SignIn component instead.');
  console.error('loginWithCredentials() is deprecated. Please migrate to Clerk authentication.');
  return {
    user: null,
    session: null,
    error: 'This function is deprecated. Use Clerk authentication via SignIn component.'
  };
};
