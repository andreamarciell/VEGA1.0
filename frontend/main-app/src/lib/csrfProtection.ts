// CSRF Protection Implementation
// This provides comprehensive Cross-Site Request Forgery protection

export interface CSRFTokenData {
  token: string;
  timestamp: number;
  sessionId?: string;
}

export class CSRFProtection {
  private static readonly TOKEN_LIFETIME = 60 * 60 * 1000; // 1 hour
  private static readonly STORAGE_KEY = '__csrf_token__';
  private static readonly HEADER_NAME = 'X-CSRF-Token';

  /**
   * Generate a cryptographically secure CSRF token
   */
  static generateToken(): string {
    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create and store a new CSRF token
   */
  static createToken(sessionId?: string): string {
    const token = this.generateToken();
    const tokenData: CSRFTokenData = {
      token,
      timestamp: Date.now(),
      sessionId
    };

    try {
      // Store in sessionStorage (cleared on tab close)
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokenData));
    } catch (e) {
      console.warn('SessionStorage not available, CSRF protection limited');
    }

    return token;
  }

  /**
   * Get current valid CSRF token
   */
  static getToken(): string | null {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const tokenData: CSRFTokenData = JSON.parse(stored);
      
      // Check if token is expired
      if (Date.now() - tokenData.timestamp > this.TOKEN_LIFETIME) {
        this.clearToken();
        return null;
      }

      return tokenData.token;
    } catch (e) {
      console.warn('Failed to retrieve CSRF token');
      return null;
    }
  }

  /**
   * Validate CSRF token
   */
  static validateToken(providedToken: string, sessionId?: string): boolean {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return false;
      }

      const tokenData: CSRFTokenData = JSON.parse(stored);

      // Check expiration
      if (Date.now() - tokenData.timestamp > this.TOKEN_LIFETIME) {
        this.clearToken();
        return false;
      }

      // Validate token
      if (tokenData.token !== providedToken) {
        return false;
      }

      // Validate session if provided
      if (sessionId && tokenData.sessionId && tokenData.sessionId !== sessionId) {
        return false;
      }

      return true;
    } catch (e) {
      console.warn('CSRF token validation failed');
      return false;
    }
  }

  /**
   * Clear CSRF token
   */
  static clearToken(): void {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      // SessionStorage not available
    }
  }

  /**
   * Ensure we have a valid token, create one if needed
   */
  static ensureToken(sessionId?: string): string {
    let token = this.getToken();
    if (!token) {
      token = this.createToken(sessionId);
    }
    return token;
  }

  /**
   * Get headers for request with CSRF protection
   */
  static getHeaders(sessionId?: string): Record<string, string> {
    const token = this.ensureToken(sessionId);
    return {
      [this.HEADER_NAME]: token
    };
  }

  /**
   * Validate request headers for CSRF protection
   */
  static validateHeaders(headers: Record<string, string>, sessionId?: string): boolean {
    const token = headers[this.HEADER_NAME] || headers[this.HEADER_NAME.toLowerCase()];
    if (!token) {
      return false;
    }
    return this.validateToken(token, sessionId);
  }
}

// React Hook for CSRF protection
export const useCSRFProtection = () => {
  const getCSRFHeaders = (sessionId?: string) => {
    return CSRFProtection.getHeaders(sessionId);
  };

  const validateCSRF = (token: string, sessionId?: string) => {
    return CSRFProtection.validateToken(token, sessionId);
  };

  const ensureCSRFToken = (sessionId?: string) => {
    return CSRFProtection.ensureToken(sessionId);
  };

  return {
    getCSRFHeaders,
    validateCSRF,
    ensureCSRFToken
  };
};

// CSRF Token Input Component (for forms)
import React from 'react';

export const CSRFTokenInput: React.FC<{ sessionId?: string }> = ({ sessionId }) => {
  const token = CSRFProtection.ensureToken(sessionId);
  
  return React.createElement('input', {
    type: 'hidden',
    name: 'csrf_token',
    value: token,
    'data-csrf-token': token
  });
};
