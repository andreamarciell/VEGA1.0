// Supabase Configuration
export const SUPABASE_CONFIG = {
  URL: 'https://vobftcreopaqrfoonybp.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvYmZ0Y3Jlb3BhcXJmb29ueWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTAxNDcsImV4cCI6MjA2ODk2NjE0N30.1n0H8fhQLwKWe9x8sdQYXKX002Bo4VywijxGLxX8jbo',
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  EDGE_FUNCTIONS: {
    LOGIN_WITH_USERNAME: 'login-with-username'
  }
};

// Environment check
export const checkSupabaseConfig = () => {
  if (!SUPABASE_CONFIG.URL || !SUPABASE_CONFIG.ANON_KEY) {
    throw new Error('Missing Supabase configuration. Please check your environment variables.');
  }
  
  console.log('✅ Supabase configuration loaded successfully');
  return true;
};
