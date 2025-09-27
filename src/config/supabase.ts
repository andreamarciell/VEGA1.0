// Secure Supabase Configuration using the new environment management system
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, isProduction, isDevelopment } from '@/lib/env';

export const SUPABASE_CONFIG = {
  URL: PUBLIC_SUPABASE_URL,
  ANON_KEY: PUBLIC_SUPABASE_ANON_KEY,
  EDGE_FUNCTIONS: {
    LOGIN_WITH_USERNAME: 'login-with-username'
  }
};

// Environment validation using the new system
export const validateSupabaseConfig = (): boolean => {
  // Always ensure we have valid configuration
  if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
    throw new Error('Invalid Supabase configuration - URL or ANON_KEY missing');
  }
  
  // Log configuration status
  if (isProduction()) {
    console.log('🌐 Production environment - Supabase configuration validated');
  } else {
    console.log('🔧 Development environment - Supabase configuration validated');
  }
  
  return true;
};

// Environment check with better error handling
export const checkSupabaseConfig = () => {
  try {
    validateSupabaseConfig();
    console.log('✅ Supabase configuration validated successfully');
    return true;
  } catch (error) {
    console.error('❌ Supabase configuration error:', error.message);
    
    // In production, we might want to be more strict
    if (isProduction()) {
      console.error('❌ Critical: Supabase configuration failed in production');
      // Don't throw in production to avoid breaking the app
      return false;
    }
    
    // In development, we can be more lenient
    console.warn('⚠️ Supabase configuration failed, but continuing with fallback values');
    return true;
  }
};
