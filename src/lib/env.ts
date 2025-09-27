// Environment variables management for cross-platform compatibility
export interface EnvironmentConfig {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  NODE_ENV: string;
  IS_PRODUCTION: boolean;
  IS_DEVELOPMENT: boolean;
}

// Get environment variables with fallbacks
const getEnvVar = (key: string, fallback?: string): string => {
  // Try Vite environment first
  if (import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  
  // Try process.env as fallback (for Node.js environments)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  
  // Return fallback if provided
  return fallback || '';
};

// Environment configuration
export const ENV_CONFIG: EnvironmentConfig = {
  VITE_SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL', 'https://vobftcreopaqrfoonybp.supabase.co'),
  VITE_SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmZ0Y3Jlb3BhcXJmb29ueWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAxNDcsImV4cCI6MjA2ODk2NjE0N30.1n0H8fhQLwKWe9x8sdQYXKX002Bo4VywijxGLxX8jbo'),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  IS_PRODUCTION: getEnvVar('NODE_ENV', 'development') === 'production',
  IS_DEVELOPMENT: getEnvVar('NODE_ENV', 'development') === 'development'
};

// Validation function
export const validateEnvironment = (): { isValid: boolean; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check if we have the required configuration
  if (!ENV_CONFIG.VITE_SUPABASE_URL || !ENV_CONFIG.VITE_SUPABASE_ANON_KEY) {
    errors.push('Missing required Supabase configuration');
  }
  
  // Check if we're using fallback values in production
  if (ENV_CONFIG.IS_PRODUCTION) {
    if (!getEnvVar('VITE_SUPABASE_URL') || !getEnvVar('VITE_SUPABASE_ANON_KEY')) {
      warnings.push('Production environment detected but using fallback configuration');
      warnings.push('This may not be secure for production use');
    }
  }
  
  // Log configuration status
  if (ENV_CONFIG.IS_PRODUCTION) {
    console.log('🌐 Production environment detected');
  } else {
    console.log('🔧 Development environment detected');
  }
  
  if (errors.length > 0) {
    console.error('❌ Environment validation failed:', errors);
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️ Environment warnings:', warnings);
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};

// Export only public environment variables for client use
export const PUBLIC_SUPABASE_URL = ENV_CONFIG.VITE_SUPABASE_URL;
export const PUBLIC_SUPABASE_ANON_KEY = ENV_CONFIG.VITE_SUPABASE_ANON_KEY;

// Export individual getters for convenience
export const getSupabaseUrl = (): string => ENV_CONFIG.VITE_SUPABASE_URL;
export const getSupabaseAnonKey = (): string => ENV_CONFIG.VITE_SUPABASE_ANON_KEY;
export const isProduction = (): boolean => ENV_CONFIG.IS_PRODUCTION;
export const isDevelopment = (): boolean => ENV_CONFIG.IS_DEVELOPMENT;
