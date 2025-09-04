// Global Security Middleware for React Application
import { getSecurityHeaders } from './securityHeaders';
import { CSRFProtection } from './csrfProtection';

export class SecurityMiddleware {
  /**
   * Initialize security measures for the application
   */
  static initializeSecurity(): void {
    // Set up CSRF protection
    this.setupCSRFProtection();
    
    // Set up click-jacking protection
    this.setupClickjackingProtection();
    
    // Set up XSS protection
    this.setupXSSProtection();
    
    // Monitor security violations
    this.setupSecurityMonitoring();
    
    console.log('🛡️ Security middleware initialized');
  }

  /**
   * Setup CSRF protection on page load
   */
  private static setupCSRFProtection(): void {
    // Initialize CSRF token on page load
    CSRFProtection.ensureToken();
    
    // Add CSRF token to all fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      
      // Add CSRF token to POST, PUT, PATCH, DELETE requests
      const method = init?.method?.toUpperCase() || 'GET';
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const csrfHeaders = CSRFProtection.getHeaders();
        Object.entries(csrfHeaders).forEach(([key, value]) => {
          headers.set(key, value);
        });
      }
      
      return originalFetch(input, {
        ...init,
        headers
      });
    };
  }

  /**
   * Setup click-jacking protection
   */
  private static setupClickjackingProtection(): void {
    // Prevent page from being embedded in frames
    if (window.top !== window.self) {
      console.warn('⚠️ Page loaded in frame - potential clickjacking attempt');
      // Redirect to top level
      window.top.location = window.location;
    }
  }

  /**
   * Setup XSS protection
   */
  private static setupXSSProtection(): void {
    // Sanitize dangerous DOM methods
    const originalSetInnerHTML = Element.prototype.innerHTML;
    
    // Override innerHTML setter to warn about potential XSS
    Object.defineProperty(Element.prototype, 'innerHTML', {
      set: function(value: string) {
        if (typeof value === 'string' && value.includes('<script')) {
          console.warn('⚠️ Potential XSS attempt detected in innerHTML');
          // In production, you might want to sanitize or block this
        }
        originalSetInnerHTML.call(this, value);
      },
      get: function() {
        return originalSetInnerHTML.call(this);
      }
    });
  }

  /**
   * Setup security violation monitoring
   */
  private static setupSecurityMonitoring(): void {
    // Listen for CSP violations
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error('🚨 CSP Violation:', {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        originalPolicy: e.originalPolicy,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber
      });
      
      // In production, send to security monitoring service
      this.reportSecurityViolation('csp', e);
    });

    // Monitor for suspicious activities
    this.setupActivityMonitoring();
  }

  /**
   * Setup activity monitoring for suspicious behavior
   */
  private static setupActivityMonitoring(): void {
    let rapidClickCount = 0;
    let lastClickTime = 0;

    // Detect rapid clicking (potential bot behavior)
    document.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastClickTime < 100) { // Less than 100ms between clicks
        rapidClickCount++;
        if (rapidClickCount > 10) {
          console.warn('⚠️ Suspicious rapid clicking detected');
          this.reportSecurityViolation('rapid_clicking', { count: rapidClickCount });
          rapidClickCount = 0;
        }
      } else {
        rapidClickCount = 0;
      }
      lastClickTime = now;
    });

    // Detect tab visibility changes (potential session hijacking detection)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.debug('🔒 Tab hidden - session security check');
        // Could implement session validation here
      }
    });
  }

  /**
   * Report security violations to monitoring service
   */
  private static reportSecurityViolation(type: string, details: any): void {
    // In production, send to security monitoring service
    console.log('📊 Security violation reported:', { type, details, timestamp: new Date().toISOString() });
    
    // Could implement actual reporting here:
    // fetch('/api/security/report', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ type, details, timestamp: new Date().toISOString() })
    // });
  }

  /**
   * Validate current security state
   */
  static validateSecurityState(): boolean {
    const checks = [
      // Check if we're in a secure context
      window.isSecureContext,
      
      // Check if CSRF protection is active
      CSRFProtection.getToken() !== null,
      
      // Check if we're not in a frame
      window.top === window.self
    ];

    const passed = checks.every(check => check);
    
    if (!passed) {
      console.warn('⚠️ Security validation failed');
    } else {
      console.log('✅ Security validation passed');
    }

    return passed;
  }

  /**
   * Get security headers for manual requests
   */
  static getSecureRequestHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      ...getSecurityHeaders(),
      ...CSRFProtection.getHeaders(),
      ...additionalHeaders
    };
  }
}

// Auto-initialize on import
if (typeof window !== 'undefined') {
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SecurityMiddleware.initializeSecurity());
  } else {
    SecurityMiddleware.initializeSecurity();
  }
}
