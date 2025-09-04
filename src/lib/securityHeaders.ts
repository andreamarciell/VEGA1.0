// Security headers configuration for enhanced application security
export const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Restrict dangerous features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  
  // Content Security Policy - adjusted for Supabase and development
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for Vite and React dev
    "style-src 'self' 'unsafe-inline'", // Needed for CSS-in-JS
    "img-src 'self' data: https:", // Allow images from HTTPS and data URLs
    "font-src 'self' data:", // Allow local and data URL fonts
    "connect-src 'self' https://*.supabase.co https://*.netlify.com", // Allow Supabase and Netlify connections
    "object-src 'none'", // Disable objects/embeds
    "base-uri 'self'", // Restrict base tag
    "form-action 'self'", // Restrict form submissions
    "frame-ancestors 'none'" // Prevent framing
  ].join('; ')
};

export const DEVELOPMENT_CSP_OVERRIDES = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* ws: wss:", // Allow dev server
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.netlify.com localhost:* ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ')
};

/**
 * Apply security headers to a Headers object
 */
export const applySecurityHeaders = (headers: Headers): void => {
  const headersToApply = process.env.NODE_ENV === 'development' 
    ? { ...SECURITY_HEADERS, ...DEVELOPMENT_CSP_OVERRIDES }
    : SECURITY_HEADERS;
    
  Object.entries(headersToApply).forEach(([key, value]) => {
    headers.set(key, value);
  });
};

/**
 * Get security headers as a plain object
 */
export const getSecurityHeaders = (): Record<string, string> => {
  return process.env.NODE_ENV === 'development' 
    ? { ...SECURITY_HEADERS, ...DEVELOPMENT_CSP_OVERRIDES }
    : SECURITY_HEADERS;
};

/**
 * Validate security headers in response
 */
export const validateSecurityHeaders = (response: Response): boolean => {
  const requiredHeaders = ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection'];
  
  for (const header of requiredHeaders) {
    if (!response.headers.get(header)) {
      console.warn(`Missing security header: ${header}`);
      return false;
    }
  }
  
  return true;
};

/**
 * Middleware function to add security headers to responses
 */
export const securityHeadersMiddleware = (request: Request): Record<string, string> => {
  return getSecurityHeaders();
};
