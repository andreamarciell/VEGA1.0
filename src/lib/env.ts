// Environment variables management for cross-platform compatibility
export interface EnvironmentConfig {
  VITE_CLERK_PUBLISHABLE_KEY: string;
  NODE_ENV: string;
  IS_PRODUCTION: boolean;
  IS_DEVELOPMENT: boolean;
}

// Get environment variables with fallbacks
const getEnvVar = (key: string, fallback?: string): string => {
  // Try Vite-style env only when import.meta.env is actually available
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
      : undefined;
  if (viteEnv && key in viteEnv && typeof viteEnv[key] === 'string') {
    return viteEnv[key] as string;
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
  VITE_CLERK_PUBLISHABLE_KEY: getEnvVar('VITE_CLERK_PUBLISHABLE_KEY', ''),
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  IS_PRODUCTION: getEnvVar('NODE_ENV', 'development') === 'production',
  IS_DEVELOPMENT: getEnvVar('NODE_ENV', 'development') === 'development'
};

// Validation function
export const validateEnvironment = (): { isValid: boolean; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check if we have the required Clerk configuration
  if (!ENV_CONFIG.VITE_CLERK_PUBLISHABLE_KEY) {
    errors.push('Missing required Clerk configuration: VITE_CLERK_PUBLISHABLE_KEY');
  }
  
  // Check if we're using fallback values in production
  if (ENV_CONFIG.IS_PRODUCTION) {
    if (!getEnvVar('VITE_CLERK_PUBLISHABLE_KEY')) {
      warnings.push('Production environment detected but VITE_CLERK_PUBLISHABLE_KEY not configured');
      warnings.push('This will prevent authentication from working');
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
export const PUBLIC_CLERK_PUBLISHABLE_KEY = ENV_CONFIG.VITE_CLERK_PUBLISHABLE_KEY;

// Export individual getters for convenience
export const getClerkPublishableKey = (): string => ENV_CONFIG.VITE_CLERK_PUBLISHABLE_KEY;
export const isProduction = (): boolean => ENV_CONFIG.IS_PRODUCTION;
export const isDevelopment = (): boolean => ENV_CONFIG.IS_DEVELOPMENT;
