// Secure Supabase Configuration
// Fallback values for development only - use environment variables in production
const FALLBACK_CONFIG = {
  URL: 'https://vobftcreopaqrfoonybp.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmZ0Y3Jlb3BhcXJmb29ueWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAxNDcsImV4cCI6MjA2ODk2NjE0N30.1n0H8fhQLwKWe9x8sdQYXKX002Bo4VywijxGLxX8jbo'
};

export const SUPABASE_CONFIG = {
  URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_CONFIG.URL,
  ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || FALLBACK_CONFIG.ANON_KEY,
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  EDGE_FUNCTIONS: {
    LOGIN_WITH_USERNAME: 'login-with-username'
  }
};

// Environment validation
export const validateSupabaseConfig = (): boolean => {
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables in production: ${missingVars.join(', ')}`);
  }
  
  if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
    throw new Error('Invalid Supabase configuration - URL or ANON_KEY missing');
  }
  
  // Warn about fallback usage in development
  if (missingVars.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ Using fallback Supabase configuration. Set environment variables for production.');
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
    throw error;
  }
};
